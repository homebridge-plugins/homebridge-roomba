/**
 * connectFailure.ts: @homebridge-plugins/homebridge-roomba.
 *
 * Wording for a failed local connection to a Roomba (#167).
 *
 * ⚠️ The underlying connection error is only ever written at **debug** level, and
 * the timeout path throws a bare "Connect timed out". So a user with debug off
 * sees one identical message for three completely different problems — refused,
 * rejected certificate, and accepted-then-silent. This text goes into the thrown
 * error, which IS logged at every level, so the reason reaches them without
 * having to change a setting and reproduce the fault first.
 */

/** dorita980's local MQTT port. The plugin never overrides it. */
const ROBOT_PORT = 8883

/**
 * A Roomba accepts only ONE local connection at a time — dorita980's own README
 * says so. That single fact explains most "cannot connect" reports, and is not
 * something a user can reasonably be expected to know.
 */
const ONE_CONNECTION_HINT
  = 'A Roomba accepts only one local connection at a time, so check the iRobot app is fully closed.'

/**
 * Explain a connection attempt that ran out of time.
 *
 * @param address - The robot's IP address.
 * @param elapsedMillis - How long the attempt ran before giving up.
 * @param lastError - The last error seen during the attempt, if any. Absent
 *   means the robot never answered at all, which is itself the useful signal.
 */
export function describeConnectTimeout(address: string, elapsedMillis: number, lastError?: Error): string {
  const seconds = Math.round(elapsedMillis / 1000)
  const where = `${address}:${ROBOT_PORT}`

  if (!lastError) {
    // ⚠️ Say only what is known. No error arriving means nothing came back - it
    // does NOT prove the robot accepted the connection, and claiming that would
    // send the reader off investigating the wrong layer.
    return `Connect timed out after ${seconds}s: no response from ${where}, and no error either. ${ONE_CONNECTION_HINT}`
  }

  // The error message rarely ends in punctuation, so terminate it before
  // appending an explanation, or the two run into each other.
  return `Connect timed out after ${seconds}s connecting to ${where}. Last error: ${lastError.message.replace(/[\s.]+$/, '')}.${explain(lastError)}`
}

/**
 * Turn a known error into an actionable sentence. Anything unrecognised gets
 * nothing added rather than a guess — a wrong explanation is worse than none.
 */
export function explain(error: Error): string {
  const message = error.message.toLowerCase()

  if (message.includes('econnrefused')) {
    // Refused means something answered and said no, so the network is fine.
    return ` Something at that address actively refused the connection, so this is not a firewall or routing problem. ${ONE_CONNECTION_HINT}`
  }
  if (message.includes('ehostunreach') || message.includes('enetunreach')) {
    return ' The address could not be reached at all, which does point at routing or a firewall.'
  }
  if (message.includes('etimedout')) {
    return ' Nothing answered at that address. Check the robot is awake and the IP is still correct.'
  }
  if (message.includes('identifier rejected')) {
    return ' The robot rejected the credentials. The BLID or password may be stale — removing and re-adding the robot regenerates them.'
  }
  if (message.includes('tls') || message.includes('ssl') || message.includes('cipher')) {
    return ' This looks like a TLS negotiation problem, which the plugin retries with other ciphers before giving up.'
  }
  return ''
}
