import type { API } from 'homebridge'

import { describe, expect, it, vi } from 'vitest'

import registerPlatform, { createPlatformProxy } from './index.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'

describe('index.ts', () => {
  it('should register a platform proxy with homebridge', () => {
    const api = {
      registerPlatform: vi.fn(),
    } as unknown as API

    registerPlatform(api)

    expect(api.registerPlatform).toHaveBeenCalledWith(PLUGIN_NAME, PLATFORM_NAME, expect.any(Function))
  })

  describe('createPlatformProxy', () => {
    it('should use the HAP platform when Matter is not available', () => {
      const HAPPlatform = vi.fn()
      const MatterPlatform = vi.fn()
      const Proxy = createPlatformProxy(HAPPlatform, MatterPlatform)

      const log = {}
      const config = {}
      const api = {
        isMatterAvailable: vi.fn().mockReturnValue(false),
        isMatterEnabled: vi.fn().mockReturnValue(false),
      }

      new Proxy(log, config, api)

      expect(HAPPlatform).toHaveBeenCalledWith(log, config, api)
      expect(MatterPlatform).not.toHaveBeenCalled()
    })

    it('should use the Matter platform when Matter is available and enabled', () => {
      const HAPPlatform = vi.fn()
      const MatterPlatform = vi.fn()
      const Proxy = createPlatformProxy(HAPPlatform, MatterPlatform)

      const log = {}
      const config = {}
      const api = {
        isMatterAvailable: vi.fn().mockReturnValue(true),
        isMatterEnabled: vi.fn().mockReturnValue(true),
      }

      new Proxy(log, config, api)

      expect(MatterPlatform).toHaveBeenCalledWith(log, config, api)
      expect(HAPPlatform).not.toHaveBeenCalled()
    })

    it('should use the HAP platform when enableMatter is false', () => {
      const HAPPlatform = vi.fn()
      const MatterPlatform = vi.fn()
      const Proxy = createPlatformProxy(HAPPlatform, MatterPlatform)

      const log = {}
      const config = { enableMatter: false }
      const api = {
        isMatterAvailable: vi.fn().mockReturnValue(true),
        isMatterEnabled: vi.fn().mockReturnValue(true),
      }

      new Proxy(log, config, api)

      expect(HAPPlatform).toHaveBeenCalledWith(log, config, api)
      expect(MatterPlatform).not.toHaveBeenCalled()
    })

    it('should fall back to HAP when Matter platform initialization fails', () => {
      const HAPPlatform = vi.fn()
      const MatterPlatform = vi.fn(function MatterPlatformConstructor() {
        throw new Error('Matter initialization failed')
      })
      const Proxy = createPlatformProxy(HAPPlatform, MatterPlatform)

      const log = {
        warn: vi.fn(),
      }
      const config = {}
      const api = {
        isMatterAvailable: vi.fn().mockReturnValue(true),
        isMatterEnabled: vi.fn().mockReturnValue(true),
      }

      new Proxy(log, config, api)

      expect(MatterPlatform).toHaveBeenCalledWith(log, config, api)
      expect(HAPPlatform).toHaveBeenCalledWith(log, config, api)
      expect(log.warn).toHaveBeenCalled()
    })
  })
})
