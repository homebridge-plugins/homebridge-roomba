import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, Service } from 'homebridge'

import type { DeviceInfo, Robot } from './roomba.js'
import type { DeviceConfig, RoombaPlatformConfig } from './settings.js'

import { readFileSync } from 'node:fs'

import RoombaAccessory from './accessory.js'
import { getRoombas } from './roomba.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'

export default class RoombaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service
  public readonly Characteristic: typeof Characteristic
  private api: API
  private log!: Logging
  private config: RoombaPlatformConfig
  private readonly accessories: Map<string, PlatformAccessory> = new Map()
  version!: string

  public constructor(log: Logging, config: RoombaPlatformConfig, api: API) {
    this.Service = api.hap.Service
    this.Characteristic = api.hap.Characteristic
    this.api = api
    this.config = config
    const debug = !!config.debug

    try {
      this.verifyConfig()
      log.debug('Configuration:', JSON.stringify(this.config, null, 2))
    } catch (e: any) {
      log.error('Error in configuration:', e.message ?? e)
      return
    }

    this.log = !debug
      ? log
      : Object.assign(log, { debug: (message: string, ...parameters: unknown[]) => { log.info(`DEBUG: ${message}`, ...parameters) } })

    this.version = this.getVersion()

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices()
    })
  }

  private verifyConfig() {
    if (this.config.disableDiscovery === undefined) {
      this.config.disableDiscovery = false
    }
  }

  public configureAccessory(accessory: PlatformAccessory): void {
    // Only used for platform accessories, not external accessories
    if (!this.config.externalAccessories) {
      this.log(`Configuring accessory: ${accessory.displayName}`)
      this.accessories.set(accessory.UUID, accessory)
    }
  }

  private async discoveryMethod(): Promise<DeviceConfig[]> {
    if (this.config.email && this.config.password) {
      const robots: Robot[] = await getRoombas(this.config.email, this.config.password, this.log, this.config)
      return robots.map((robot) => {
        const deviceConfig = this.config.devices?.find(device => device.blid === robot.blid) || {}
        return {
          ...robot,
          ...deviceConfig,
        } as any
      })
    } else if (this.config.devices) {
      return this.config.devices.map(device => ({
        ...device,
      }))
    } else {
      this.log.error('No configuration provided for devices.')
      return []
    }
  }

  private async discoverDevices(): Promise<void> {
    const devices: Robot[] & DeviceConfig[] = await this.discoveryMethod()
    
    if (this.config.externalAccessories) {
      // External accessories mode - publish each as separate device with Matter support
      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.blid)
        this.log.info('Publishing Matter-compatible external accessory:', device.name)
        
        // Map user-friendly category names to HAP Categories
        const categoryMap = {
          'other': this.api.hap.Categories.OTHER,
          'switch': this.api.hap.Categories.SWITCH, 
          'sensor': this.api.hap.Categories.SENSOR,
        } as const
        
        const category = categoryMap[device.accessoryCategory || 'other']
        const accessory = new this.api.platformAccessory(device.name, uuid, category)
        accessory.context.device = device
        const { serialNumber, deviceInfo } = this.serialNum(device)
        accessory.context.serialNumber = serialNumber
        accessory.context.deviceInfo = deviceInfo
        accessory.context.model = device.model
        accessory.context.firmwareRevision = device.softwareVer ?? this.version ?? '0.0.0'
        
        new RoombaAccessory(this, accessory, this.log, {
          ...device,
        }, this.config, this.api)
        
        // Use publishMatterAccessories for Homebridge alpha.28+ with Matter support
        // Falls back to publishExternalAccessories for older versions
        if (typeof (this.api as any).publishMatterAccessories === 'function') {
          (this.api as any).publishMatterAccessories(PLUGIN_NAME, [accessory])
        } else {
          this.api.publishExternalAccessories(PLUGIN_NAME, [accessory])
        }
      }
    } else {
      // Platform accessories mode - use existing cached logic
      const configuredAccessoryUUIDs = new Set<string>()

      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.blid)
        const existingAccessory = this.accessories.get(uuid)

        if (existingAccessory) {
          this.log.debug('existingAccessory device: %s', JSON.stringify(device))
          this.log.debug('Restoring existing accessory from cache:', existingAccessory.displayName)
          existingAccessory.context.device = device
          const { serialNumber, deviceInfo } = this.serialNum(device)
          existingAccessory.context.serialNumber = serialNumber
          existingAccessory.context.deviceInfo = deviceInfo
          existingAccessory.context.model = device.model
          existingAccessory.context.firmwareRevision = device.softwareVer ?? this.version ?? '0.0.0'
          this.api.updatePlatformAccessories([existingAccessory])
          new RoombaAccessory(this, existingAccessory, this.log, {
            ...device,
          }, this.config, this.api)
        } else {
          this.log.debug('accessory device: %s', JSON.stringify(device))
          this.log.info('Adding new accessory:', device.name)
          
          // Map user-friendly category names to HAP Categories
          const categoryMap = {
            'other': this.api.hap.Categories.OTHER,
            'switch': this.api.hap.Categories.SWITCH, 
            'sensor': this.api.hap.Categories.SENSOR,
          } as const
          
          const category = categoryMap[device.accessoryCategory || 'other']
          const accessory = new this.api.platformAccessory(device.name, uuid, category)
          accessory.context.device = device
          const { serialNumber, deviceInfo } = this.serialNum(device)
          accessory.context.serialNumber = serialNumber
          accessory.context.deviceInfo = deviceInfo
          accessory.context.model = device.model
          accessory.context.firmwareRevision = device.softwareVer ?? this.version ?? '0.0.0'
          new RoombaAccessory(this, accessory, this.log, {
            ...device,
          }, this.config, this.api)
          
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
        }
        configuredAccessoryUUIDs.add(uuid)
      }

      const accessoriesToRemove: PlatformAccessory[] = []
      for (const [uuid, accessory] of this.accessories) {
        if (!configuredAccessoryUUIDs.has(uuid)) {
          accessoriesToRemove.push(accessory)
        }
      }

      if (accessoriesToRemove.length) {
        this.log.info('Removing existing accessories from cache:', accessoriesToRemove.map(a => a.displayName).join(', '))
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessoriesToRemove)
      }
    }
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

  private getVersion(): string {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
    this.log.debug(`Plugin Version: ${version}`)
    return version
  }
}
