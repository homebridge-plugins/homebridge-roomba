import { describe, expect, it } from 'vitest'

import { redactConfig } from './redact.js'

describe('redactConfig', () => {
  it('masks a password but shows that one is set', () => {
    const out = redactConfig({ password: 'hunter2' }) as Record<string, unknown>
    expect(out.password).toBe('<redacted>')
    expect(JSON.stringify(out)).not.toContain('hunter2')
  })

  it('distinguishes a blank value from a set one', () => {
    expect((redactConfig({ password: '' }) as Record<string, unknown>).password).toBe('<empty>')
    expect((redactConfig({ password: 'x' }) as Record<string, unknown>).password).toBe('<redacted>')
  })

  it('leaves an unset value alone so it reads as never configured', () => {
    const out = redactConfig({ password: undefined, other: 1 }) as Record<string, unknown>
    expect(out.password).toBeUndefined()
    expect(out.other).toBe(1)
  })

  it('partially masks an email so the account stays identifiable', () => {
    const out = redactConfig({ email: 'someone@example.com' }) as Record<string, unknown>
    expect(out.email).toBe('s*****@example.com')
  })

  it('leaves a non-email string alone', () => {
    expect((redactConfig({ email: 'notanemail' }) as Record<string, unknown>).email).toBe('notanemail')
  })

  it('masks an email-shaped value under any key name', () => {
    const out = redactConfig({ augustId: 'someone@example.com', user: 'a@b.co' }) as Record<string, unknown>
    expect(out.augustId).toBe('s*****@example.com')
    expect(out.user).toBe('a*****@b.co')
  })

  it('redacts the roomba blid and nested device credentials', () => {
    const out = redactConfig({
      devices: [
        { name: 'Living Room', blid: '1234567890', password: ':1:9999:abcdef' },
      ],
    }) as { devices: Record<string, unknown>[] }

    expect(out.devices[0].name).toBe('Living Room')
    expect(out.devices[0].blid).toBe('<redacted>')
    expect(out.devices[0].password).toBe('<redacted>')
    expect(JSON.stringify(out)).not.toContain('abcdef')
  })

  it('keeps non-sensitive settings readable', () => {
    const out = redactConfig({
      name: 'Roomba',
      debug: true,
      disableDiscovery: false,
      mission: { ordered: 1, regions: [{ region_id: '3' }] },
    }) as Record<string, any>

    expect(out.name).toBe('Roomba')
    expect(out.debug).toBe(true)
    expect(out.disableDiscovery).toBe(false)
    expect(out.mission.regions[0].region_id).toBe('3')
  })

  it('matches sensitive keys case-insensitively and by substring', () => {
    const out = redactConfig({
      apiKey: 'a',
      API_KEY: 'b',
      refreshToken: 'c',
      clientSecret: 'd',
      credentials: { user: 'e' },
    }) as Record<string, unknown>

    expect(out.apiKey).toBe('<redacted>')
    expect(out.API_KEY).toBe('<redacted>')
    expect(out.refreshToken).toBe('<redacted>')
    expect(out.clientSecret).toBe('<redacted>')
    expect(out.credentials).toBe('<redacted>')
  })

  it('handles arrays and primitives without throwing', () => {
    expect(redactConfig([1, 'two', null])).toEqual([1, 'two', null])
    expect(redactConfig(null)).toBeNull()
    expect(redactConfig('plain')).toBe('plain')
  })
})
