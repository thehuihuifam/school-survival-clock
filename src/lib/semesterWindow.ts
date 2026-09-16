/**
 * Korean school-calendar windows.
 *
 * The dashboard derives the semester window from *today* rather than freezing
 * hard-coded dates into the defaults: an installation whose semester window is
 * stale would classify every following day as `방학` and pin the survival
 * battery to 100% forever.
 *
 * The approximation below mirrors the national school calendar closely enough
 * to be useful out of the box:
 *
 *   1학기  3월 2일 개학  → 7월 20일 여름방학
 *   2학기  8월 18일 개학 → 다음 해 1월 6일 겨울방학
 *
 * Teachers whose school runs a different calendar switch `semesterAuto` off and
 * type the exact dates in; nothing else in the engine changes.
 *
 * The windows tile the whole calendar, which is what lets the look-ahead
 * helpers (`getNextSchoolDay`, `getNextDayOff`) see past the current vacation:
 * `getAutoSemesterWindow('2026-07-25')` is the spring window (its vacation runs
 * until 8월 17일) while `getAutoSemesterWindow('2026-08-18')` is already the fall
 * window — so the dashboard can promise the 8월 18일 개학일 during 여름방학.
 */
import { parseDateInput } from './time'

export interface SemesterWindow {
  /** `spring` = 1학기, `fall` = 2학기, `manual` = the teacher's own dates. */
  id: 'spring' | 'fall' | 'manual'
  /** `1학기` / `2학기`. */
  label: string
  /** First day of the semester, `YYYY-MM-DD` KST. */
  startDate: string
  /** Vacation start (battery 100%), `YYYY-MM-DD` KST. */
  vacationDate: string
  /** `여름방학` / `겨울방학`. */
  vacationLabel: string
}

/** `MMDD` stamps of the four window edges. */
const SPRING_START_DAY = 302 // 3월 2일
const SUMMER_VACATION_DAY = 720 // 7월 20일
const FALL_START_DAY = 818 // 8월 18일
const WINTER_VACATION_DAY = 106 // 다음 해 1월 6일
/** `MMDD` of March 1st — everything below it belongs to the previous school year. */
const SCHOOL_YEAR_START_DAY = 300

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`
}

function springWindow(year: number): SemesterWindow {
  return {
    id: 'spring',
    label: '1학기',
    startDate: dateKey(year, 3, SPRING_START_DAY % 100),
    vacationDate: dateKey(year, 7, SUMMER_VACATION_DAY % 100),
    vacationLabel: '여름방학',
  }
}

function fallWindow(year: number): SemesterWindow {
  return {
    id: 'fall',
    label: '2학기',
    startDate: dateKey(year, 8, FALL_START_DAY % 100),
    vacationDate: dateKey(year + 1, 1, WINTER_VACATION_DAY % 100),
    vacationLabel: '겨울방학',
  }
}

/**
 * The semester window that contains (or most recently preceded) `todayDateKey`.
 *
 * The boundaries are inclusive on purpose: 8월 17일 still belongs to the summer
 * vacation of the spring window, 8월 18일 is the first day of the fall window,
 * and 1월 6일 is already winter vacation.
 */
export function getAutoSemesterWindow(todayDateKey: string): SemesterWindow {
  const parts = todayDateKey.split('-').map(Number)
  const [year, month, day] = parts
  const isValid = parts.length === 3
    && Number.isInteger(year)
    && Number.isInteger(month)
    && Number.isInteger(day)
  if (!isValid) {
    // Defensive: an unparseable key falls back to the current calendar year's
    // spring semester instead of throwing inside a render.
    return springWindow(new Date().getUTCFullYear())
  }

  const stamp = month * 100 + day
  if (stamp >= FALL_START_DAY) {
    return fallWindow(year)
  }
  if (stamp < SCHOOL_YEAR_START_DAY) {
    // January – February: the fall window that started last August, so the
    // winter vacation keeps reading as `방학` until the new school year starts.
    return fallWindow(year - 1)
  }
  // March 1 – August 17: the spring window (semester, then summer vacation).
  return springWindow(year)
}

/** `2학기 · 08.18 개학 → 01.06 겨울방학` */
export function describeSemesterWindow(window: SemesterWindow) {
  return `${window.label} · ${shortDate(window.startDate)} 개학 → ${shortDate(window.vacationDate)} ${window.vacationLabel}`
}

function shortDate(dateKey: string) {
  return dateKey.slice(5).replace('-', '.')
}

/** Do two windows describe the same dates? */
export function sameSemesterWindow(left: SemesterWindow, right: SemesterWindow) {
  return left.startDate === right.startDate && left.vacationDate === right.vacationDate
}

/** Is this a usable semester window (a real start date before a real end)? */
export function isValidSemesterRange(startDate: string, vacationDate: string) {
  const startMs = parseDateInput(startDate)
  const vacationMs = parseDateInput(vacationDate)
  return Number.isFinite(startMs) && Number.isFinite(vacationMs) && vacationMs > startMs
}
