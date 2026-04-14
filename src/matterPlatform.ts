import type { API, DynamicPlatformPlugin, Logging, PlatformAccessory } from 'homebridge'

import type { DeviceConfig, RoombaPlatformConfig } from './settings.js'
import type { Robot } from './roomba.js'

import { readFileSync } from 'node:fs'

import { RoombaMatterAccessory } from './matterAccessory.js'
import { getRoombas } from './roomba.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'

/**
 * Homebridge platform that registers Roomba devices as Homebridge Matter
 * RoboticVacuumCleaner accessories. This platform is chosen automatically when
 * Homebridge v2 is detected with Matter enabled, unless the user sets
 * `enableMatter: false` in the plugin configuration.
 */
export default class RoombaMatterPlatform implements DynamicPlatformPlugin {
  private readonly api: API
  private log: Logging
  private readonly config: RoombaPlatformConfig
  private readonly matterAccessories: Map<string, any> = new Map()
  private readonly roombaAccessories: Map<string, RoombaMatterAccessory> = new Map()
  version!: string

  public constructor(log: Logging, config: RoombaPlatformConfig, api: API) {
    this.api = api
    this.config = config
    this.log = log
    const debug = !!config.debug

    try {
      this.verifyConfig()
      log.debug('Configuration:', JSON.stringify(this.config, null, 2))
    } catch (e: any) {
      log.error('Error in configuration:', e.message ?? e)
      return
    }

    if (debug) {
      this.log = Object.assign(log, { debug: (message: string, ...parameters: unknown[]) => { log.info(`DEBUG: ${message}`, ...parameters) } })
    }

    this.version = this.getVersion()

    const matterApi = (this.api as any).matter

    if (!matterApi) {
      this.log.warn('Homebridge Matter API is not available. Please update Homebridge to v2 or later to use Matter support.')
      return
    }

    this.api.on('didFinishLaunching', () => {
      void this.discoverDevices()
    })
  }

  private verifyConfig(): void {
    if (this.config.disableDiscovery === undefined) {
      this.config.disableDiscovery = false
    }
  }

  /**
   * Required by DynamicPlatformPlugin. Called for cached HAP accessories.
   * Not used in the Matter platform — Matter accessories are handled by
   * `configureMatterAccessory`.
   */
  public configureAccessory(_accessory: PlatformAccessory): void {
    // HAP accessories are not used in the Matter platform
  }

  /**
   * Called by Homebridge when a cached Matter accessory is restored from disk.
   */
  public configureMatterAccessory(accessory: any): void {
    this.log.debug('Loading cached Matter accessory:', accessory.displayName)
    this.matterAccessories.set(accessory.UUID, accessory)
  }

  private async discoveryMethod(): Promise<DeviceConfig[]> {
    if (this.config.email && this.config.password) {
      const robots: Robot[] = await getRoombas(this.config.email, this.config.password, this.log, this.config)
      return robots.map((robot) => {
        const deviceConfig = this.config.devices?.find(device => device.blid === robot.blid) ?? {}
        return {
          ...robot,
          ...deviceConfig,
        } as any
      })
    } else if (this.config.devices) {
      return this.config.devices.map(device => ({ ...device }))
    } else {
      this.log.error('No configuration provided for devices.')
      return []
    }
  }

  private async discoverDevices(): Promise<void> {
    const matterApi = (this.api as any).matter
    if (!matterApi) {
      this.log.warn('Matter API not available — skipping device registration.')
      return
    }

    const devices: (Robot & DeviceConfig)[] = (await this.discoveryMethod()) as any
    const configuredUUIDs = new Set<string>()
    const accessoriesToRegister: any[] = []

    for (const device of devices) {
      const roombaAcc = new RoombaMatterAccessory(this.api, this.log, device, this.config, this.version)
      const uuid = roombaAcc.UUID
      configuredUUIDs.add(uuid)

      this.log.debug('Matter device: %s, UUID: %s', JSON.stringify(device), uuid)

      const existingMatterAccessory = this.matterAccessories.get(uuid)
      const matterAccessoryData = roombaAcc.toAccessory()

      if (existingMatterAccessory) {
        this.log.debug('Updating cached Matter accessory:', device.name)
        // Update properties on the cached accessory
        existingMatterAccessory.displayName = matterAccessoryData.displayName
        existingMatterAccessory.context = matterAccessoryData.context
        existingMatterAccessory.clusters = matterAccessoryData.clusters
        existingMatterAccessory.handlers = matterAccessoryData.handlers
        accessoriesToRegister.push(existingMatterAccessory)
      } else {
        this.log.info('Adding new Matter accessory:', device.name)
        accessoriesToRegister.push(matterAccessoryData)
        this.matterAccessories.set(uuid, matterAccessoryData)
      }

      this.roombaAccessories.set(uuid, roombaAcc)
    }

    // Register all accessories at once
    if (accessoriesToRegister.length > 0) {
      try {
        await matterApi.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessoriesToRegister)
        this.log.info(`Registered ${accessoriesToRegister.length} Roomba Matter accessory(ies)`)
      } catch (e: any) {
        this.log.error('Failed to register Matter accessories:', e.message ?? e)
      }
    }

    // Remove stale accessories
    const accessoriesToRemove: any[] = []
    for (const [uuid, accessory] of this.matterAccessories) {
      if (!configuredUUIDs.has(uuid)) {
        accessoriesToRemove.push(accessory)
        this.matterAccessories.delete(uuid)
        const roombaAcc = this.roombaAccessories.get(uuid)
        roombaAcc?.stopPolling()
        this.roombaAccessories.delete(uuid)
      }
    }

    if (accessoriesToRemove.length > 0) {
      this.log.info('Removing stale Matter accessories:', accessoriesToRemove.map((a: any) => a.displayName).join(', '))
      try {
        await matterApi.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessoriesToRemove)
      } catch (e: any) {
        this.log.warn('Failed to unregister stale Matter accessories:', e.message ?? e)
      }
    }

    // Start polling for all active accessories
    for (const roombaAcc of this.roombaAccessories.values()) {
      roombaAcc.startPolling()
    }
  }

  private getVersion(): string {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
    this.log.debug(`Plugin Version: ${version}`)
    return version
  }
}
