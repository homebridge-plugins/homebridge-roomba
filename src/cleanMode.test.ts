import { describe, expect, it } from 'vitest'

import { cleanModeFromState, RVC_CLEAN_MODE, RVC_CLEAN_MODES } from './cleanMode.js'

describe('matter clean modes', () => {
  /**
   * matter.js 0.18 (Homebridge 2.5) rejects an RvcCleanMode cluster with fewer
   * than two modes, and the accessory then fails to register.
   */
  it('lists between 2 and 255 modes, with unique ids', () => {
    expect(RVC_CLEAN_MODES.length).toBeGreaterThanOrEqual(2)
    expect(RVC_CLEAN_MODES.length).toBeLessThanOrEqual(255)
    expect(new Set(RVC_CLEAN_MODES.map(m => m.mode)).size).toBe(RVC_CLEAN_MODES.length)
  })

  it('tags every mode as vacuuming', () => {
    for (const mode of RVC_CLEAN_MODES) {
      expect(mode.modeTags.map(t => t.value)).toContain(16385)
    }
  })

  it('reads the mode from the robot\'s pass preference', () => {
    expect(cleanModeFromState({ twoPass: true })).toBe(RVC_CLEAN_MODE.DEEP_CLEAN)
    expect(cleanModeFromState({ twoPass: false })).toBe(RVC_CLEAN_MODE.VACUUM)
    expect(cleanModeFromState({})).toBeUndefined()
  })
})
