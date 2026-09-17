/**
 * KST clock primitives.
 *
 * The dashboard is always anchored to Asia/Seoul regardless of the device's
 * own time zone, so every calculation goes through the parts produced here.
 * Nothing in this module touches the DOM, which keeps it unit-testable.
 */
import { WEEKDAY_LABELS, WEEKDAY_LONG_LABELS, type KstTimeParts } from '../types'

const SEOUL_TIME_ZONE = 'Asia/Seoul'
export const DAY_IN_MS = 24 * 60 * 60 * 1000
const MINUTE_IN_SECONDS = 60
const HOUR_IN_SECONDS = 3600
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

/**
 * Today's KST calendar date key (`YYYY-MM-DD`) — the app's definition of
 * "today". Every automatic decision (semester window, day overrides, default
 * settings) is anchored to this instead of the device clock, so a teacher
 * travelling abroad still sees the Korean school day.
 */
export function currentKstDateKey(date: Date = new Date()) {
  return getKstTimeParts(date).dateKey
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/**
 * Long date without the weekday. 요일은 히어로에서 바로 뒤에 붙여 한 줄로 읽는다.
 */
export function formatFullKstDate(parts: KstTimeParts) {
  return `${parts.year}년 ${parts.month}월 ${parts.day}일`
}

export function weekdayLabel(weekdayIndex: number) {
  return WEEKDAY_LABELS[((weekdayIndex % 7) + 7) % 7] ?? ''
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

/** `2026-09-17` → `09.17`; anything unparseable is echoed back untouched. */
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

/* ------------------------------------------------------------------ *
 * Korean particle helpers (조사)
 *
 * Korean picks a particle based on whether the preceding syllable ends in a
 * consonant (받침). Interpolating a user- or calendar-supplied noun straight
 * into a sentence therefore produces things like "추석로 쉬는 날" instead of
 * "추석으로". These helpers pick the right form so the copy reads naturally
 * whatever the teacher typed.
 * ------------------------------------------------------------------ */

const HANGUL_BASE = 0xac00
const HANGUL_LAST = 0xd7a3
/** Jongseong (받침) index of ㄹ inside a composed Hangul syllable. */
const RIEUL_JONGSEONG = 8
/** Digits whose Korean pronunciation ends in a consonant: 1,3,6,7,8,0. */
const DIGITS_WITH_BATCHIM = new Set(['1', '3', '6', '7', '8', '0'])
/** Digits pronounced with a final ㄹ: 1 (일), 7 (칠), 8 (팔). */
const DIGITS_ENDING_IN_RIEUL = new Set(['1', '7', '8'])

/**
 * Does the last character of `word` end in a 받침 (final consonant)?
 * Returns `null` when the ending cannot be determined (e.g. latin letters),
 * which lets callers fall back to a neutral phrasing.
 */
export function endsWithConsonant(word: string): boolean | null {
  const trimmed = word.trim()
  if (!trimmed) {
    return null
  }
  const code = trimmed.charCodeAt(trimmed.length - 1)

  if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
    // 받침 index 0 means the syllable ends in a vowel.
    return (code - HANGUL_BASE) % 28 !== 0
  }
  const lastChar = trimmed[trimmed.length - 1]
  if (lastChar >= '0' && lastChar <= '9') {
    return DIGITS_WITH_BATCHIM.has(lastChar)
  }
  return null
}

/** Does the last character end in a ㄹ 받침? (`null` when undeterminable.) */
function endsWithRieul(word: string): boolean | null {
  const trimmed = word.trim()
  if (!trimmed) {
    return null
  }
  const code = trimmed.charCodeAt(trimmed.length - 1)
  if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
    return (code - HANGUL_BASE) % 28 === RIEUL_JONGSEONG
  }
  const lastChar = trimmed[trimmed.length - 1]
  if (lastChar >= '0' && lastChar <= '9') {
    return DIGITS_ENDING_IN_RIEUL.has(lastChar)
  }
  return null
}

/**
 * Append the correct particle to `word`.
 *
 * `withParticle('추석', '으로', '로')` → `'추석으로'`
 * `withParticle('설날', '으로', '로')` → `'설날로'`  (ㄹ 예외)
 * `withParticle('국어', '과', '와')` → `'국어와'`
 *
 * The 으로/로 pair carries a well-known exception: a word ending in ㄹ takes
 * the *vowel* form (설날로, 개교기념일로), unlike every other consonant. Other
 * particle pairs (은/는, 이/가, 을/를, 과/와) follow the plain 받침 rule.
 *
 * When the ending cannot be determined — latin letters, symbols — both forms
 * are shown (`과(와)` style), which is the conventional Korean fallback.
 */
export function withParticle(word: string, afterConsonant: string, afterVowel: string) {
  const trimmed = word.trim()
  const hasBatchim = endsWithConsonant(trimmed)
  if (hasBatchim === null) {
    return `${trimmed}${afterConsonant}(${afterVowel})`
  }
  // ㄹ + 으로 → 로.
  if (hasBatchim && afterVowel === '로' && endsWithRieul(trimmed) === true) {
    return `${trimmed}${afterVowel}`
  }
  return `${trimmed}${hasBatchim ? afterConsonant : afterVowel}`
}
