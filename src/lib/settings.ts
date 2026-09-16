/**
 * Persistence layer.
 *
 * Settings live in `localStorage`, survive reloads, are validated field by
 * field on the way in (a corrupt or hand-edited payload can never crash the
 * dashboard), migrate transparently from the v1/v2 shapes, and can be exported
 * / imported as JSON so a timetable can be shared between teachers or devices.
 *
 * The semester window is *derived from today* while `semesterAuto` is on, so a
 * dashboard that is opened for the first time in 2031 still knows which Korean
 * school semester it is in.
 */
import {
  BASE_SETTINGS,
  LEGACY_DEFAULT_SEMESTER_START,
  LEGACY_DEFAULT_VACATION_DATE,
  MAX_PRE_ALERT_MINUTES,
  MIN_PRE_ALERT_MINUTES,
  SETTINGS_VERSION,
  createDefaultTimetables,
  type DayOverride,
  type DayOverrideKind,
  type DayTimetable,
  type Holiday,
  type PeriodKind,
  type ThemeMode,
  type TimetablePeriod,
  type UserSettings,
} from '../types'
import { getAutoSemesterWindow, isValidSemesterRange } from './semesterWindow'
import {
  DAY_IN_MS,
  currentKstDateKey,
  isValidDateInput,
  isValidTimeInput,
  parseDateInput,
} from './time'

export const STORAGE_KEY = 'school-survival-clock.settings.v3'
/** Keys used by earlier builds; read once so returning users keep their data. */
export const LEGACY_STORAGE_KEYS = [
  'school-survival-clock.settings.v2',
  'teacher-survival-dashboard-settings',
  'school-survival-clock.settings.v1',
]

/** One-day exceptions further than this from today are pruned on load. */
export const OVERRIDE_WINDOW_DAYS = 6
const MAX_DAY_OVERRIDES = 14

const PERIOD_KINDS: PeriodKind[] = ['class', 'lunch', 'club', 'duty']
const THEME_MODES: ThemeMode[] = ['dark', 'light', 'system']
const OVERRIDE_KINDS: DayOverrideKind[] = ['off', 'short']

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

function asPreAlertMinutes(value: unknown): number {
  const minutes = Number(value)
  if (!Number.isFinite(minutes)) {
    return BASE_SETTINGS.preAlertMinutes
  }
  return Math.min(MAX_PRE_ALERT_MINUTES, Math.max(MIN_PRE_ALERT_MINUTES, Math.round(minutes)))
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
    return [...BASE_SETTINGS.schoolDays]
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
 * Keep only the one-day exceptions that can still matter.
 *
 * The overrides are keyed by date, so "오늘 휴업" simply stops applying at
 * midnight; pruning also stops a long-lived installation from accumulating a
 * year of dead entries.
 */
export function normaliseDayOverrides(value: unknown, todayDateKey: string): Record<string, DayOverride> {
  if (!isRecord(value)) {
    return {}
  }

  const todayMs = parseDateInput(todayDateKey)
  if (!Number.isFinite(todayMs)) {
    return {}
  }

  const overrides: Record<string, DayOverride> = {}
  const dates = Object.keys(value).sort()
  let kept = 0

  for (const date of dates) {
    if (kept >= MAX_DAY_OVERRIDES) {
      break
    }
    const raw = value[date]
    if (!isValidDateInput(date) || !isRecord(raw)) {
      continue
    }
    const daysFromToday = Math.round((parseDateInput(date) - todayMs) / DAY_IN_MS)
    if (Math.abs(daysFromToday) > OVERRIDE_WINDOW_DAYS) {
      continue
    }
    const kind = OVERRIDE_KINDS.find((candidate) => candidate === raw.kind)
    if (!kind) {
      continue
    }
    const dismissalTime = asTime(raw.dismissalTime, '')
    if (kind === 'short' && !isValidTimeInput(dismissalTime)) {
      continue
    }
    overrides[date] = {
      kind,
      label: asString(raw.label, '').trim().slice(0, 24),
      dismissalTime: kind === 'short' ? dismissalTime : '',
    }
    kept += 1
  }

  return overrides
}

/**
 * Was the semester window ever edited by hand?
 *
 * v1/v2 payloads have no `semesterAuto` flag, so the migration looks at the
 * dates themselves: a payload still carrying the exact pair of dates that used
 * to ship as the defaults was never customised, and therefore may follow the
 * automatic calendar like a fresh install.
 */
function resolveSemesterAuto(source: Record<string, unknown>): boolean {
  if (typeof source.semesterAuto === 'boolean') {
    return source.semesterAuto
  }
  if (!isValidDateInput(source.semesterStart) || !isValidDateInput(source.vacationDate)) {
    // Nothing usable stored (fresh install, hand-edited payload): follow the
    // school calendar like the defaults do.
    return true
  }
  return source.semesterStart === LEGACY_DEFAULT_SEMESTER_START
    && source.vacationDate === LEGACY_DEFAULT_VACATION_DATE
}

/** A complete, valid settings object for today (or for an explicit date). */
export function createDefaultSettings(todayDateKey: string = currentKstDateKey()): UserSettings {
  const window = getAutoSemesterWindow(todayDateKey)
  return {
    ...BASE_SETTINGS,
    version: SETTINGS_VERSION,
    semesterStart: window.startDate,
    vacationDate: window.vacationDate,
    semesterAuto: true,
    schoolDays: [...BASE_SETTINGS.schoolDays],
    holidays: [],
    dayOverrides: {},
    timetables: createDefaultTimetables(),
  }
}

/**
 * Turn any persisted (or imported) payload into a fully valid `UserSettings`.
 * Unknown keys are dropped, broken values fall back to defaults, and legacy v1
 * payloads (no timetable, `theme` instead of `themeMode`) are upgraded in
 * place — so the app never has to trust what it reads back.
 */
export function normalizeSettings(
  input: unknown,
  todayDateKey: string = currentKstDateKey(),
): UserSettings {
  const source = isRecord(input) ? input : {}
  const fallback = createDefaultSettings(todayDateKey)
  const timetables = normaliseTimetables(source.timetables)
  const semesterAuto = resolveSemesterAuto(source)

  const storedStart = asDate(source.semesterStart, fallback.semesterStart)
  const storedVacation = asDate(source.vacationDate, fallback.vacationDate)
  // A vacation date before the semester start would invert the battery; such a
  // pair is replaced by the window that matches today's school calendar.
  const manualWindow = isValidSemesterRange(storedStart, storedVacation)
    ? { startDate: storedStart, vacationDate: storedVacation }
    : { startDate: fallback.semesterStart, vacationDate: fallback.vacationDate }
  const window = semesterAuto ? getAutoSemesterWindow(todayDateKey) : manualWindow

  // v1 stored `theme: 'dark' | 'light'`; keep the choice when upgrading.
  const legacyTheme = typeof source.theme === 'string' ? source.theme : undefined
  const themeMode = asThemeMode(
    source.themeMode ?? (legacyTheme === 'dark' || legacyTheme === 'light' ? legacyTheme : undefined),
    BASE_SETTINGS.themeMode,
  )

  return {
    version: SETTINGS_VERSION,
    displayName: asString(source.displayName, BASE_SETTINGS.displayName).trim().slice(0, 40)
      || BASE_SETTINGS.displayName,
    dismissalTime: asTime(source.dismissalTime, BASE_SETTINGS.dismissalTime),
    semesterStart: window.startDate,
    vacationDate: window.vacationDate,
    semesterAuto,
    themeMode,
    soundEnabled: asBoolean(source.soundEnabled, BASE_SETTINGS.soundEnabled),
    notifyEnabled: asBoolean(source.notifyEnabled, BASE_SETTINGS.notifyEnabled),
    preAlertEnabled: asBoolean(source.preAlertEnabled, BASE_SETTINGS.preAlertEnabled),
    preAlertMinutes: asPreAlertMinutes(source.preAlertMinutes),
    schoolDays: normaliseSchoolDays(source.schoolDays),
    holidays: normaliseHolidays(source.holidays),
    dayOverrides: normaliseDayOverrides(source.dayOverrides, todayDateKey),
    timetables,
  }
}

export function cloneSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    schoolDays: [...settings.schoolDays],
    holidays: settings.holidays.map((holiday) => ({ ...holiday })),
    dayOverrides: Object.fromEntries(
      Object.entries(settings.dayOverrides ?? {}).map(([date, override]) => [date, { ...override }]),
    ),
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
  return createDefaultSettings()
}

export function loadSettings(): UserSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultSettings()
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
export function parseSettingsJson(raw: string, todayDateKey: string = currentKstDateKey()): ImportResult {
  const warnings: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { settings: createDefaultSettings(todayDateKey), warnings: ['JSON 형식을 읽을 수 없어 기본값을 사용했어요.'] }
  }

  if (!isRecord(parsed)) {
    return { settings: createDefaultSettings(todayDateKey), warnings: ['설정 객체가 아니어서 기본값을 사용했어요.'] }
  }

  const settings = normalizeSettings(parsed, todayDateKey)
  if (typeof parsed.displayName === 'string' && settings.displayName !== parsed.displayName.trim()) {
    warnings.push('이름이 비어 있어 기본 이름으로 채웠어요.')
  }
  if (Array.isArray(parsed.holidays) && settings.holidays.length < parsed.holidays.length) {
    warnings.push('형식이 맞지 않는 휴일 항목은 건너뛰었어요.')
  }
  if (isRecord(parsed.dayOverrides) && Object.keys(settings.dayOverrides).length < Object.keys(parsed.dayOverrides).length) {
    warnings.push('오늘 하루 예외는 오늘 기준 최근 항목만 유지했어요.')
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
