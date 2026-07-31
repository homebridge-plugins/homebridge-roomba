import { describe, expect, it } from 'vitest'

import { describeConnectTimeout, explain } from './connectFailure.js'

/**
 * Connection failure wording (#167). A user with debug logging off saw a bare
 * "Connect timed out" whether the robot refused them, rejected their
 * credentials, or accepted the connection and went silent — three problems with
 * three different fixes, all reading identically.
 */
describe('describeConnectTimeout', () => {
  it('names the address and how long it waited', () => {
    const message = describeConnectTimeout('172.16.2.249', 60_000)
    expect(message).toContain('172.16.2.249:8883')
    expect(message).toContain('60s')
  })

  /**
   * The distinction that matters most. "Nothing came back" and "actively refused"
   * need opposite fixes: one is usually another client holding the robot's
   * single connection, the other is not a network problem at all.
   */
  it('says nothing came back when no error arrived', () => {
    const message = describeConnectTimeout('10.0.0.5', 60_000)
    expect(message).toContain('no response from')
    expect(message).toContain('one local connection at a time')
  })

  it('quotes the real error when one did arrive', () => {
    const message = describeConnectTimeout('10.0.0.5', 60_000, new Error('connect ECONNREFUSED 10.0.0.5:8883'))
    expect(message).toContain('ECONNREFUSED')
    expect(message).not.toContain('no response from')
  })

  it('rounds the elapsed time to whole seconds', () => {
    expect(describeConnectTimeout('10.0.0.5', 59_600)).toContain('60s')
    expect(describeConnectTimeout('10.0.0.5', 1200)).toContain('1s')
  })
})

describe('explain', () => {
  it('tells a refused connection apart from a network problem', () => {
    const text = explain(new Error('connect ECONNREFUSED 10.0.0.5:8883'))
    expect(text).toContain('not a firewall or routing problem')
    expect(text).toContain('one local connection at a time')
  })

  it('points an unreachable host at routing instead', () => {
    expect(explain(new Error('connect EHOSTUNREACH 10.0.0.5:8883'))).toContain('routing or a firewall')
  })

  it('points rejected credentials at re-adding the robot', () => {
    expect(explain(new Error('Connection refused: Identifier rejected'))).toContain('BLID or password')
  })

  it('recognises a tls problem, which the plugin already retries', () => {
    expect(explain(new Error('write EPROTO ... SSL alert'))).toContain('TLS')
  })

  // ⚠️ A confident wrong explanation is worse than none — it sends the reporter
  // off investigating the wrong thing, which is how #167 lost two rounds.
  it('adds nothing to an error it does not recognise', () => {
    expect(explain(new Error('something nobody has seen before'))).toBe('')
  })
})
