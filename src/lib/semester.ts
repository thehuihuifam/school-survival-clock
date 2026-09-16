/**
 * Semester battery maths.
 *
 * The survival battery charges per *school day*, not per calendar day: a
 * teacher who survived 30 of 90 teaching days is at 33%, weekends and
 * registered holidays do not count, and the gauge pins to 0/100 outside the
 * configured semester window.
 */
import type { KstTimeParts, SemesterMetrics, UserSettings } from '../types'
import {
  DAY_IN_MS,
  clamp,
  dateKeyFromUtcMs,
  differenceInDays,
  parseDateInput,
} from './time'
import {
  isBeforeSemester,
  isInVacation,
  isHolidayDate,
  isSchoolWeekday,
  weekdayHasClasses,
} from './schedule'
import { weekdayIndexFromDateKey } from './time'

/**
 * Count teaching days in `[fromDateKey, toDateKey)` — half-open so the
 * elapsed + remaining split never double-counts a day.
 */
export function countSchoolDays(settings: UserSettings, fromDateKey: string, toDateKey: string) {
  const fromMs = parseDateInput(fromDateKey)
  const toMs = parseDateInput(toDateKey)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return 0
  }

  let count = 0
  for (let cursor = fromMs; cursor < toMs; cursor += DAY_IN_MS) {
    const dateKey = dateKeyFromUtcMs(cursor)
    if (!isSchoolWeekday(settings, weekdayIndexFromDateKey(dateKey))) {
      continue
    }
    if (isHolidayDate(settings, dateKey)) {
      continue
    }
    if (!weekdayHasClasses(settings, weekdayIndexFromDateKey(dateKey))) {
      continue
    }
    count += 1
  }
  return count
}

export function getSemesterMetrics(now: KstTimeParts, settings: UserSettings): SemesterMetrics {
  const startMs = parseDateInput(settings.semesterStart)
  const vacationMs = parseDateInput(settings.vacationDate)
  const todayMs = parseDateInput(now.dateKey)
  // A vacation date on/before the semester start would invert the battery, so
  // the pair is treated as "not configured" and the gauge rests at zero.
  const isConfigured = Number.isFinite(startMs)
    && Number.isFinite(vacationMs)
    && Number.isFinite(todayMs)
    && vacationMs > startMs

  if (!isConfigured) {
    return {
      progress: 0,
      phase: 'before-semester',
      calendarDaysRemaining: 0,
      schoolDaysRemaining: 0,
      totalSchoolDays: 0,
      elapsedSchoolDays: 0,
      totalCalendarDays: 0,
      elapsedCalendarDays: 0,
      startDate: settings.semesterStart,
      vacationDate: settings.vacationDate,
      isConfigured: false,
    }
  }

  const inVacation = isInVacation(settings, now.dateKey)
  const beforeSemester = isBeforeSemester(settings, now.dateKey)
  const phase: SemesterMetrics['phase'] = inVacation
    ? 'vacation'
    : beforeSemester
      ? 'before-semester'
      : 'in-semester'

  const totalCalendarDays = Math.max(0, differenceInDays(vacationMs, startMs))
  const totalSchoolDays = vacationMs > startMs ? countSchoolDays(settings, settings.semesterStart, settings.vacationDate) : 0

  // Elapsed counts [start, today); remaining counts [today, vacation).
  const elapsedAnchorMs = clamp(todayMs, startMs, vacationMs)
  const elapsedSchoolDays = countSchoolDays(
    settings,
    settings.semesterStart,
    dateKeyFromUtcMs(elapsedAnchorMs),
  )
  const schoolDaysRemaining = countSchoolDays(
    settings,
    dateKeyFromUtcMs(Math.max(todayMs, startMs)),
    settings.vacationDate,
  )

  const progress = phase === 'vacation'
    ? 100
    : phase === 'before-semester' || totalSchoolDays === 0
      ? 0
      : clamp((elapsedSchoolDays / totalSchoolDays) * 100, 0, 100)

  return {
    progress,
    phase,
    calendarDaysRemaining: Math.max(0, differenceInDays(vacationMs, todayMs)),
    schoolDaysRemaining,
    totalSchoolDays,
    elapsedSchoolDays,
    totalCalendarDays,
    elapsedCalendarDays: clamp(differenceInDays(todayMs, startMs), 0, totalCalendarDays),
    startDate: settings.semesterStart,
    vacationDate: settings.vacationDate,
    isConfigured: true,
  }
}
