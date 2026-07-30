import type { API, Logging } from 'homebridge'

import type { Robot } from './roomba.js'
import type { DeviceConfig, RoombaPlatformConfig } from './settings.js'

import dorita980 from 'dorita980'

/**
 * How long to wait to connect to Roomba.
 */
const CONNECT_TIMEOUT_MILLIS = 60_000

/**
 * How long after Roomba has been active should we continue frequently polling?
 */
const AFTER_ACTIVE_MILLIS = 120_000

/**
 * How long will we wait for the Roomba to send status before giving up?
 */
const STATUS_TIMEOUT_MILLIS = 60_000

/**
 * Coalesce multiple refreshState requests when they're less than this many millis apart.
 */
const REFRESH_STATE_COALESCE_MILLIS = 10_000

/**
 * How long after we send a command should we keep polling frequently?
 *
 * A Roomba takes several seconds to actually start or stop, so the refresh we
 * fire immediately after a command usually still reports the OLD state. Without
 * this window the next poll interval is then chosen from that stale state — for
 * a start command that means the idle interval, leaving HomeKit showing "not
 * cleaning" until it elapses (#226).
 */
const AFTER_COMMAND_MILLIS = 120_000

const ROBOT_CIPHERS = ['AES128-SHA256', 'TLS_AES_256_GCM_SHA384']

/**
 * How often to republish Matter state even when nothing has changed (#228).
 *
 * A Matter controller expects to keep hearing from a device; if the only pushes
 * are change-driven, a Roomba parked on its dock goes silent and Apple Home
 * settles on "Updating..." forever. A minute is comfortably inside the interval
 * a controller will tolerate, and the pushes are cheap and local.
 */
const MATTER_REPUBLISH_INTERVAL = 60_000

/**
 * Matter RVC operational state IDs
 */
const RVC_STATE = {
  STOPPED: 0,
  RUNNING: 1,
  PAUSED: 2,
  ERROR: 3,
  SEEKING_CHARGER: 64,
  CHARGING: 65,
  DOCKED: 66,
} as const

/**
 * Matter RVC run mode IDs
 */
const RVC_RUN_MODE = {
  IDLE: 0,
  CLEANING: 1,
} as const

interface RoombaStatus {
  timestamp: number
  running?: boolean
  docking?: boolean
  charging?: boolean
  /**
   * Sitting on the dock. Distinct from `charging`, which goes false once the
   * battery reaches 100% even though the Roomba is still docked (#223) - so
   * without this a fully charged Roomba looked simply "stopped" (#228).
   */
  docked?: boolean
  paused?: boolean
  stuck?: boolean
  /**
   * A clean cycle is still under way, even if the Roomba is not moving right
   * now - emptying into its dock, or recharging part-way through to resume.
   */
  missionActive?: boolean
  batteryLevel?: number
  binFull?: boolean
}

interface RoombaHolder {
  readonly roomba: any
  useCount: number
}

/**
 * Represents a Roomba device as a Homebridge Matter RoboticVacuumCleaner accessory.
 *
 * This class manages the connection to the physical Roomba device, translates
 * Roomba states to Matter clusters, and handles Matter commands (start, stop, pause,
 * resume, dock).
 */
export class RoboticVacuumCleaner {
  private readonly _api: API
  private readonly _log: Logging
  private readonly _device: Robot & DeviceConfig

  private readonly _blid: string
  private readonly _robotpwd: string
  private readonly _ipaddress: string
  private readonly _cleanBehaviour: 'everywhere' | 'rooms'
  private readonly _mission: any
  private readonly _stopBehaviour: 'home' | 'pause'
  private readonly _idlePollIntervalMillis: number

  private _cachedStatus: RoombaStatus = { timestamp: 0 }
  private _lastRefreshState = 0
  private _roombaLastActiveTimestamp?: number
  private _lastCommandTimestamp?: number
  private _pollTimeout?: ReturnType<typeof setTimeout>
  private _republishTimer?: ReturnType<typeof setInterval>
  private _currentRoombaPromise?: Promise<RoombaHolder>
  private _currentCipherIndex = 0
  private _started = false

  /**
   * The Matter accessory UUID (derived from device blid)
   */
  public readonly UUID: string

  /**
   * The Matter accessory display name
   */
  public readonly displayName: string

  constructor(api: API, log: Logging, device: Robot & DeviceConfig, config: RoombaPlatformConfig) {
    this._api = api
    this._log = log
    this._device = device

    this._blid = device.blid
    this._robotpwd = device.password
    this._ipaddress = device.ipaddress ?? device.ip
    this._cleanBehaviour = device.cleanBehaviour ?? 'everywhere'
    this._mission = device.mission ?? { pmap_id: 'local' }
    this._stopBehaviour = device.stopBehaviour ?? 'home'
    this._idlePollIntervalMillis = device.idleWatchInterval
      ? device.idleWatchInterval * 60_000
      : config.idleWatchInterval
        ? config.idleWatchInterval * 60_000
        : 900_000

    this.UUID = (api as any).matter?.uuid?.generate(`roomba-${device.blid}`) ?? `roomba-${device.blid}`
    this.displayName = device.name

    this._log.debug(`[Matter/${this.displayName}] Initialized Matter accessory, UUID: ${this.UUID}`)
  }

  /**
   * Returns a plain Matter accessory object suitable for registration with Homebridge.
   */
  toAccessory(): any {
    const matterApi = (this._api as any).matter
    return {
      UUID: this.UUID,
      displayName: this.displayName,
      deviceType: matterApi?.deviceTypes?.RoboticVacuumCleaner,
      serialNumber: this._getSerialNum(this._device),
      manufacturer: 'iRobot',
      model: this._device.model ?? 'Roomba',
      firmwareRevision: this._device.softwareVer ?? '0.0.0',
      hardwareRevision: '',
      context: {
        blid: this._blid,
        model: this._device.model,
      },
      clusters: {
        powerSource: {
          status: 0, // Active
          order: 0,
          description: 'Battery',
          batPercentRemaining: 200, // 200 = 100% (0.5% increments)
          batChargeLevel: 0, // 0 = Ok
          batReplaceability: 1, // Not replaceable
        },
        rvcRunMode: {
          supportedModes: [
            { label: 'Idle', mode: RVC_RUN_MODE.IDLE, modeTags: [{ value: 16384 }] },
            { label: 'Cleaning', mode: RVC_RUN_MODE.CLEANING, modeTags: [{ value: 16385 }] },
          ],
          currentMode: RVC_RUN_MODE.IDLE,
        },
        rvcCleanMode: {
          supportedModes: [
            { label: 'Vacuum', mode: 0, modeTags: [{ value: 16385 }] },
          ],
          currentMode: 0,
        },
        rvcOperationalState: {
          operationalStateList: [
            { operationalStateId: RVC_STATE.STOPPED },
            { operationalStateId: RVC_STATE.RUNNING },
            { operationalStateId: RVC_STATE.PAUSED },
            { operationalStateId: RVC_STATE.ERROR },
            { operationalStateId: RVC_STATE.SEEKING_CHARGER },
            { operationalStateId: RVC_STATE.CHARGING },
            { operationalStateId: RVC_STATE.DOCKED },
          ],
          operationalState: RVC_STATE.DOCKED,
        },
      },
      handlers: {
        rvcRunMode: {
          changeToMode: async (request: any) => this._handleChangeRunMode(request),
        },
        rvcOperationalState: {
          pause: async () => this._handlePause(),
          resume: async () => this._handleResume(),
          goHome: async () => this._handleGoHome(),
        },
      },
    }
  }

  /**
   * Start polling Roomba's status and pushing updates to Matter.
   */
  startPolling(): void {
    if (this._started) {
      return
    }
    this._started = true
    this._schedulePoll(false)

    // ⚠️ Republish on a timer as well as on change. State was only ever pushed
    // when something changed, so a Roomba sitting idle on its dock published
    // nothing at all and Apple Home eventually showed it as "Updating..."
    // indefinitely, until some unrelated event forced a push (#228).
    this._republishTimer = setInterval(() => {
      if (this._cachedStatus) {
        this._pushMatterState(this._cachedStatus)
      }
    }, MATTER_REPUBLISH_INTERVAL)
    // Do not hold the process open just to repeat state we have already sent.
    this._republishTimer.unref?.()
  }

  /**
   * Stop polling Roomba's status.
   */
  stopPolling(): void {
    this._started = false
    if (this._pollTimeout) {
      clearTimeout(this._pollTimeout)
      this._pollTimeout = undefined
    }
    if (this._republishTimer) {
      clearInterval(this._republishTimer)
      this._republishTimer = undefined
    }
  }

  // ---------------------------------------------------------------------------
  // Private: handlers
  // ---------------------------------------------------------------------------

  private async _handleChangeRunMode(request: any): Promise<any> {
    const mode: number = request?.newMode ?? request?.mode ?? -1
    this._log.debug(`[Matter/${this.displayName}] changeToMode: ${mode}`)

    if (mode === RVC_RUN_MODE.CLEANING) {
      // Start / resume cleaning
      await this._startCleaning()
    } else if (mode === RVC_RUN_MODE.IDLE) {
      // Stop / dock
      await this._stopAndDock()
    } else {
      return { status: 1 } // Unsupported mode
    }

    return { status: 0 }
  }

  private async _handlePause(): Promise<any> {
    this._log.debug(`[Matter/${this.displayName}] pause`)
    return new Promise<any>((resolve) => {
      this._connect(async (error, roomba) => {
        if (error || !roomba) {
          this._log.warn(`[Matter/${this.displayName}] Failed to pause: ${error?.message ?? 'Unknown'}`)
          resolve({ errorStateId: RVC_STATE.ERROR })
          return
        }
        try {
          await roomba.pause()
          this._log.debug(`[Matter/${this.displayName}] Paused`)
          this._schedulePoll(true)
          resolve({ errorStateId: 0 })
        } catch (err: any) {
          this._log.warn(`[Matter/${this.displayName}] Pause failed: ${err.message}`)
          resolve({ errorStateId: RVC_STATE.ERROR })
        }
      })
    })
  }

  private async _handleResume(): Promise<any> {
    this._log.debug(`[Matter/${this.displayName}] resume`)
    return new Promise<any>((resolve) => {
      this._connect(async (error, roomba) => {
        if (error || !roomba) {
          this._log.warn(`[Matter/${this.displayName}] Failed to resume: ${error?.message ?? 'Unknown'}`)
          resolve({ errorStateId: RVC_STATE.ERROR })
          return
        }
        try {
          await roomba.resume()
          this._log.debug(`[Matter/${this.displayName}] Resumed`)
          this._schedulePoll(true)
          resolve({ errorStateId: 0 })
        } catch (err: any) {
          this._log.warn(`[Matter/${this.displayName}] Resume failed: ${err.message}`)
          resolve({ errorStateId: RVC_STATE.ERROR })
        }
      })
    })
  }

  private async _handleGoHome(): Promise<any> {
    this._log.debug(`[Matter/${this.displayName}] goHome`)
    return new Promise<any>((resolve) => {
      this._connect(async (error, roomba) => {
        if (error || !roomba) {
          this._log.warn(`[Matter/${this.displayName}] Failed to dock: ${error?.message ?? 'Unknown'}`)
          resolve({ errorStateId: RVC_STATE.ERROR })
          return
        }
        try {
          await roomba.dock()
          this._log.debug(`[Matter/${this.displayName}] Docking`)
          this._schedulePoll(true)
          resolve({ errorStateId: 0 })
        } catch (err: any) {
          this._log.warn(`[Matter/${this.displayName}] Dock failed: ${err.message}`)
          resolve({ errorStateId: RVC_STATE.ERROR })
        }
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Private: start / stop helpers
  // ---------------------------------------------------------------------------

  private _startCleaning(): Promise<void> {
    return new Promise<void>((resolve) => {
      this._connect(async (error, roomba) => {
        if (error || !roomba) {
          this._log.warn(`[Matter/${this.displayName}] Failed to start: ${error?.message ?? 'Unknown'}`)
          resolve()
          return
        }
        try {
          if (this._cachedStatus.paused) {
            await roomba.resume()
            this._log.debug(`[Matter/${this.displayName}] Resumed from pause`)
          } else if (this._cleanBehaviour === 'rooms') {
            await roomba.cleanRoom(this._mission)
            this._log.debug(`[Matter/${this.displayName}] Cleaning rooms`)
          } else {
            await roomba.clean()
            this._log.debug(`[Matter/${this.displayName}] Cleaning everywhere`)
          }
          this._schedulePoll(true)
        } catch (err: any) {
          this._log.warn(`[Matter/${this.displayName}] Start failed: ${err.message}`)
        }
        resolve()
      })
    })
  }

  private _stopAndDock(): Promise<void> {
    return new Promise<void>((resolve) => {
      this._connect(async (error, roomba) => {
        if (error || !roomba) {
          this._log.warn(`[Matter/${this.displayName}] Failed to stop: ${error?.message ?? 'Unknown'}`)
          resolve()
          return
        }
        try {
          const state = await roomba.getRobotState(['cleanMissionStatus'])
          const parsed = this._parseState(state)

          if (parsed.running) {
            await roomba.pause()
            if (this._stopBehaviour === 'home') {
              await this._dockWhenStopped(roomba, 3000)
            }
          } else if (parsed.docking) {
            await roomba.pause()
          }
          this._schedulePoll(true)
        } catch (err: any) {
          this._log.warn(`[Matter/${this.displayName}] Stop failed: ${err.message}`)
        }
        resolve()
      })
    })
  }

  private async _dockWhenStopped(roomba: any, pollingInterval: number): Promise<void> {
    try {
      const state = await roomba.getRobotState(['cleanMissionStatus'])
      switch (state.cleanMissionStatus?.phase) {
        case 'stop':
          await roomba.dock()
          this._schedulePoll(true)
          break
        case 'run':
          await new Promise<void>(res => setTimeout(res, pollingInterval))
          await this._dockWhenStopped(roomba, pollingInterval)
          break
        default:
          break
      }
    } catch (err: any) {
      this._log.warn(`[Matter/${this.displayName}] Dock when stopped failed: ${err.message}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Roomba connection management
  // ---------------------------------------------------------------------------

  private async _connectedRoomba(attempts = 0): Promise<RoombaHolder> {
    return new Promise<RoombaHolder>((resolve, reject) => {
      let connected = false
      let failed = false

      const roomba = new dorita980.Local(this._blid, this._robotpwd, this._ipaddress, 2, {
        ciphers: ROBOT_CIPHERS[this._currentCipherIndex],
      })

      const timeout = setTimeout(() => {
        failed = true
        roomba.end()
        reject(new Error('Connect timed out'))
      }, CONNECT_TIMEOUT_MILLIS)

      roomba.on('state', (state: any) => {
        const parsed = this._parseState(state)
        this._mergeCachedStatus(parsed)
      })

      const onError = (error: Error) => {
        roomba.off('error', onError)
        roomba.end()
        clearTimeout(timeout)

        if (!connected) {
          failed = true
          if (this._shouldTryDifferentCipher(error) && attempts < ROBOT_CIPHERS.length) {
            this._currentCipherIndex = (this._currentCipherIndex + 1) % ROBOT_CIPHERS.length
            this._connectedRoomba(attempts + 1).then(resolve).catch(reject)
          } else {
            reject(error)
          }
        }
      }
      roomba.on('error', onError)

      const onConnect = () => {
        roomba.off('connect', onConnect)
        clearTimeout(timeout)

        if (failed) {
          return
        }

        connected = true
        resolve({ roomba, useCount: 0 })
      }
      roomba.on('connect', onConnect)
    })
  }

  private _connect(callback: (error: Error | null, roomba?: any) => Promise<void>): void {
    const promise = this._currentRoombaPromise ?? this._connectedRoomba()
    this._currentRoombaPromise = promise

    promise.then((holder) => {
      holder.useCount++
      callback(null, holder.roomba).finally(() => {
        holder.useCount--
        if (holder.useCount <= 0) {
          this._currentRoombaPromise = undefined
          holder.roomba.end()
        }
      })
    }).catch((error) => {
      this._currentRoombaPromise = undefined
      callback(error)
    })
  }

  // ---------------------------------------------------------------------------
  // Private: state parsing
  // ---------------------------------------------------------------------------

  private _parseState(state: any): Partial<RoombaStatus> {
    const status: Partial<RoombaStatus> = { timestamp: Date.now() }

    if (state.batPct !== undefined) {
      status.batteryLevel = state.batPct
    }
    if (state.bin !== undefined) {
      status.binFull = state.bin.full
    }

    if (state.cleanMissionStatus !== undefined) {
      switch (state.cleanMissionStatus.phase) {
        case 'run':
          status.running = true
          status.charging = false
          status.docking = false
          status.docked = false
          break
        case 'charge':
        case 'recharge':
          status.running = false
          // The Roomba keeps reporting the 'charge' phase while docked even once
          // fully charged, so treat a full battery as done charging (#223)
          status.charging = status.batteryLevel === undefined || status.batteryLevel < 100
          status.docking = false
          // Still on the dock either way, which is what Matter wants to know (#228)
          status.docked = true
          break
        case 'hmUsrDock':
        case 'hmMidMsn':
        case 'hmPostMsn':
          status.running = false
          status.charging = false
          status.docking = true
          status.docked = false
          break
        case 'stop':
        case 'stuck':
        case 'evac':
        default:
          status.running = false
          status.charging = false
          status.docking = false
          status.docked = false
          break
      }
      // Only treat the Roomba as paused when it is genuinely stopped part-way
      // through a clean. Previously any non-running state with a 'clean' cycle
      // counted as paused, so a Roomba that had finished and returned to the dock
      // was reported as "Paused" instead of docked/idle (#226).
      status.paused = state.cleanMissionStatus.phase === 'stop' && state.cleanMissionStatus.cycle === 'clean'
      // Surface a stuck Roomba as an error so it can be told apart from a job
      // that finished successfully (#226).
      status.stuck = state.cleanMissionStatus.phase === 'stuck'
      // The cycle only drops to 'none' once the job is genuinely over, so this
      // stays true while the Roomba is emptying into its dock or recharging
      // part-way through a clean, both of which look idle from the phase alone.
      // Polling has to stay quick through those, or a Roomba that resumes
      // cleaning is not noticed until the next idle poll - up to 15 minutes of
      // HomeKit insisting it is not cleaning while it is (#226).
      status.missionActive = state.cleanMissionStatus.cycle !== 'none'

      // Log the full mission status alongside the flags it maps to. A Roomba
      // that is physically still cleaning but shows "ready" or "charging" in
      // HomeKit needs the extra fields (rechrgM = minutes until a mid-mission
      // recharge finishes, notReady, batPct) to tell a genuinely finished job
      // apart from a recharge-and-resume, and to check the battery reading
      // against what the iRobot app shows (#226).
      this._log.debug(
        `[Matter/${this.displayName}] cleanMissionStatus=${JSON.stringify(state.cleanMissionStatus)} `
        + `batPct=${state.batPct} `
        + `-> running=${!!status.running} paused=${!!status.paused} docking=${!!status.docking} `
        + `charging=${!!status.charging} stuck=${!!status.stuck}`,
      )
    }

    return status
  }

  private _mergeCachedStatus(status: Partial<RoombaStatus>): void {
    this._cachedStatus = {
      ...this._cachedStatus,
      timestamp: Date.now(),
      ...status,
    }

    if (this._cachedStatus.running || this._cachedStatus.docking) {
      this._roombaLastActiveTimestamp = Date.now()
    }

    // Push the updated state to Matter
    this._pushMatterState(this._cachedStatus)
  }

  // ---------------------------------------------------------------------------
  // Private: Matter state pushing
  // ---------------------------------------------------------------------------

  private _pushMatterState(status: RoombaStatus): void {
    const matterApi = (this._api as any).matter
    if (!matterApi?.updateAccessoryState) {
      return
    }

    // Determine operational state and run mode
    let operationalState: number
    let runMode: number

    if (status.running) {
      operationalState = RVC_STATE.RUNNING
      runMode = RVC_RUN_MODE.CLEANING
    } else if (status.stuck) {
      operationalState = RVC_STATE.ERROR
      runMode = RVC_RUN_MODE.IDLE
    } else if (status.docking) {
      operationalState = RVC_STATE.SEEKING_CHARGER
      runMode = RVC_RUN_MODE.IDLE
    } else if (status.paused) {
      operationalState = RVC_STATE.PAUSED
      runMode = RVC_RUN_MODE.IDLE
    } else if (status.charging) {
      operationalState = RVC_STATE.CHARGING
      runMode = RVC_RUN_MODE.IDLE
    } else if (status.docked) {
      // ⚠️ Must come after `charging` and before the fallback. `charging` goes
      // false once the battery hits 100% (#223), so without this branch a
      // Roomba sat fully charged on its dock reported as Stopped - it was the
      // only state Home ever saw it in, and DOCKED was declared in
      // operationalStateList but never actually assigned (#228).
      operationalState = RVC_STATE.DOCKED
      runMode = RVC_RUN_MODE.IDLE
    } else {
      operationalState = RVC_STATE.STOPPED
      runMode = RVC_RUN_MODE.IDLE
    }

    try {
      matterApi.updateAccessoryState(this.UUID, 'rvcOperationalState', { operationalState })
        .catch((e: any) => this._log.debug(`[Matter/${this.displayName}] State push error: ${e?.message}`))
      matterApi.updateAccessoryState(this.UUID, 'rvcRunMode', { currentMode: runMode })
        .catch((e: any) => this._log.debug(`[Matter/${this.displayName}] State push error: ${e?.message}`))

      if (status.batteryLevel !== undefined) {
        // Matter uses 0–200 for battery percentage (0.5% increments)
        const batPercentRemaining = Math.round(status.batteryLevel * 2)
        const batChargeLevel = status.batteryLevel <= 5 ? 2 : status.batteryLevel <= 15 ? 1 : 0
        matterApi.updateAccessoryState(this.UUID, 'powerSource', { batPercentRemaining, batChargeLevel })
          .catch((e: any) => this._log.debug(`[Matter/${this.displayName}] Battery push error: ${e?.message}`))
      }
    } catch (e: any) {
      this._log.debug(`[Matter/${this.displayName}] State push failed: ${e?.message}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Private: polling
  // ---------------------------------------------------------------------------

  private _schedulePoll(adhoc: boolean): void {
    if (!this._started) {
      return
    }

    const now = Date.now()

    // Every ad-hoc poll follows a command we just sent. Record that, so the
    // interval stays short while the Roomba actually acts on it — the refresh
    // below almost always still sees the pre-command state (#226).
    if (adhoc) {
      this._lastCommandTimestamp = now
    }

    if (adhoc && now - this._lastRefreshState < REFRESH_STATE_COALESCE_MILLIS) {
      return
    }

    if (this._pollTimeout) {
      clearTimeout(this._pollTimeout)
      this._pollTimeout = undefined
    }

    this._lastRefreshState = now
    this._refreshState(() => {
      const interval = this._pollInterval()
      this._pollTimeout = setTimeout(() => this._schedulePoll(false), interval)
    })
  }

  private _refreshState(callback: (success: boolean) => void): void {
    this._connect(async (error, roomba) => {
      if (error || !roomba) {
        this._log.debug(`[Matter/${this.displayName}] Failed to refresh state: ${error?.message ?? 'Unknown'}`)
        callback(false)
        return
      }

      return new Promise<void>((resolve) => {
        let finished = false

        const finish = (success: boolean) => {
          if (finished) {
            return
          }
          finished = true
          // eslint-disable-next-line ts/no-use-before-define
          clearTimeout(timeout)
          // eslint-disable-next-line ts/no-use-before-define
          roomba.off('state', onState)
          resolve()
          callback(success)
        }

        const timeout = setTimeout(() => {
          finish(false)
        }, STATUS_TIMEOUT_MILLIS)

        const onState = (state: any) => {
          const parsed = this._parseState(state)
          if (parsed.batteryLevel !== undefined && parsed.charging !== undefined && parsed.running !== undefined) {
            finish(true)
          }
        }
        roomba.on('state', onState)
      })
    })
  }

  private _pollInterval(): number {
    const now = Date.now()
    const timeSinceLastActive = now - (this._roombaLastActiveTimestamp ?? 0)
    const timeSinceLastCommand = now - (this._lastCommandTimestamp ?? Number.NEGATIVE_INFINITY)
    const isActive = this._cachedStatus.running || this._cachedStatus.docking || this._cachedStatus.missionActive

    if (isActive || timeSinceLastActive < AFTER_ACTIVE_MILLIS || timeSinceLastCommand < AFTER_COMMAND_MILLIS) {
      return 10_000
    }
    return this._idlePollIntervalMillis
  }

  // ---------------------------------------------------------------------------
  // Private: helpers
  // ---------------------------------------------------------------------------

  private _getSerialNum(device: Robot & DeviceConfig): string {
    if (device.info?.serialNum) {
      return device.info.serialNum
    }
    return device.ipaddress ?? device.ip ?? device.blid
  }

  private _shouldTryDifferentCipher(error: Error): boolean {
    if (error.message.includes('TLS')) {
      return true
    }
    if (error.message.toLowerCase().includes('identifier rejected')) {
      return true
    }
    return false
  }
}
