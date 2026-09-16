import { cloneSettings } from '../settings'
import { getKstTimeParts } from '../time'
import { DEFAULT_SETTINGS, type KstTimeParts, type UserSettings } from '../../types'

/** KST parts for an instant expressed in UTC ISO-8601. */
export function at(isoUtc: string): KstTimeParts {
  return getKstTimeParts(new Date(isoUtc))
}

export function settingsWith(overrides: Partial<UserSettings> = {}): UserSettings {
  return { ...cloneSettings(DEFAULT_SETTINGS), ...overrides }
}
