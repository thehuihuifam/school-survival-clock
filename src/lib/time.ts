/**
 * KST clock primitives.
 *
 * The dashboard is always anchored to Asia/Seoul regardless of the device's
 * own time zone, so every calculation goes through the parts produced here.
 * Nothing in this module touches the DOM, which keeps it unit-testable.
 */
import { WEEKDAY_LABELS, WEEKDAY_LONG_LABELS, type KstTimeParts } from '../types'

export const SEOUL_TIME_ZONE = 'Asia/Seoul'
export const DAY_IN_MS = 24 * 60 * 60 * 1000
export const MINUTE_IN_SECONDS = 60
export const HOUR_IN_SECONDS = 3600
export const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS

const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export const pad = (value: number, size = 2) => String(Math.trunc(value)).padStart(size, '0')

/** Decompose an instant into Korean wall-clock parts (Asia/Seoul). */
export function getKstTimeParts(date: Date): KstTimeParts {
  const parts = kstFormatter.formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value
    return result
  }, {})

  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)
  // `hourCycle: 'h23'` should already avoid 24:00, but midnight formatting is
  // locale-engine dependent, so normalise defensively.
  const hour = Number(parts.hour) % 24
  const minute = Number(parts.minute)
  const second = Number(parts.second)
  const epochMs = date.getTime()
  const offsetMs = Date.UTC(year, month - 1, day, hour, minute, second) - Math.floor(epochMs / 1000) * 1000

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: parts.weekday || WEEKDAY_LONG_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()],
    weekdayIndex: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    dateKey: `${year}-${pad(month)}-${pad(day)}`,
    daySeconds: hour * HOUR_IN_SECONDS + minute * MINUTE_IN_SECONDS + second,
    epochMs,
    offsetMs,
  }
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export function formatKstDate(parts: KstTimeParts) {
  return `${String(parts.year).slice(-2)}.${pad(parts.month)}.${pad(parts.day)} ${parts.weekday}`
}

export function formatFullKstDate(parts: KstTimeParts) {
  return `${parts.year}년 ${parts.month}월 ${parts.day}일 ${parts.weekday}`
}

export function formatKstTime(parts: KstTimeParts) {
  return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
}

export function formatKstHourMinute(parts: KstTimeParts) {
  return `${pad(parts.hour)}:${pad(parts.minute)}`
}

export function weekdayLabel(weekdayIndex: number) {
  return WEEKDAY_LABELS[((weekdayIndex % 7) + 7) % 7] ?? ''
}

export function weekdayLongLabel(weekdayIndex: number) {
  return WEEKDAY_LONG_LABELS[((weekdayIndex % 7) + 7) % 7] ?? ''
}

/** `HH:MM:SS`, clamped to non-negative whole seconds. */
export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / HOUR_IN_SECONDS)
  const minutes = Math.floor((safeSeconds % HOUR_IN_SECONDS) / MINUTE_IN_SECONDS)
  const seconds = safeSeconds % MINUTE_IN_SECONDS
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** `HH:MM` from a seconds-since-midnight value (also handles > 24h spans). */
export function formatHmFromSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  return `${pad(Math.floor(safeSeconds / HOUR_IN_SECONDS))}:${pad(Math.floor((safeSeconds % HOUR_IN_SECONDS) / MINUTE_IN_SECONDS))}`
}

/**
 * Conversational duration: `43초`, `12분`, `2시간 5분`, `3일 4시간`.
 * `granularity` caps how many units are emitted.
 */
export function formatHumanDuration(totalSeconds: number, granularity = 2) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  if (safeSeconds === 0) {
    return '0분'
  }

  const units: Array<[number, string]> = [
    [DAY_IN_SECONDS, '일'],
    [HOUR_IN_SECONDS, '시간'],
    [MINUTE_IN_SECONDS, '분'],
    [1, '초'],
  ]

  const pieces: string[] = []
  let remainder = safeSeconds
  for (const [size, suffix] of units) {
    const value = Math.floor(remainder / size)
    if (value > 0) {
      pieces.push(`${value}${suffix}`)
      remainder -= value * size
    }
    if (pieces.length >= granularity) {
      break
    }
  }

  return pieces.length > 0 ? pieces.join(' ') : '0초'
}

/** Minutes-only phrasing used by the timeline copy (`90분` → `1시간 30분`). */
export function formatMinutes(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / HOUR_IN_SECONDS)
  const minutes = Math.round((safeSeconds % HOUR_IN_SECONDS) / MINUTE_IN_SECONDS)
  if (hours === 0) {
    return `${minutes}분`
  }
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`
}

export function formatPercent(value: number, digits = 1) {
  const safe = Number.isFinite(value) ? value : 0
  return safe.toFixed(digits)
}

/* ------------------------------------------------------------------ *
 * `HH:MM` / `YYYY-MM-DD` parsing (never trusts the raw string)
 * ------------------------------------------------------------------ */

export function isValidTimeInput(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{1,2}:\d{2}$/.test(value)) {
    return false
  }
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/**
 * `HH:MM` → seconds since midnight. Invalid input falls back to `fallback`
 * (16:30, the classic Korean dismissal time) so the UI never renders `NaN`.
 */
export function parseTimeToSeconds(time: string, fallback = 16 * HOUR_IN_SECONDS + 30 * MINUTE_IN_SECONDS) {
  if (!isValidTimeInput(time)) {
    return fallback
  }
  const [hours, minutes] = time.split(':').map(Number)
  return hours * HOUR_IN_SECONDS + minutes * MINUTE_IN_SECONDS
}

export function isValidDateInput(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const roundTrip = new Date(Date.UTC(year, month - 1, day))
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day
  )
}

/** `YYYY-MM-DD` → UTC midnight in ms (`NaN` when the date is not real). */
export function parseDateInput(value: string) {
  if (!isValidDateInput(value)) {
    return Number.NaN
  }
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function dateInputFromKst(parts: KstTimeParts) {
  return parts.dateKey
}

/** Turn an epoch value back into a `YYYY-MM-DD` key (UTC calendar). */
export function dateKeyFromUtcMs(value: number) {
  const date = new Date(value)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function weekdayIndexFromDateKey(dateKey: string) {
  const ms = parseDateInput(dateKey)
  if (!Number.isFinite(ms)) {
    return 0
  }
  return new Date(ms).getUTCDay()
}

export function shiftDateKey(dateKey: string, days: number) {
  const ms = parseDateInput(dateKey)
  if (!Number.isFinite(ms)) {
    return dateKey
  }
  return dateKeyFromUtcMs(ms + days * DAY_IN_MS)
}

export function differenceInDays(later: number, earlier: number) {
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) {
    return 0
  }
  return Math.round((later - earlier) / DAY_IN_MS)
}

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}

/** `09.17 (목)` style label used across the cards. */
export function formatDateKeyShort(dateKey: string) {
  if (!isValidDateInput(dateKey)) {
    return dateKey
  }
  const [, month, day] = dateKey.split('-')
  return `${month}.${day}`
}

export function formatDateKeyWithWeekday(dateKey: string) {
  if (!isValidDateInput(dateKey)) {
    return dateKey
  }
  const [year, month, day] = dateKey.split('-')
  return `${year}.${month}.${day} (${weekdayLabel(weekdayIndexFromDateKey(dateKey))})`
}

/**
 * Real instant (epoch ms) of a KST wall-clock moment.
 * Anchored to the offset carried by `reference` so the result stays correct
 * even if Korean time-zone rules ever changed.
 */
export function kstInstant(reference: KstTimeParts, dateKey: string, daySeconds = 0) {
  const ms = parseDateInput(dateKey)
  if (!Number.isFinite(ms)) {
    return Number.NaN
  }
  return ms + daySeconds * 1000 - reference.offsetMs
}

/** Whole seconds from `reference` until KST midnight that starts `dateKey`. */
export function secondsUntilDateKey(reference: KstTimeParts, dateKey: string) {
  const target = kstInstant(reference, dateKey, 0)
  if (!Number.isFinite(target)) {
    return 0
  }
  return Math.round((target - reference.epochMs) / 1000)
}

/** Seconds from midnight to the next midnight, respecting the real offset. */
export function secondsUntilNextMidnight(reference: KstTimeParts) {
  return secondsUntilDateKey(reference, shiftDateKey(reference.dateKey, 1))
}
