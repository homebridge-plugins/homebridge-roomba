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
     * Enable Matter support when running on Homebridge v2 with Matter enabled.
     * Defaults to true.
     */
    enableMatter?: boolean
    /**
     * Publish all Roomba devices as external accessories (independent HomeKit
     * bridges) rather than as part of the main Homebridge bridge.
     * Can be overridden per device.
     */
    externalAccessory?: boolean
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
     * Publish this device as an external accessory (independent HomeKit bridge)
     * rather than part of the main Homebridge bridge. Overrides the platform-
     * level `externalAccessory` setting for this individual device.
     */
    externalAccessory?: boolean
}
