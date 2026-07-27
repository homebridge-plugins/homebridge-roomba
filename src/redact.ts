/**
 * redact.ts: @homebridge-plugins/homebridge-roomba.
 *
 * Debug logging prints the plugin configuration, and users are routinely asked
 * to enable debug logging and attach the result to a public GitHub issue. That
 * combination has already published a live account password, so secrets are
 * masked here before anything reaches the log.
 *
 * Masking deliberately preserves whether a value was SET, since "you have not
 * filled that field in" is one of the most common answers in support.
 */

/** Config keys whose values must never be printed. */
const SENSITIVE_KEY_PATTERN = /password|secret|token|credential|api[-_]?key|blid|auth|cookie|session|private/i

/**
 * Matches an email-shaped VALUE rather than a key name. Account identifiers are
 * named inconsistently across plugins — `email`, `username`, `augustId` — so
 * keying off the value catches them all, including ones added later.
 */
const EMAIL_VALUE_PATTERN = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

/**
 * Mask an email so the account is recognisable without publishing it:
 * `someone@example.com` becomes `s*****@example.com`.
 */
function maskEmail(value: string): string {
  const at = value.indexOf('@')
  return `${value[0]}*****${value.slice(at)}`
}

/**
 * Deep-copy a value, replacing anything sensitive with a placeholder.
 *
 * The placeholders distinguish the three cases that matter when reading a log:
 * `<redacted>` (set, hidden), `<empty>` (present but blank), and an absent key
 * (never configured).
 *
 * @param value - The value to redact. Usually the platform config.
 * @returns A redacted deep copy, safe to stringify into a log.
 */
export function redactConfig(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => redactConfig(entry))
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  const output: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      if (entry === undefined || entry === null) {
        output[key] = entry
      } else if (typeof entry === 'string' && entry.length === 0) {
        output[key] = '<empty>'
      } else {
        output[key] = '<redacted>'
      }
      continue
    }

    if (typeof entry === 'string' && EMAIL_VALUE_PATTERN.test(entry)) {
      output[key] = maskEmail(entry)
      continue
    }

    output[key] = redactConfig(entry)
  }

  return output
}
