import { describe, expect, it } from 'vitest'

/**
 * The mission-in-progress rule from #226, checked against the phases in
 * kj7ftjbnfy's debug log. A Roomba that has stopped moving is not necessarily
 * finished - it empties into its dock ('evac') and can recharge part-way
 * through a clean, and in both cases it goes back to cleaning afterwards.
 *
 * The plugin drops to a slow idle poll (15 minutes by default) whenever it
 * thinks the Roomba is idle, so treating these as idle is what made HomeKit
 * insist a cleaning Roomba was not cleaning.
 */
function missionActive(cleanMissionStatus: { cycle: string }): boolean {
  return cleanMissionStatus.cycle !== 'none'
}

describe('mission still in progress (#226)', () => {
  // Taken from the debug log on #226, in the order they appeared
  const loggedPhases = [
    { cycle: 'clean', phase: 'run', active: true, why: 'cleaning' },
    { cycle: 'clean', phase: 'hmPostMsn', active: true, why: 'returning to the dock' },
    { cycle: 'clean', phase: 'evac', active: true, why: 'emptying into the dock' },
    { cycle: 'none', phase: 'charge', active: false, why: 'job over, charging' },
  ]

  it.each(loggedPhases)('$phase ($why) -> missionActive=$active', ({ cycle, active }) => {
    expect(missionActive({ cycle })).toBe(active)
  })

  it('keeps a mid-mission recharge active, so the resume is noticed quickly', () => {
    // A Roomba that runs out part-way through docks to recharge and then goes
    // back to cleaning. The phase reads 'charge' exactly like a finished job,
    // and only the cycle tells them apart.
    expect(missionActive({ cycle: 'clean' })).toBe(true)
  })

  it('does not keep polling quickly once the job is genuinely finished', () => {
    expect(missionActive({ cycle: 'none' })).toBe(false)
  })
})
