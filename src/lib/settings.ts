/**
 * Persistence layer.
 *
 * Settings live in `localStorage`, survive reloads, are validated field by
 * field on the way in (a corrupt or hand-edited payload can never crash the
 * dashboard), migrate transparently from the v1 shape, and can be exported /
 * imported as JSON so a timetable can be shared between teachers or devices.
 */
import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  createDefaultTimetables,
  type DayTimetable,
  type Holiday,
  type PeriodKind,
  type ThemeMode,
  type TimetablePeriod,
  type UserSettings,
} from '../types'
import { isValidDateInput, isValidTimeInput } from './time'

export const STORAGE_KEY = 'school-survival-clock.settings.v2'
/** Key used by earlier builds; read once so returning users keep their data. */
export const LEGACY_STORAGE_KEYS = [
  'teacher-survival-dashboard-settings',
  'school-survival-clock.settings.v1',
]

const PERIOD_KINDS: PeriodKind[] = ['class', 'lunch', 'club', 'duty']
const THEME_MODES: ThemeMode[] = ['dark', 'light', 'system']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function asThemeMode(value: unknown, fallback: ThemeMode): ThemeMode {
  return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : fallback
}

function asPeriodKind(value: unknown): PeriodKind {
  return PERIOD_KINDS.includes(value as PeriodKind) ? (value as PeriodKind) : 'class'
}

function asTime(value: unknown, fallback: string) {
  if (!isValidTimeInput(value)) {
    return fallback
  }
  // Normalise `9:05` → `09:05` so the inputs and the parser agree.
  const [hours, minutes] = value.split(':')
  return `${hours.padStart(2, '0')}:${minutes}`
}

function asDate(value: unknown, fallback: string) {
  return isValidDateInput(value) ? value : fallback
}

function normalisePeriod(period: unknown, index: number): TimetablePeriod | null {
  if (!isRecord(period)) {
    return null
  }
  const start = asTime(period.start, '')
  const end = asTime(period.end, '')
  if (!isValidTimeInput(start) || !isValidTimeInput(end)) {
    return null
  }
  const label = asString(period.label, '').trim().slice(0, 24)
  return {
    id: asString(period.id, '').trim().slice(0, 32) || `period-${index + 1}`,
    label: label || `${index + 1}교시`,
    kind: asPeriodKind(period.kind),
    start,
    end,
  }
}

function normaliseTimetable(value: unknown): DayTimetable {
  if (!isRecord(value)) {
    return { enabled: false, periods: [] }
  }
  const rawPeriods = Array.isArray(value.periods) ? value.periods : []
  const periods = rawPeriods
    .map((period, index) => normalisePeriod(period, index))
    .filter((period): period is TimetablePeriod => period !== null)
    .slice(0, 16)

  return {
    enabled: asBoolean(value.enabled, periods.length > 0),
    periods,
  }
}

function normaliseTimetables(value: unknown): Record<string, DayTimetable> {
  const defaults = createDefaultTimetables()
  if (!isRecord(value)) {
    return defaults
  }
  const result: Record<string, DayTimetable> = {}
  for (let weekday = 0; weekday < 7; weekday += 1) {
    result[String(weekday)] = normaliseTimetable(value[String(weekday)] ?? defaults[String(weekday)])
  }
  return result
}

function normaliseSchoolDays(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_SETTINGS.schoolDays]
  }
  const days = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6)
  return [...new Set(days)].sort((left, right) => left - right)
}

function normaliseHolidays(value: unknown): Holiday[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const holidays: Holiday[] = []

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue
    }
    const date = asDate(entry.date, '')
    if (!isValidDateInput(date) || seen.has(date)) {
      continue
    }
    seen.add(date)
    holidays.push({ date, label: asString(entry.label, '').trim().slice(0, 32) })
  }

  return holidays.sort((left, right) => left.date.localeCompare(right.date)).slice(0, 120)
}

/**
 * Turn any persisted (or imported) payload into a fully valid `UserSettings`.
 * Unknown keys are dropped, broken values fall back to defaults, and legacy v1
 * payloads (no timetable, `theme` instead of `themeMode`) are upgraded in
 * place — so the app never has to trust what it reads back.
 */
export function normalizeSettings(input: unknown): UserSettings {
  const source = isRecord(input) ? input : {}
  const timetables = normaliseTimetables(source.timetables)
  const dismissalTime = asTime(source.dismissalTime, DEFAULT_SETTINGS.dismissalTime)
  const semesterStart = asDate(source.semesterStart, DEFAULT_SETTINGS.semesterStart)
  const vacationDate = asDate(source.vacationDate, DEFAULT_SETTINGS.vacationDate)

  // v1 stored `theme: 'dark' | 'light'`; keep the choice when upgrading.
  const legacyTheme = typeof source.theme === 'string' ? source.theme : undefined
  const themeMode = asThemeMode(
    source.themeMode ?? (legacyTheme === 'dark' || legacyTheme === 'light' ? legacyTheme : undefined),
    DEFAULT_SETTINGS.themeMode,
  )

  return {
    version: SETTINGS_VERSION,
    displayName: asString(source.displayName, DEFAULT_SETTINGS.displayName).trim().slice(0, 40)
      || DEFAULT_SETTINGS.displayName,
    dismissalTime,
    // A vacation date before the semester start would invert the battery, so
    // fall back to the default when the pair is unusable.
    semesterStart,
    vacationDate: parseDateSafely(vacationDate) > parseDateSafely(semesterStart)
      ? vacationDate
      : DEFAULT_SETTINGS.vacationDate,
    themeMode,
    soundEnabled: asBoolean(source.soundEnabled, DEFAULT_SETTINGS.soundEnabled),
    notifyEnabled: asBoolean(source.notifyEnabled, DEFAULT_SETTINGS.notifyEnabled),
    schoolDays: normaliseSchoolDays(source.schoolDays),
    holidays: normaliseHolidays(source.holidays),
    timetables,
  }
}

function parseDateSafely(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year || 0, (month || 1) - 1, day || 1)
}

export function cloneSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    schoolDays: [...settings.schoolDays],
    holidays: settings.holidays.map((holiday) => ({ ...holiday })),
    timetables: Object.fromEntries(
      Object.entries(settings.timetables).map(([key, timetable]) => [
        key,
        { enabled: timetable.enabled, periods: timetable.periods.map((period) => ({ ...period })) },
      ]),
    ),
  }
}

function readFromStorage(): UserSettings {
  const candidates = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]
  for (const key of candidates) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) {
        continue
      }
      const parsed = JSON.parse(raw) as unknown
      if (!isRecord(parsed)) {
        continue
      }
      const settings = normalizeSettings(parsed)
      // Re-write under the current key so the legacy entry stops being needed.
      if (key !== STORAGE_KEY) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
        window.localStorage.removeItem(key)
      }
      return settings
    } catch {
      // Corrupt JSON or blocked storage: fall through to the next candidate.
    }
  }
  return cloneSettings(DEFAULT_SETTINGS)
}

export function loadSettings(): UserSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return cloneSettings(DEFAULT_SETTINGS)
  }
  return readFromStorage()
}

export function saveSettings(settings: UserSettings) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Private mode / quota: the app keeps working from memory.
  }
}

export function clearStoredSettings() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Nothing else to do — resetting is a convenience, not a contract.
  }
}

export function serializeSettings(settings: UserSettings) {
  return `${JSON.stringify(settings, null, 2)}\n`
}

export interface ImportResult {
  settings: UserSettings
  /** Human readable warnings about values that had to be replaced. */
  warnings: string[]
}

/** Parse an exported JSON file body, keeping every recoverable field. */
export function parseSettingsJson(raw: string): ImportResult {
  const warnings: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { settings: cloneSettings(DEFAULT_SETTINGS), warnings: ['JSON 형식을 읽을 수 없어 기본값을 사용했어요.'] }
  }

  if (!isRecord(parsed)) {
    return { settings: cloneSettings(DEFAULT_SETTINGS), warnings: ['설정 객체가 아니어서 기본값을 사용했어요.'] }
  }

  const settings = normalizeSettings(parsed)
  if (typeof parsed.displayName === 'string' && settings.displayName !== parsed.displayName.trim()) {
    warnings.push('이름이 비어 있어 기본 이름으로 채웠어요.')
  }
  if (Array.isArray(parsed.holidays) && settings.holidays.length < parsed.holidays.length) {
    warnings.push('형식이 맞지 않는 휴일 항목은 건너뛰었어요.')
  }
  if (!isRecord(parsed.timetables)) {
    warnings.push('시간표가 들어 있지 않아 기본 시간표를 적용했어요.')
  }
  return { settings, warnings }
}

/** Cross-tab sync: other tabs editing the same settings update this one too. */
export function subscribeToExternalSettings(handler: (settings: UserSettings) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const listener = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) {
      return
    }
    if (!event.newValue) {
      return
    }
    try {
      handler(normalizeSettings(JSON.parse(event.newValue) as unknown))
    } catch {
      // Ignore malformed payloads from other tabs.
    }
  }

  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
