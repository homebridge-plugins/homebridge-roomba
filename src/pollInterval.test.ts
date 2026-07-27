import { describe, expect, it } from 'vitest'

/**
 * The poll-interval rule from #226, checked against kj7ftjbnfy's debug log.
 *
 * He started a clean from HomeKit at 2:27:39 PM. The ad-hoc refresh that follows
 * a command fired at 2:27:40, one second later — before the Roomba had actually
 * started — so it still reported `phase=stop running=false`. The next interval
 * was then chosen from that stale state, which meant the 15 minute idle interval,
 * and HomeKit insisted the Roomba was not cleaning until 2:42:41 PM.
 *
 * Fifteen minutes and one second, with no recharge anywhere in the log — which is
 * why the earlier "keep polling while it empties or recharges" rule did not help.
 */

const AFTER_ACTIVE_MILLIS = 120_000
const AFTER_COMMAND_MILLIS = 120_000
const ACTIVE_INTERVAL = 10_000
const IDLE_INTERVAL = 900_000 // 15 minutes, the default

interface State {
  running?: boolean
  docking?: boolean
  missionActive?: boolean
}

function pollInterval(
  now: number,
  status: State,
  lastActiveTimestamp?: number,
  lastCommandTimestamp?: number,
): number {
  const timeSinceLastActive = now - (lastActiveTimestamp ?? 0)
  const timeSinceLastCommand = now - (lastCommandTimestamp ?? Number.NEGATIVE_INFINITY)
  const isActive = status.running || status.docking || status.missionActive

  if (isActive || timeSinceLastActive < AFTER_ACTIVE_MILLIS || timeSinceLastCommand < AFTER_COMMAND_MILLIS) {
    return ACTIVE_INTERVAL
  }
  return IDLE_INTERVAL
}

describe('poll interval after a command (#226)', () => {
  // Real epoch timestamps, so the `?? 0` default for "last active" behaves as it
  // does in production (a long time ago) rather than looking like a moment ago.
  const COMMAND = Date.parse('2026-07-27T14:27:39Z')
  const REFRESH_AFTER_COMMAND = Date.parse('2026-07-27T14:27:40Z') // Roomba has not started yet

  it('keeps polling fast right after a start command, even though the state still says stopped', () => {
    // This is the exact failing moment: the refresh has come back with the
    // pre-command state, and previously that chose the 15 minute idle interval.
    const interval = pollInterval(REFRESH_AFTER_COMMAND, { running: false }, undefined, COMMAND)

    expect(interval).toBe(ACTIVE_INTERVAL)
    expect(interval).not.toBe(IDLE_INTERVAL)
  })

  it('would have caught the start well inside the 15 minutes he waited', () => {
    // The Roomba really was running by 2:42:41, 15m1s after the command. With a
    // 10 second interval the very next poll sees it.
    const nextPoll = REFRESH_AFTER_COMMAND + ACTIVE_INTERVAL
    expect(nextPoll - COMMAND).toBeLessThan(15 * 60_000)
    expect(pollInterval(nextPoll, { running: false }, undefined, COMMAND)).toBe(ACTIVE_INTERVAL)
  })

  it('reproduces the old behaviour when no command was sent', () => {
    // Same stale state, but nothing was commanded — this is a genuinely idle
    // Roomba and the slow interval is correct.
    expect(pollInterval(REFRESH_AFTER_COMMAND, { running: false })).toBe(IDLE_INTERVAL)
  })

  it('drops back to the idle interval once the command window passes', () => {
    const wellAfter = COMMAND + AFTER_COMMAND_MILLIS + 1
    expect(pollInterval(wellAfter, { running: false }, undefined, COMMAND)).toBe(IDLE_INTERVAL)
  })

  it('still polls fast while the Roomba reports itself active', () => {
    const longAfterCommand = COMMAND + AFTER_COMMAND_MILLIS * 10
    expect(pollInterval(longAfterCommand, { running: true }, undefined, COMMAND)).toBe(ACTIVE_INTERVAL)
    expect(pollInterval(longAfterCommand, { docking: true }, undefined, COMMAND)).toBe(ACTIVE_INTERVAL)
    expect(pollInterval(longAfterCommand, { missionActive: true }, undefined, COMMAND)).toBe(ACTIVE_INTERVAL)
  })

  it('still honours the after-active window on its own', () => {
    // A Roomba that has just stopped keeps the fast interval for a while, which
    // is the existing evac/recharge rule and must not regress.
    expect(pollInterval(COMMAND + 60_000, { running: false }, COMMAND, undefined)).toBe(ACTIVE_INTERVAL)
    expect(pollInterval(COMMAND + AFTER_ACTIVE_MILLIS + 1, { running: false }, COMMAND, undefined)).toBe(IDLE_INTERVAL)
  })

  it('treats a never-commanded accessory as idle rather than always-fast', () => {
    // Guards the NEGATIVE_INFINITY default: an undefined command timestamp must
    // not read as "commanded just now".
    expect(pollInterval(Date.now(), { running: false }, undefined, undefined)).toBe(IDLE_INTERVAL)
  })
})
