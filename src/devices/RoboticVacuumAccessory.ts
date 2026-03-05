/* global NodeJS */

import type { RobotState } from 'dorita980'
import type { API, Logger, MatterRequests } from 'homebridge'

import type { IRoombaClient } from '../roomba-client/IRoombaClient.js'
import type { DeviceConfig, RoombaPlatformConfig } from '../settings.js'

import { createRoombaClient } from '../roomba-client/factory.js'
import { BaseMatterAccessory } from './BaseMatterAccessory.js'

//

export class RoboticVacuumAccessory extends BaseMatterAccessory {
  private pollInterval?: NodeJS.Timeout
  private client: IRoombaClient
  private lastErrorCode?: number
  private lastPose?: { x: number, y: number, theta: number }

  constructor(
    api: API,
    log: Logger,
    private readonly device: DeviceConfig,
    private readonly platformConfig: RoombaPlatformConfig,
    pollIntervalMs?: number,
  ) {
    const serialNumber = device.serialnum || device.info?.serialNum || device.blid || device.ipaddress || 'ROOMBA-001'
    const displayName = device.name || 'Roomba'
    const manufacturer = 'iRobot'
    const model = device.model || 'HB-MATTER-ROOMBA'
    const firmwareRevision = device.softwareVer || '0.0.0'

    super(api, log, {
      uuid: api.matter.uuid.generate(device.blid),
      displayName,
      deviceType: api.matter.deviceTypes.RoboticVacuumCleaner,
      serialNumber,
      manufacturer,
      model,
      firmwareRevision,
      hardwareRevision: '1.0.0',
      context: {
        serialNumber,
        name: displayName,
        model,
        blid: device.blid,
        ipaddress: device.ipaddress,
        pollIntervalMs: typeof pollIntervalMs === 'number' ? pollIntervalMs : null,
      },
      clusters: {
        // Run Mode: Idle/Cleaning (basic)
        rvcRunMode: {
          supportedModes: [
            { label: 'Idle', mode: 0, modeTags: [{ value: 16384 }] },
            { label: 'Cleaning', mode: 1, modeTags: [{ value: 16385 }] },
          ],
          currentMode: 0,
        },
        // Clean Mode: basic Vacuum
        rvcCleanMode: {
          supportedModes: [
            { label: 'Vacuum', mode: 0, modeTags: [{ value: 16385 }] },
          ],
          currentMode: 0,
        },
        // Operational state
        rvcOperationalState: {
          operationalStateList: [
            { operationalStateId: 0 }, // stopped
            { operationalStateId: 1 }, // running
            { operationalStateId: 2 }, // paused
            { operationalStateId: 3 }, // error
            { operationalStateId: 64 }, // seeking charger
            { operationalStateId: 65 }, // charging
            { operationalStateId: 66 }, // docked
          ],
          operationalState: 66,
        },
        // Service Area: optional, leave empty unless rooms specified
        serviceArea: {
          supportedMaps: [],
          supportedAreas: [],
          selectedAreas: [],
        },
      },
      handlers: {
        rvcRunMode: {
          changeToMode: async (request: MatterRequests.ChangeToMode) => this.handleChangeRunMode(request),
        },
        rvcCleanMode: {
          changeToMode: async () => { /* keep current */ },
        },
        rvcOperationalState: {
          pause: async () => this.handlePause(),
          stop: async () => this.handleStop(),
          start: async () => this.handleStart(),
          resume: async () => this.handleResume(),
          goHome: async () => this.handleGoHome(),
        },
        serviceArea: {
          selectAreas: async () => { /* optional */ },
          skipArea: async () => { /* optional */ },
        },
      },
      clusterNameMap: {
        // Allow legacy 'power'/'diagnostics' to map via BaseMatterAccessory
      },
    })

    // Create client and start polling
    this.client = createRoombaClient(device, log, platformConfig)
    const pollMs = typeof pollIntervalMs === 'number' ? pollIntervalMs : Math.max(0, Math.floor((platformConfig.idleWatchInterval || 15) * 60_000))
    if (pollMs > 0) {
      this.startPolling(pollMs)
    }

    this.logInfo('initialized and ready.')
  }

  public stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = undefined
    }
  }

  private startPolling(intervalMs = 30_000) {
    if (this.pollInterval) {
      return
    }
    this.pollInterval = setInterval(async () => {
      try {
        const state = await this.client.getRobotState(['batPct', 'bin', 'cleanMissionStatus', 'pose'])
        this.updateFromRobotState(state as RobotState)
      } catch (e) {
        this.logDebug('Polling error:', e)
      }
    }, intervalMs)
  }

  private updateFromRobotState(state: RobotState) {
    try {
      // Battery + charging (legacy power mapping will translate charging to op state when possible)
      if (typeof state.batPct !== 'undefined') {
        const charging = state.cleanMissionStatus?.phase === 'charge' || state.cleanMissionStatus?.phase === 'recharge'
        this.updateState('power', { batteryLevel: state.batPct, charging })
      }

      // Error and not-ready handling
      const cms = state.cleanMissionStatus as any
      const errorCode: number | undefined = cms?.error
      const notReady: Record<string, unknown> | undefined = cms?.notReady
      if (typeof errorCode === 'number' && errorCode > 0) {
        // Persist and publish error state
        this.lastErrorCode = errorCode
        void this.updateState('diagnostics', { errorCode })
        this.updateRunMode(0)
        this.updateOperationalState(3) // Error
        return
      }

      if (notReady && Object.values(notReady).some(Boolean)) {
        // Treat any notReady condition (e.g., bin full) as Paused
        this.updateRunMode(1) // still considered a cleaning session
        this.updateOperationalState(2) // Paused
        return
      }

      // Bin-only signal (fallback if notReady not provided)
      if ((state as any)?.bin?.full === true) {
        this.updateRunMode(1)
        this.updateOperationalState(2)
        return
      }

      // Operational state and run mode mapping
      const phase = state.cleanMissionStatus?.phase
      if (phase) {
        if (phase === 'run') {
          this.updateRunMode(1)
          this.updateOperationalState(1)
        } else if (phase === 'pause') {
          this.updateRunMode(1)
          this.updateOperationalState(2) // paused
        } else if (phase === 'charge' || phase === 'recharge') {
          this.updateRunMode(0)
          // If essentially full, mark docked; else charging
          const bat = typeof state.batPct === 'number' ? state.batPct : 0
          this.updateOperationalState(bat >= 99 ? 66 : 65)
        } else if (phase === 'hmUsrDock' || phase === 'hmMidMsn' || phase === 'hmPostMsn') {
          this.updateRunMode(0)
          this.updateOperationalState(64) // seeking
        } else if (phase === 'stuck') {
          this.updateRunMode(0)
          this.updateOperationalState(3) // error: stuck
        } else if (phase === 'stop' || phase === 'evac') {
          this.updateRunMode(0)
          this.updateOperationalState(0) // stopped
        }
      }

      // Pose tracking (x, y, theta)
      const x = (state as any)?.pose?.point?.x
      const y = (state as any)?.pose?.point?.y
      const theta = (state as any)?.pose?.theta
      if (
        typeof x === 'number' && typeof y === 'number' && typeof theta === 'number'
        && (!this.lastPose || this.lastPose.x !== x || this.lastPose.y !== y || this.lastPose.theta !== theta)
      ) {
        this.lastPose = { x, y, theta }
        this.logDebug(`Pose updated: x=${x}, y=${y}, theta=${theta}`)
      }
    } catch (e) {
      this.logDebug('Error mapping robot state:', e)
    }
  }

  private async handleChangeRunMode(request: MatterRequests.ChangeToMode): Promise<void> {
    const { newMode } = request
    this.logInfo(`ChangeToMode (run) -> ${newMode}`)
    if (newMode === 1) {
      await this.handleStart()
    } else if (newMode === 0) {
      await this.handleStop()
    }
  }

  private async handlePause(): Promise<void> {
    this.logInfo('pausing')
    await this.client.pause()
    this.updateOperationalState(2)
  }

  private async handleStop(): Promise<void> {
    this.logInfo('stopping')
    try {
      const state = await this.client.getRobotState(['cleanMissionStatus'])
      const phase = (state as RobotState).cleanMissionStatus?.phase
      if (phase === 'run' || phase === 'hmUsrDock' || phase === 'hmMidMsn') {
        await this.client.pause()
      }
    } catch {
      // ignore
    }
    this.updateRunMode(0)
    this.updateOperationalState(0)
  }

  private async handleStart(): Promise<void> {
    this.logInfo('starting')
    // Start a room mission if configured, else everywhere
    if (this.device.cleanBehaviour === 'rooms' && this.device.mission) {
      await this.client.cleanRoom(this.device.mission)
    } else {
      await this.client.clean()
    }
    this.updateRunMode(1)
    this.updateOperationalState(1)
  }

  private async handleResume(): Promise<void> {
    this.logInfo('resuming')
    await this.client.resume()
    this.updateRunMode(1)
    this.updateOperationalState(1)
  }

  private async handleGoHome(): Promise<void> {
    this.logInfo('goHome')
    await this.client.dock()
    // Seeking -> Charging -> Docked transitions are handled by polling/state updates
    this.updateRunMode(0)
  }

  // Public update helpers mirroring SharkIQ pattern
  public updateOperationalState(state: number): void {
    void this.updateState('rvcOperationalState', { operationalState: state })
  }

  public updateRunMode(mode: number): void {
    void this.updateState('rvcRunMode', { currentMode: mode })
  }

  // Client timeout constant retained for parity
}
