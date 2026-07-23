import type { RobotMission, RobotState, Roomba } from 'dorita980'
import type { AccessoryPlugin, API, CharacteristicGetCallback, CharacteristicSetCallback, CharacteristicValue, Logging, PlatformAccessory, Service, WithUUID } from 'homebridge'

import type RoombaPlatform from './Platform.HAP.js'
import type { DeviceInfo, Robot } from './roomba.js'
import type { DeviceConfig, RoombaPlatformConfig } from './settings.js'

import dorita980 from 'dorita980'

/**
 * How long to wait to connect to Roomba.
 */
const CONNECT_TIMEOUT_MILLIS = 60_000

/**
 * How long after HomeKit has asked for the plugin's status should we continue frequently monitoring and reporting Roomba's status?
 */
const USER_INTERESTED_MILLIS = 60_000

/**
 * How long after Roomba has been active should we continue frequently monitoring and reporting Roomba's status?
 */
const AFTER_ACTIVE_MILLIS = 120_000

/**
 * How long will we wait for the Roomba to send status before giving up?
 */
const STATUS_TIMEOUT_MILLIS = 60_000

/**
 * Coalesce multiple refreshState requests into one when they're less than this many millis apart.
 */
const REFRESH_STATE_COALESCE_MILLIS = 10_000

const ROBOT_CIPHERS = ['AES128-SHA256', 'TLS_AES_256_GCM_SHA384']

/**
 * Holds a connection to Roomba and tracks the number of uses to enable connections to be closed
 * when no longer in use.
 */
interface RoombaHolder {
  readonly roomba: Roomba
  /**
   * How many requests are currently using the current Roomba instance.
   */
  useCount: number
}

interface Status {
  timestamp: number
  running?: boolean
  docking?: boolean
  charging?: boolean
  /**
   * Paused during a clean cycle.
   */
  paused?: boolean
  batteryLevel?: number
  binFull?: boolean
  tankLevel?: number
}

const EMPTY_STATUS: Status = {
  timestamp: 0,
}

type CharacteristicGetter = (callback: CharacteristicGetCallback, context: unknown, connection?: unknown) => void

type CharacteristicValueExtractor = (status: Status) => CharacteristicValue | undefined

const NO_VALUE = new Error('No value')

async function delay(duration: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration)
  })
}

export default class RoombaAccessory implements AccessoryPlugin {
  private api: API
  private log: Logging
  private name: string
  private model: string
  private serialnum!: string
  private blid: string
  private robotpwd: string
  private ipaddress: string
  private cleanBehaviour: 'everywhere' | 'rooms'
  private mission: RobotMission
  private stopBehaviour: 'home' | 'pause'
  private debug: boolean
  private idlePollIntervalMillis: number
  private deviceInfo?: DeviceInfo
  private version: string

  private accessoryInfo: Service
  private filterMaintenance: Service
  private switchService: Service
  private batteryService: Service
  private dockService?: Service
  private runningService?: Service
  private binService?: Service
  private dockingService?: Service
  private homeService?: Service
  private tankService?: Service

  /**
   * The last known state from Roomba, if any.
   */
  private cachedStatus = EMPTY_STATUS

  private lastUpdatedStatus = EMPTY_STATUS

  private lastRefreshState = 0

  /**
   * The current promise that returns a Roomba instance (_only_ used in the connect() method).
   */
  private _currentRoombaPromise?: Promise<RoombaHolder>

  /**
   * Whether the plugin is actively polling Roomba's state and updating HomeKit
   */
  private currentPollTimeout?: ReturnType<typeof setTimeout>

  /**
   * When we think a user / HomeKit was last interested in Roomba's state.
   */
  private userLastInterestedTimestamp?: number

  /**
   * When we last saw the Roomba active.
   */
  private roombaLastActiveTimestamp?: number

  /**
   * The duration of the last poll interval used.
   */
  private lastPollInterval?: number

  /**
   * An index into `ROBOT_CIPHERS` indicating the current cipher configuration used to communicate with Roomba.
   */
  private currentCipherIndex = 0

  public constructor(
    readonly platform: RoombaPlatform,
    accessory: PlatformAccessory,
    log: Logging,
    device: Robot & DeviceConfig,
    config: RoombaPlatformConfig,
    api: API,
  ) {
    this.api = api
    this.log = log
    this.debug = !!config.debug

    if (!this.debug) {
      this.log = log
    } else {
      this.log = Object.assign(log, {
        debug: (message: string, ...parameters: unknown[]) => {
          log.info(`DEBUG: ${message}`, ...parameters)
        },
      })
    }

    this.name = device.name
    this.model = device.model
    const { serialNumber, deviceInfo } = this.serialNum(device)
    this.deviceInfo = deviceInfo
    this.serialnum = serialNumber
    this.blid = device.blid
    this.robotpwd = device.password
    this.ipaddress = device.ipaddress ?? device.ip
    this.version = device.softwareVer ?? this.platform.version ?? '0.0.0'
    this.cleanBehaviour = device.cleanBehaviour !== undefined ? device.cleanBehaviour : 'everywhere'
    this.mission = device.mission || { pmap_id: 'local' }
    this.stopBehaviour = device.stopBehaviour !== undefined ? device.stopBehaviour : 'home'
    this.idlePollIntervalMillis = device.idleWatchInterval ? (device.idleWatchInterval * 60_000) : config.idleWatchInterval ? (config.idleWatchInterval * 60_000) : 900_000
    const showDockAsContactSensor = device.dockContactSensor === undefined ? true : device.dockContactSensor
    const showRunningAsContactSensor = device.runningContactSensor
    const showBinStatusAsContactSensor = device.binContactSensor
    const showDockingAsContactSensor = device.dockingContactSensor
    const showHomeSwitch = device.homeSwitch
    const showTankAsFilterMaintenance = device.tankContactSensor

    const Service = api.hap.Service
    const Characteristic = this.api.hap.Characteristic

    function removeServiceIfPresent<T extends WithUUID<typeof Service>>(uuid: string | T, subType: string): void {
      const service = accessory.getServiceById(uuid, subType)
      if (service) {
        accessory.removeService(service)
      }
    }

    this.accessoryInfo = accessory.getService(Service.AccessoryInformation) || accessory.addService(Service.AccessoryInformation)
    this.filterMaintenance = accessory.getService(Service.FilterMaintenance) || accessory.addService(Service.FilterMaintenance)
    this.switchService = accessory.getService(this.name) || accessory.addService(Service.Switch, this.name)
    this.switchService.setPrimaryService(true)
    this.batteryService = accessory.getService(Service.Battery) || accessory.addService(Service.Battery)

    const DOCK_SERVICE_NAME = `${this.name} Dock`
    const RUNNING_SERVICE_NAME = `${this.name} Running`
    const BIN_SERVICE_NAME = `${this.name} Bin Full`
    const DOCKING_SERVICE_NAME = `${this.name} Docking`
    const TANK_SERVICE_NAME = `${this.name} Water Tank Empty`
    const HOME_SERVICE_NAME = `${this.name} Home`

    if (showDockAsContactSensor) {
      this.dockService = accessory.getServiceById(Service.ContactSensor, 'docked') || accessory.addService(Service.ContactSensor, DOCK_SERVICE_NAME, 'docked')
    } else {
      removeServiceIfPresent(Service.ContactSensor, 'docked')
    }
    if (showRunningAsContactSensor) {
      this.runningService = accessory.getServiceById(Service.ContactSensor, 'running') || accessory.addService(Service.ContactSensor, RUNNING_SERVICE_NAME, 'running')
    } else {
      removeServiceIfPresent(Service.ContactSensor, 'running')
    }
    if (showBinStatusAsContactSensor) {
      this.binService = accessory.getServiceById(Service.ContactSensor, 'Full') || accessory.addService(Service.ContactSensor, BIN_SERVICE_NAME, 'Full')
    } else {
      removeServiceIfPresent(Service.ContactSensor, 'Full')
    }
    if (showDockingAsContactSensor) {
      this.dockingService = accessory.getServiceById(Service.ContactSensor, 'docking') || accessory.addService(Service.ContactSensor, DOCKING_SERVICE_NAME, 'docking')
    } else {
      removeServiceIfPresent(Service.ContactSensor, 'docking')
    }
    if (showTankAsFilterMaintenance) {
      this.tankService = accessory.getServiceById(Service.FilterMaintenance, 'Empty') || accessory.addService(Service.FilterMaintenance, TANK_SERVICE_NAME, 'Empty')
    } else {
      removeServiceIfPresent(Service.FilterMaintenance, 'Empty')
    }
    if (showHomeSwitch) {
      this.homeService = accessory.getServiceById(Service.Switch, 'returning') || accessory.addService(Service.Switch, HOME_SERVICE_NAME, 'returning')
    } else {
      removeServiceIfPresent(Service.Switch, 'returning')
    }

    // Set accessory information
    this.accessoryInfo
      .setCharacteristic(Characteristic.Manufacturer, 'iRobot')
      .setCharacteristic(Characteristic.AppMatchingIdentifier, 'id1012014442')
      .setCharacteristic(Characteristic.SerialNumber, this.serialnum)
      .setCharacteristic(Characteristic.Identify, true)
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.ProductData, this.blid)
      .setCharacteristic(Characteristic.FirmwareRevision, this.version)

    this.switchService
      .setCharacteristic(Characteristic.Name, this.name)
      .getCharacteristic(Characteristic.On)
      .on('set', this.setRunningState.bind(this))
      .on('get', this.createCharacteristicGetter('Running status', this.runningStatus))
    this.batteryService
      .getCharacteristic(Characteristic.BatteryLevel)
      .on('get', this.createCharacteristicGetter('Battery level', this.batteryLevelStatus))
    this.batteryService
      .getCharacteristic(Characteristic.ChargingState)
      .on('get', this.createCharacteristicGetter('Charging status', this.chargingStatus))
    this.batteryService
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on('get', this.createCharacteristicGetter('Low Battery status', this.batteryStatus))
    this.filterMaintenance
      .getCharacteristic(Characteristic.FilterChangeIndication)
      .on('get', this.createCharacteristicGetter('Bin status', this.binStatus))

    if (this.dockService) {
      this.dockService
        .setCharacteristic(Characteristic.Name, DOCK_SERVICE_NAME)
        .getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.createCharacteristicGetter('Dock status', this.dockedStatus))
    }
    if (this.runningService) {
      this.runningService
        .setCharacteristic(Characteristic.Name, RUNNING_SERVICE_NAME)
        .getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.createCharacteristicGetter('Running status', this.runningStatus))
    }
    if (this.binService) {
      this.binService
        .setCharacteristic(Characteristic.Name, BIN_SERVICE_NAME)
        .getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.createCharacteristicGetter('Bin status', this.binStatus))
    }
    if (this.dockingService) {
      this.dockingService
        .setCharacteristic(Characteristic.Name, DOCKING_SERVICE_NAME)
        .getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.createCharacteristicGetter('Docking status', this.dockingStatus))
    }
    if (this.homeService) {
      this.homeService
        .setCharacteristic(Characteristic.Name, HOME_SERVICE_NAME)
        .getCharacteristic(Characteristic.On)
        .on('set', this.setDockingState.bind(this))
        .on('get', this.createCharacteristicGetter('Returning Home', this.dockingStatus))
    }
    if (this.tankService) {
      this.tankService
        .setCharacteristic(Characteristic.Name, TANK_SERVICE_NAME)
        .getCharacteristic(Characteristic.FilterChangeIndication)
        .on('get', this.createCharacteristicGetter('Tank status', this.tankStatus))
      this.tankService
        .getCharacteristic(Characteristic.FilterLifeLevel)
        .on('get', this.createCharacteristicGetter('Tank level', this.tankLevelStatus))
    }

    this.startPolling()
  }

  private serialNum(device: Robot & DeviceConfig) {
    let deviceInfo: DeviceInfo | undefined
    let serialNumber: string
    const serialNum = device.ipaddress ?? device.ip
    if (device.info) {
      deviceInfo = device.info
      if (device.info.serialNum) {
        serialNumber = device.info.serialNum
        return { serialNumber, deviceInfo }
      } else {
        serialNumber = serialNum
        return { serialNumber, deviceInfo }
      }
    } else {
      deviceInfo = undefined
      serialNumber = serialNum
      return { serialNumber, deviceInfo }
    }
  }

  public identify() {
    this.log.info('Identify requested')
    this.connect(async (error, roomba) => {
      if (error || !roomba) {
        return
      }
      try {
        await roomba.find()
      } catch (error) {
        this.log.warn('Roomba failed to locate: %s', (error as Error).message)
      }
    })
  }

  public getServices(): Service[] {
    const services: Service[] = [
      this.accessoryInfo,
      this.switchService,
      this.batteryService,
      this.filterMaintenance,
    ]

    if (this.dockService) {
      services.push(this.dockService)
    }
    if (this.runningService) {
      services.push(this.runningService)
    }
    if (this.binService) {
      services.push(this.binService)
    }
    if (this.dockingService) {
      services.push(this.dockingService)
    }
    if (this.homeService) {
      services.push(this.homeService)
    }
    if (this.tankService) {
      services.push(this.tankService)
    }

    return services
  }

  /**
   * Refresh our knowledge of Roomba's state by connecting to Roomba and getting its status.
   * @param callback a function to call when the state refresh has completed.
   */
  private refreshState(callback: (success: boolean) => void): void {
    const now = Date.now()

    this.connect(async (error, roomba) => {
      if (error || !roomba) {
        this.log.warn('Failed to refresh Roomba\'s state: %s', error ? error.message : 'Unknown')
        callback(false)
        return
      }

      const startedWaitingForStatus = Date.now()

      /* Wait until we've received a state with all of the information we desire */
      return new Promise<void>((resolve) => {
        let receivedState: RobotState | undefined

        const timeout = setTimeout(() => {
          this.log.debug(
            'Timeout waiting for full state from Roomba ({}ms). Last state received was: %s',
            Date.now() - startedWaitingForStatus,
            receivedState ? JSON.stringify(receivedState) : '<none>',
          )
          resolve()
          callback(false)
        }, STATUS_TIMEOUT_MILLIS)

        const updateState = (state: RobotState) => {
          receivedState = state

          if (this.receivedRobotStateIsComplete(state)) {
            clearTimeout(timeout)

            /* NB: the actual state is received and updated in the listener in connect() */
            this.log.debug(
              'Refreshed Roomba\'s state in %ims: %s',
              Date.now() - now,
              JSON.stringify(state),
            )

            roomba.off('state', updateState)
            resolve()
            callback(true)
          }
        }
        roomba.on('state', updateState)
      })
    })
  }

  private receivedRobotStateIsComplete(state: RobotState) {
    return (state.batPct !== undefined && state.bin !== undefined && state.cleanMissionStatus !== undefined)
  }

  private receiveRobotState(state: RobotState) {
    const parsed = this.parseState(state)
    this.mergeCachedStatus(parsed)

    return true
  }

  /**
   * Returns a Promise that, when resolved, provides access to a connected Roomba instance.
   * In order to reuse connected Roomba instances, this function returns the same Promise across
   * multiple calls, until that Roomba instance is disconnected.
   * <p>
   * If the Promise fails it means there was a failure connecting to the Roomba instance.
   * @returns a RoombaHolder containing a connected Roomba instance
   */
  private async connectedRoomba(attempts = 0): Promise<RoombaHolder> {
    return new Promise<RoombaHolder>((resolve, reject) => {
      let connected = false
      let failed = false

      const roomba = new dorita980.Local(this.blid, this.robotpwd, this.ipaddress, 2, {
        ciphers: ROBOT_CIPHERS[this.currentCipherIndex],
      })

      const startConnecting = Date.now()
      const timeout = setTimeout(() => {
        failed = true

        this.log.debug('Timed out after %ims trying to connect to Roomba', Date.now() - startConnecting)

        roomba.end()
        reject(new Error('Connect timed out'))
      }, CONNECT_TIMEOUT_MILLIS)

      roomba.on('state', (state) => {
        this.receiveRobotState(state)
      })

      const onError = (error: Error) => {
        this.log.debug('Connection received error: %s', error.message)

        roomba.off('error', onError)
        roomba.end()
        clearTimeout(timeout)

        if (!connected) {
          failed = true

          /* Check for recoverable errors */
          if (error instanceof Error && shouldTryDifferentCipher(error) && attempts < ROBOT_CIPHERS.length) {
            /* Perhaps a cipher error, so we retry using the next cipher */
            this.currentCipherIndex = (this.currentCipherIndex + 1) % ROBOT_CIPHERS.length
            this.log.debug('Retrying connection to Roomba with cipher %s', ROBOT_CIPHERS[this.currentCipherIndex])
            this.connectedRoomba(attempts + 1).then(resolve).catch(reject)
          } else {
            reject(error)
          }
        }
      }
      roomba.on('error', onError)

      this.log.debug('Connecting to Roomba...')

      const onConnect = () => {
        roomba.off('connect', onConnect)
        clearTimeout(timeout)

        if (failed) {
          this.log.debug('Connection established to Roomba after failure')
          return
        }

        connected = true

        this.log.debug('Connected to Roomba in %ims', Date.now() - startConnecting)
        resolve({
          roomba,
          useCount: 0,
        })
      }
      roomba.on('connect', onConnect)
    })
  }

  private connect(callback: (error: Error | null, roomba?: Roomba) => Promise<void>): void {
    /* Use the current Promise, if possible, so we share the connected Roomba instance, whether
           it is already connected, or when it becomes connected.
         */
    this.log.debug('currentRoombaPromise: %s', this._currentRoombaPromise ? 'yes' : 'no')
    const promise = this._currentRoombaPromise || this.connectedRoomba()
    this._currentRoombaPromise = promise

    promise.then((holder) => {
      holder.useCount++
      callback(null, holder.roomba).finally(() => {
        holder.useCount--

        if (holder.useCount <= 0) {
          this._currentRoombaPromise = undefined
          holder.roomba.end()
        } else {
          this.log.debug('Leaving Roomba instance with %i ongoing requests', holder.useCount)
        }
      })
    }).catch((error) => {
      /* Failed to connect to Roomba */
      this._currentRoombaPromise = undefined
      callback(error)
    })
  }

  private setRunningState(powerOn: CharacteristicValue, callback: CharacteristicSetCallback) {
    if (powerOn) {
      this.log.info('Starting Roomba')

      this.connect(async (error, roomba) => {
        if (error || !roomba) {
          callback(error || new Error('Unknown error'))
          return
        }

        try {
          /* If Roomba is paused in a clean cycle we need to instruct it to resume instead, otherwise we just start a clean. */
          if (this.cachedStatus.paused) {
            await roomba.resume()
          } else {
            if (this.cleanBehaviour === 'rooms') {
              await roomba.cleanRoom(this.mission)
              this.log.debug('Roomba is cleaning your rooms')
            } else {
              await roomba.clean()
              this.log.debug('Roomba is running')
            }
          }

          callback()

          /* After sending an action to Roomba, we start polling to ensure HomeKit has up to date status */
          this.refreshStatusForUser()
        } catch (error) {
          this.log.warn('Roomba failed: %s', (error as Error).message)

          callback(error as Error)
        }
      })
    } else {
      this.log.info('Stopping Roomba')

      this.connect(async (error, roomba) => {
        if (error || !roomba) {
          callback(error || new Error('Unknown error'))
          return
        }

        try {
          const response = await roomba.getRobotState(['cleanMissionStatus'])
          const state = this.parseState(response)

          if (state.running) {
            this.log.debug('Roomba is pausing')

            await roomba.pause()

            callback()

            if (this.stopBehaviour === 'home') {
              this.log.debug('Roomba paused, returning to Dock')
              await this.dockWhenStopped(roomba, 3000)
            } else {
              this.log.debug('Roomba is paused')
            }
          } else if (state.docking) {
            this.log.debug('Roomba is docking')
            await roomba.pause()

            callback()

            this.log.debug('Roomba paused')
          } else if (state.charging) {
            this.log.debug('Roomba is already docked')
            callback()
          } else {
            this.log.debug('Roomba is not running')
            callback()
          }

          this.refreshStatusForUser()
        } catch (error) {
          this.log.warn('Roomba failed: %s', (error as Error).message)

          callback(error as Error)
        }
      })
    }
  }

  private setDockingState(docking: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.log.debug('Setting docking state to %s', JSON.stringify(docking))

    this.connect(async (error, roomba) => {
      if (error || !roomba) {
        callback(error || new Error('Unknown error'))
        return
      }

      try {
        if (docking) {
          await roomba.dock()
          this.log.debug('Roomba is docking')
        } else {
          await roomba.pause()
          this.log.debug('Roomba is paused')
        }

        callback()

        /* After sending an action to Roomba, we start polling to ensure HomeKit has up to date status */
        this.refreshStatusForUser()
      } catch (error) {
        this.log.warn('Roomba failed: %s', (error as Error).message)

        callback(error as Error)
      }
    })
  }

  private async dockWhenStopped(roomba: Roomba, pollingInterval: number) {
    try {
      const state = await roomba.getRobotState(['cleanMissionStatus'])

      switch (state.cleanMissionStatus!.phase) {
        case 'stop':
          this.log.debug('Roomba has stopped, issuing dock request')

          await roomba.dock()

          this.log.debug('Roomba docking')

          this.refreshStatusForUser()

          break
        case 'run':
          this.log.debug('Roomba is still running. Will check again in %is', pollingInterval / 1000)

          await delay(pollingInterval)

          this.log.debug('Trying to dock again...')
          await this.dockWhenStopped(roomba, pollingInterval)

          break
        default:
          this.log.debug('Roomba is not running')

          break
      }
    } catch (error) {
      this.log.warn('Roomba failed to dock: %s', (error as Error).message)
    }
  }

  /**
   * Creates as a Characteristic getter function that derives the CharacteristicValue from Roomba's status.
   */
  private createCharacteristicGetter(name: string, extractValue: CharacteristicValueExtractor): CharacteristicGetter {
    return (callback: CharacteristicGetCallback) => {
      /* Calculate the max age of cached information based on how often we're refreshing Roomba's status */
      const maxCacheAge = (this.lastPollInterval || 0) + STATUS_TIMEOUT_MILLIS * 2

      const returnCachedStatus = (status: Status) => {
        const value = extractValue(status)
        if (value === undefined) {
          this.log.debug('%s: Returning no value (%s old, max %s)', name, millisToString(Date.now() - status.timestamp!), millisToString(maxCacheAge))
          callback(NO_VALUE)
        } else {
          this.log.debug('%s: Returning %s (%s old, max %s)', name, String(value), millisToString(Date.now() - status.timestamp!), millisToString(maxCacheAge))
          callback(null, value)
        }
      }

      this.refreshStatusForUser()

      if (Date.now() - this.cachedStatus.timestamp < maxCacheAge) {
        returnCachedStatus(this.cachedStatus)
      } else {
        /* Wait a short period of time (not too long for Homebridge) for a value to be received by a status check so we can report it */
        setTimeout(() => {
          if (Date.now() - this.cachedStatus.timestamp < maxCacheAge) {
            returnCachedStatus(this.cachedStatus)
          } else {
            this.log.debug('%s: Returning no value due to timeout', name)
            callback(NO_VALUE)
          }
        }, 500)
      }
    }
  }

  /**
   * Merge in changes to the cached status, and update our characteristics so the plugin
   * preemptively reports state back to Homebridge.
   */
  private mergeCachedStatus(status: Partial<Status>) {
    this.setCachedStatus({
      ...this.cachedStatus,
      timestamp: Date.now(),
      ...status,
    })
    if (Object.keys(status).length > 1) {
      this.log.debug('Merged updated state %s => %s', JSON.stringify(status), JSON.stringify(this.cachedStatus))
    }

    if (this.isActive()) {
      this.roombaLastActiveTimestamp = Date.now()
    }
  }

  /**
   * Update the cached status and update our characteristics so the plugin preemptively
   * reports state back to Homebridge.
   */
  private setCachedStatus(status: Status) {
    this.cachedStatus = status
    this.updateCharacteristics(status)
  }

  private parseState(state: RobotState & { tankLvl?: number }) {
    const status: Status = {
      timestamp: Date.now(),
    }

    if (state.batPct !== undefined) {
      status.batteryLevel = state.batPct
    }
    if (state.bin !== undefined) {
      status.binFull = state.bin.full
    }
    if (state.tankLvl !== undefined) {
      status.tankLevel = state.tankLvl
    }

    if (state.cleanMissionStatus !== undefined) {
      /* See https://www.openhab.org/addons/bindings/irobot/ for a list of phases */
      switch (state.cleanMissionStatus.phase) {
        case 'run':
          status.running = true
          status.charging = false
          status.docking = false

          break
        case 'charge':
        case 'recharge':
          status.running = false
          // The Roomba keeps reporting the 'charge' phase while docked even once
          // fully charged, so treat a full battery as done charging (#223)
          status.charging = status.batteryLevel === undefined || status.batteryLevel < 100
          status.docking = false

          break
        case 'hmUsrDock':
        case 'hmMidMsn':
        case 'hmPostMsn':
          status.running = false
          status.charging = false
          status.docking = true

          break
        case 'stop':
        case 'stuck':
        case 'evac':
          status.running = false
          status.charging = false
          status.docking = false

          break
        default:
          this.log.warn('Unsupported phase: %s', state.cleanMissionStatus!.phase)

          status.running = false
          status.charging = false
          status.docking = false

          break
      }
      // Only paused when genuinely stopped part-way through a clean, so a Roomba
      // that finished and returned to the dock is not reported as paused (#226).
      status.paused = state.cleanMissionStatus.phase === 'stop' && state.cleanMissionStatus.cycle === 'clean'
    }

    return status
  }

  private updateCharacteristics(status: Status) {
    // this.log.debug("Updating characteristics for status: %s", JSON.stringify(status));

    const updateCharacteristic = (service: Service, characteristicId: typeof Characteristic.On, extractValue: CharacteristicValueExtractor) => {
      const value = extractValue(status)
      if (value !== undefined) {
        const previousValue = extractValue(this.lastUpdatedStatus)
        if (value !== previousValue) {
          this.log.debug(
            'Updating %s %s from %s to %s',
            service.displayName,
            service.getCharacteristic(characteristicId).displayName,
            String(previousValue),
            String(value),
          )
          service.updateCharacteristic(characteristicId, value)
        }
      }
    }

    const Characteristic = this.api.hap.Characteristic

    updateCharacteristic(this.switchService, Characteristic.On, this.runningStatus)
    updateCharacteristic(this.batteryService, Characteristic.ChargingState, this.chargingStatus)
    updateCharacteristic(this.batteryService, Characteristic.BatteryLevel, this.batteryLevelStatus)
    updateCharacteristic(this.batteryService, Characteristic.StatusLowBattery, this.batteryStatus)
    updateCharacteristic(this.filterMaintenance, Characteristic.FilterChangeIndication, this.binStatus)
    if (this.dockService) {
      updateCharacteristic(this.dockService, Characteristic.ContactSensorState, this.dockedStatus)
    }
    if (this.runningService) {
      updateCharacteristic(this.runningService, Characteristic.ContactSensorState, this.runningStatus)
    }
    if (this.binService) {
      updateCharacteristic(this.binService, Characteristic.ContactSensorState, this.binStatus)
    }
    if (this.dockingService) {
      updateCharacteristic(this.dockingService, Characteristic.ContactSensorState, this.dockingStatus)
    }
    if (this.homeService) {
      updateCharacteristic(this.homeService, Characteristic.On, this.dockingStatus)
    }
    if (this.tankService) {
      updateCharacteristic(this.tankService, Characteristic.FilterChangeIndication, this.tankStatus)
      updateCharacteristic(this.tankService, Characteristic.FilterLifeLevel, this.tankLevelStatus)
    }

    this.lastUpdatedStatus = {
      ...this.lastUpdatedStatus,
      ...status,
    }
  }

  /**
   * Trigger a refresh of Roomba's status for a user.
   */
  private refreshStatusForUser() {
    this.userLastInterestedTimestamp = Date.now()
    this.startPolling(true)
  }

  /**
   * Start polling Roomba's status and reporting updates to HomeKit.
   * We start polling whenever an event occurs, so we update HomeKit promptly
   * when the status changes.
   */
  private startPolling(adhoc?: boolean) {
    const checkStatus = (adhoc: boolean) => {
      const now = Date.now()
      if (!adhoc || now - this.lastRefreshState > REFRESH_STATE_COALESCE_MILLIS) {
        this.lastRefreshState = now

        if (adhoc) {
          this.log.debug('Refreshing Roomba\'s status')
        } else {
          this.log.debug('Automatically refreshing Roomba\'s status')
        }

        /* Cancel any existing timeout */
        if (this.currentPollTimeout) {
          clearTimeout(this.currentPollTimeout)
          this.currentPollTimeout = undefined
        }

        this.refreshState(() => {
          const interval = this.currentPollInterval()
          this.lastPollInterval = interval
          this.log.debug('Will refresh Roomba\'s status again automatically in %s', millisToString(interval))

          if (this.currentPollTimeout) {
            clearTimeout(this.currentPollTimeout)
            this.currentPollTimeout = undefined
          }
          this.currentPollTimeout = setTimeout(checkStatus, interval, false)
        })
      }
    }

    checkStatus(adhoc || false)
  }

  private currentPollInterval = () => {
    /* Check if the user is still interested */
    const timeSinceUserLastInterested = Date.now() - (this.userLastInterestedTimestamp || 0)
    if (timeSinceUserLastInterested < USER_INTERESTED_MILLIS) {
      /* HomeKit is actively querying Roomba's status so a user may be interested */
      return 5_000
    }

    const timeSinceLastActive = Date.now() - (this.roombaLastActiveTimestamp || 0)
    if (this.isActive() || timeSinceLastActive < AFTER_ACTIVE_MILLIS) {
      /* Roomba is actively doing things */
      return 10_000
    }

    /* Roomba is idle */
    return this.idlePollIntervalMillis
  }

  private isActive(): boolean {
    return this.cachedStatus.running || this.cachedStatus.docking || false
  }

  private runningStatus = (status: Status) => status.running === undefined
    ? undefined
    : status.running
      ? 1
      : 0

  private chargingStatus = (status: Status) => status.charging === undefined
    ? undefined
    : status.charging
      ? this.api.hap.Characteristic.ChargingState.CHARGING
      : this.api.hap.Characteristic.ChargingState.NOT_CHARGING

  private dockingStatus = (status: Status) => status.docking === undefined
    ? undefined
    : status.docking
      ? this.api.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      : this.api.hap.Characteristic.ContactSensorState.CONTACT_DETECTED

  private dockedStatus = (status: Status) => status.charging === undefined
    ? undefined
    : status.charging
      ? this.api.hap.Characteristic.ContactSensorState.CONTACT_DETECTED
      : this.api.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED

  private batteryLevelStatus = (status: Status) => status.batteryLevel === undefined
    ? undefined
    : status.batteryLevel

  private binStatus = (status: Status) => status.binFull === undefined
    ? undefined
    : status.binFull
      ? this.api.hap.Characteristic.FilterChangeIndication.CHANGE_FILTER
      : this.api.hap.Characteristic.FilterChangeIndication.FILTER_OK

  private batteryStatus = (status: Status) => status.batteryLevel === undefined
    ? undefined
    : status.batteryLevel <= 20
      ? this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      : this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL

  private tankStatus = (status: Status) => status.tankLevel === undefined
    ? undefined
    : status.tankLevel
      ? this.api.hap.Characteristic.FilterChangeIndication.FILTER_OK
      : this.api.hap.Characteristic.FilterChangeIndication.CHANGE_FILTER

  private tankLevelStatus = (status: Status) => status.tankLevel === undefined
    ? undefined
    : status.tankLevel
}

function millisToString(millis: number): string {
  if (millis < 1_000) {
    return `${millis}ms`
  } else if (millis < 60_000) {
    return `${Math.round((millis / 1000) * 10) / 10}s`
  } else {
    return `${Math.round((millis / 60_000) * 10) / 10}m`
  }
}

function shouldTryDifferentCipher(error: Error) {
  /* Explicit TLS errors definitely suggest a different cipher should be used */
  if (error.message.includes('TLS')) {
    return true
  }
  /* We have seen this error connecting to an i1+ https://github.com/homebridge-plugins/homebridge-roomba/issues/129#issuecomment-1520733025 */
  if (error.message.toLowerCase().includes('identifier rejected')) {
    return true
  }
  return false
}
