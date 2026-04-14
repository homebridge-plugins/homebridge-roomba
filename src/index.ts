import type { API, PlatformConfig } from 'homebridge'

import RoombaMatterPlatform from './matterPlatform.js'
import RoombaPlatform from './platform.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'

/**
 * Creates a proxy constructor that instantiates the correct platform
 * implementation — Matter or HAP — depending on runtime availability
 * and the user's configuration.
 *
 * - If `enableMatter` is `false` in the config, HAP is always used.
 * - If `preferMatter` is `false` in the config, HAP is always used.
 * - If Matter is available and enabled on the Homebridge host, the Matter
 *   platform is used; otherwise the HAP platform is used.
 */
export function createPlatformProxy(HAPPlatform: any, MatterPlatform: any): any {
  return class RoombaPlatformProxy {
    constructor(log: any, config: PlatformConfig, api: any) {
      const enableMatter = config.enableMatter !== false
      const preferMatter = config.preferMatter !== false
      const matterAvailable = !!(api?.isMatterAvailable?.() && api?.isMatterEnabled?.())

      if (enableMatter && preferMatter && matterAvailable) {
        return new MatterPlatform(log, config, api)
      }

      return new HAPPlatform(log, config, api)
    }
  }
}

// Register our platform with homebridge.
export default (api: API): void => {
  const ProxyCtor = createPlatformProxy(RoombaPlatform, RoombaMatterPlatform)
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, ProxyCtor as any)
}
