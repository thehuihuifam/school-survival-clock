import { createDefaultSettings } from '../settings'
import { getKstTimeParts } from '../time'
import type { KstTimeParts, UserSettings } from '../../types'

/**
 * Fixed "today" for the default settings of every fixture.
 *
 * Defaults are derived from the real KST date (that is the whole point of the
 * automatic semester window), which would make the engine fixtures behave
 * differently depending on the day CI runs. Pinning the anchor keeps the tests
 * deterministic while still exercising the automatic window (which now spans
 * 2026-08-18 → 2027-01-06 in these fixtures).
 */
export const TEST_TODAY_KEY = '2026-09-17'

/** KST parts for an instant expressed in UTC ISO-8601. */
export function at(isoUtc: string): KstTimeParts {
  return getKstTimeParts(new Date(isoUtc))
}

export function settingsWith(overrides: Partial<UserSettings> = {}): UserSettings {
  const base = createDefaultSettings(TEST_TODAY_KEY)
  // Pinning the semester dates by hand is exactly what switches the automatic
  // window off in the app, so the fixtures do the same unless they say otherwise.
  const pinsDates = overrides.semesterStart !== undefined || overrides.vacationDate !== undefined
  const automation = pinsDates ? { semesterAuto: false } : {}
  return { ...base, ...automation, ...overrides }
}
