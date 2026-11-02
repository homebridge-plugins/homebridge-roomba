/**
 * Matter RVC clean modes, and how they map onto a Roomba's cleaning passes.
 *
 * Matter requires an RvcCleanMode cluster to list at least two modes, and
 * matter.js enforces it from 0.18 (Homebridge 2.5): with only "Vacuum" listed
 * the accessory fails to register with
 * `rvcCleanMode.state.supportedModes: Constraint "2 to 255": Array length 1 is not within bounds`.
 *
 * A Roomba has one real choice here, its cleaning passes, so the second mode is
 * "Deep clean" = two passes over every area. "Vacuum" puts the robot back on its
 * automatic pass setting.
 */

export const RVC_CLEAN_MODE = {
  VACUUM: 0,
  DEEP_CLEAN: 1,
} as const

export type RvcCleanMode = typeof RVC_CLEAN_MODE[keyof typeof RVC_CLEAN_MODE]

/**
 * Matter RvcCleanMode mode tags.
 */
const MODE_TAG = {
  DEEP_CLEAN: 16384,
  VACUUM: 16385,
} as const

export const RVC_CLEAN_MODES = [
  { label: 'Vacuum', mode: RVC_CLEAN_MODE.VACUUM, modeTags: [{ value: MODE_TAG.VACUUM }] },
  { label: 'Deep clean', mode: RVC_CLEAN_MODE.DEEP_CLEAN, modeTags: [{ value: MODE_TAG.DEEP_CLEAN }, { value: MODE_TAG.VACUUM }] },
]

/**
 * The clean mode a robot is set to, from its reported preferences, or
 * undefined when this part of the state does not carry them. A robot set to
 * a single pass (only possible from the iRobot app) shows as "Vacuum".
 */
export function cleanModeFromState(state: { twoPass?: boolean }): RvcCleanMode | undefined {
  if (state.twoPass === undefined) {
    return undefined
  }
  return state.twoPass ? RVC_CLEAN_MODE.DEEP_CLEAN : RVC_CLEAN_MODE.VACUUM
}
