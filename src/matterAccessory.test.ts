import type { API, Logging } from 'homebridge'

import { describe, expect, it } from 'vitest'

import { RoboticVacuumCleaner } from './matterAccessory.js'

describe('Matter robotic vacuum accessory', () => {
  it('does not publish an invalid single-mode clean-mode cluster', () => {
    const api = {
      matter: {
        uuid: {
          generate: () => 'test-uuid',
        },
      },
    } as unknown as API
    const log = { debug: () => {} } as unknown as Logging
    const device = {
      name: 'Test Roomba',
      blid: 'test-blid',
      password: 'test-password',
      ip: '192.0.2.1',
      model: 'Roomba',
      multiRoom: false,
      info: { sw: '1.0.0' },
      robotpwd: 'test-password',
      ipaddress: '192.0.2.1',
      cleanBehaviour: 'everywhere',
      stopBehaviour: 'home',
    } as any

    const accessory = new RoboticVacuumCleaner(api, log, device, {})
    const matterAccessory = accessory.toAccessory()

    expect(matterAccessory.clusters).not.toHaveProperty('rvcCleanMode')
    expect(matterAccessory.clusters).toHaveProperty('rvcRunMode')
    expect(matterAccessory.clusters).toHaveProperty('rvcOperationalState')
  })
})
