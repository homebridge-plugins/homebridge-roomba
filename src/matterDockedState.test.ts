import { describe, expect, it } from 'vitest'

/**
 * The Matter operational state mapping from #228.
 *
 * `DOCKED` was listed in `operationalStateList` from the start but never
 * actually assigned by `_pushMatterState`, so Apple Home could never be told a
 * Roomba was docked. Mirrors the branch order in `matterAccessory.ts` — keep
 * the two in step.
 */
const RVC_STATE = {
  STOPPED: 0,
  RUNNING: 1,
  PAUSED: 2,
  ERROR: 3,
  SEEKING_CHARGER: 64,
  CHARGING: 65,
  DOCKED: 66,
} as const

interface Status {
  running?: boolean
  stuck?: boolean
  docking?: boolean
  paused?: boolean
  charging?: boolean
  docked?: boolean
}

function operationalState(status: Status): number {
  if (status.running) {
    return RVC_STATE.RUNNING
  }
  if (status.stuck) {
    return RVC_STATE.ERROR
  }
  if (status.docking) {
    return RVC_STATE.SEEKING_CHARGER
  }
  if (status.paused) {
    return RVC_STATE.PAUSED
  }
  if (status.charging) {
    return RVC_STATE.CHARGING
  }
  if (status.docked) {
    return RVC_STATE.DOCKED
  }
  return RVC_STATE.STOPPED
}

describe('matter operational state (#228)', () => {
  /**
   * The exact case from the report: a Roomba i3 sat on its dock, fully charged.
   * `charging` is deliberately false at 100% (#223), so before the docked branch
   * existed this fell through to STOPPED and stayed there.
   */
  it('reports a fully charged roomba on its dock as docked, not stopped', () => {
    expect(operationalState({ charging: false, docked: true })).toBe(RVC_STATE.DOCKED)
  })

  it('still reports charging while it is topping up on the dock', () => {
    expect(operationalState({ charging: true, docked: true })).toBe(RVC_STATE.CHARGING)
  })

  // Docked must never mask a real activity, so the earlier branches win.
  it('lets running, stuck, docking and paused take priority over docked', () => {
    expect(operationalState({ running: true, docked: true })).toBe(RVC_STATE.RUNNING)
    expect(operationalState({ stuck: true, docked: true })).toBe(RVC_STATE.ERROR)
    expect(operationalState({ docking: true, docked: false })).toBe(RVC_STATE.SEEKING_CHARGER)
    expect(operationalState({ paused: true, docked: false })).toBe(RVC_STATE.PAUSED)
  })

  it('reports stopped only when it is genuinely off the dock and idle', () => {
    expect(operationalState({ docked: false })).toBe(RVC_STATE.STOPPED)
    expect(operationalState({})).toBe(RVC_STATE.STOPPED)
  })

  /**
   * Every state the mapping can produce has to be in `operationalStateList`, or
   * matter.js throws when it is assigned and the endpoint rolls back.
   */
  it('only ever produces states that are declared to matter', () => {
    const declared = Object.values(RVC_STATE)
    const produced = [
      operationalState({ running: true }),
      operationalState({ stuck: true }),
      operationalState({ docking: true }),
      operationalState({ paused: true }),
      operationalState({ charging: true }),
      operationalState({ docked: true }),
      operationalState({}),
    ]
    for (const state of produced) {
      expect(declared).toContain(state)
    }
    // and the docked state is genuinely reachable, which was the bug
    expect(produced).toContain(RVC_STATE.DOCKED)
  })
})
