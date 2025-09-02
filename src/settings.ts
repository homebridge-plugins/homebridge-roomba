import type { RobotMission } from 'dorita980'
import type { PlatformConfig } from 'homebridge'

import type { Robot } from './roomba.js'
/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = 'Roomba'

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = '@homebridge-plugins/homebridge-roomba'

export interface RoombaPlatformConfig extends PlatformConfig {
    devices: DeviceConfig[]
    disableDiscovery?: boolean
    idleWatchInterval?: number
    debug?: boolean
    /**
     * Whether to publish each Roomba as an external accessory instead of platform accessories.
     * External accessories appear as separate devices in HomeKit and support Matter bridging.
     */
    externalAccessories?: boolean
}

export interface DeviceConfig extends Robot {
    name: string
    model: string
    serialnum?: string
    blid: string
    robotpwd: string
    ipaddress: string
    cleanBehaviour: 'everywhere' | 'rooms'
    mission?: RobotMission
    stopBehaviour: 'home' | 'pause'
    /**
     * Idle Poll Interval (minutes).
     * How often to poll Roomba's status when it is idle.
     */
    idleWatchInterval?: number

    dockContactSensor?: boolean
    runningContactSensor?: boolean
    binContactSensor?: boolean
    dockingContactSensor?: boolean
    homeSwitch?: boolean
    tankContactSensor?: boolean
    
    /**
     * HomeKit accessory category. 
     * Note: iOS 18 vacuum support is Matter-only, not HomeKit HAP.
     * Available categories: 'other', 'switch', 'sensor'
     */
    accessoryCategory?: 'other' | 'switch' | 'sensor'
}
