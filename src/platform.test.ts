import type { API, Logging, PlatformAccessory } from 'homebridge'

import { describe, expect, it, vi } from 'vitest'

import RoombaPlatform from './platform.js'
import type { RoombaPlatformConfig } from './settings.js'

// Mock RoombaAccessory to prevent it from being instantiated during tests
vi.mock('./accessory.js', () => ({
  default: vi.fn(),
}))

describe('RoombaPlatform', () => {
  const mockApi = {
    hap: {
      uuid: {
        generate: vi.fn(),
      },
      Service: {
        AccessoryInformation: 'AccessoryInformation',
        FilterMaintenance: 'FilterMaintenance',
        Switch: 'Switch',
        Battery: 'Battery',
        OccupancySensor: 'OccupancySensor',
        MotionSensor: 'MotionSensor',
      } as any,
      Characteristic: {} as any,
    },
    platformAccessory: vi.fn(() => {
      const mockService = {
        setPrimaryService: vi.fn(),
        setCharacteristic: vi.fn(),
        getCharacteristic: vi.fn().mockReturnValue({
          onGet: vi.fn(),
          onSet: vi.fn(),
          updateValue: vi.fn(),
        }),
        updateCharacteristic: vi.fn(),
      }
      return {
        context: {},
        displayName: 'Mock Accessory',
        getService: vi.fn().mockReturnValue(mockService),
        addService: vi.fn().mockReturnValue(mockService),
      }
    }),
    registerPlatformAccessories: vi.fn(),
    updatePlatformAccessories: vi.fn(),
    unregisterPlatformAccessories: vi.fn(),
    on: vi.fn(),
  } as unknown as API

  const mockLog = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logging

  it('should handle devices with undefined blid gracefully', async () => {
    const config: RoombaPlatformConfig = {
      platform: 'Roomba',
      name: 'Test Roomba',
      devices: [
        {
          name: 'Test Roomba',
          model: 'i7',
          blid: undefined as any, // This should be handled gracefully
          robotpwd: 'testpassword',
          password: 'testpassword',
          ipaddress: '192.168.1.100',
          ip: '192.168.1.100',
          multiRoom: false,
          info: { sw: 'test-software-version' },
          cleanBehaviour: 'everywhere' as const,
          stopBehaviour: 'home' as const,
        },
      ],
    }

    // Reset mocks
    vi.clearAllMocks()
    mockApi.hap.uuid.generate = vi.fn().mockReturnValue('mock-uuid')

    const platform = new RoombaPlatform(mockLog, config, mockApi)

    // This should not throw an error now
    await expect(async () => {
      await (platform as any).discoverDevices()
    }).not.toThrow()

    // Check that error was logged for invalid device
    expect(mockLog.error).toHaveBeenCalledWith(
      'Skipping device with invalid blid:',
      'Test Roomba',
      'blid:',
      undefined
    )

    // uuid.generate should not have been called since device was skipped
    expect(mockApi.hap.uuid.generate).not.toHaveBeenCalled()
  })

  it('should handle devices with null blid gracefully', async () => {
    const config: RoombaPlatformConfig = {
      platform: 'Roomba',
      name: 'Test Roomba',
      devices: [
        {
          name: 'Test Roomba Null',
          model: 'i7',
          blid: null as any, // This should also be handled gracefully
          robotpwd: 'testpassword',
          password: 'testpassword',
          ipaddress: '192.168.1.100',
          ip: '192.168.1.100',
          multiRoom: false,
          info: { sw: 'test-software-version' },
          cleanBehaviour: 'everywhere' as const,
          stopBehaviour: 'home' as const,
        },
      ],
    }

    // Reset mocks
    vi.clearAllMocks()
    mockApi.hap.uuid.generate = vi.fn().mockReturnValue('mock-uuid')

    const platform = new RoombaPlatform(mockLog, config, mockApi)

    // This should not throw an error
    await expect(async () => {
      await (platform as any).discoverDevices()
    }).not.toThrow()

    // Check that error was logged for invalid device
    expect(mockLog.error).toHaveBeenCalledWith(
      'Skipping device with invalid blid:',
      'Test Roomba Null',
      'blid:',
      null
    )

    // uuid.generate should not have been called since device was skipped
    expect(mockApi.hap.uuid.generate).not.toHaveBeenCalled()
  })

  it('should handle devices with valid blid correctly', async () => {
    const config: RoombaPlatformConfig = {
      platform: 'Roomba',
      name: 'Test Roomba',
      devices: [
        {
          name: 'Test Roomba',
          model: 'i7',
          blid: 'valid-blid-123',
          robotpwd: 'testpassword',
          password: 'testpassword',
          ipaddress: '192.168.1.100',
          ip: '192.168.1.100',
          multiRoom: false,
          info: { sw: 'test-software-version' },
          cleanBehaviour: 'everywhere' as const,
          stopBehaviour: 'home' as const,
        },
      ],
    }

    // Reset mocks
    vi.clearAllMocks()
    mockApi.hap.uuid.generate = vi.fn().mockReturnValue('mock-uuid-valid-blid-123')

    const platform = new RoombaPlatform(mockLog, config, mockApi)

    // This should work fine
    await expect(async () => {
      await (platform as any).discoverDevices()
    }).not.toThrow()

    expect(mockApi.hap.uuid.generate).toHaveBeenCalledWith('valid-blid-123')
  })
})