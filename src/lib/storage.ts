import type { Theme, UserSettings, SchedulePeriod } from '../types'
import { DEFAULT_LUNCH, DEFAULT_SCHEDULE } from '../types'
import {
  getScheduleEndSeconds,
  isValidDateInput,
  isValidTimeInput,
  parseTimeToSeconds,
} from './time'

export const STORAGE_KEY = 'teacher-survival-dashboard-settings'

export const DEFAULT_SETTINGS: UserSettings = {
  displayName: '전주 OO초등학교 김선생님',
  dismissalTime: '16:30',
  semesterStart: '2026-08-25',
  vacationDate: '2026-12-31',
  theme: 'dark',
  schedule: DEFAULT_SCHEDULE.map((period) => ({ ...period })),
  lunchStart: DEFAULT_LUNCH.start,
  lunchEnd: DEFAULT_LUNCH.end,
  holidayDates: [],
}

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

function isSchedulePeriod(value: unknown): value is SchedulePeriod {
  if (!value || typeof value !== 'object') {
    return false
  }
  const period = value as Partial<SchedulePeriod>
  return typeof period.id === 'string' &&
    typeof period.label === 'string' &&
    typeof period.shortLabel === 'string' &&
    typeof period.start === 'string' &&
    typeof period.end === 'string' &&
    isValidTimeInput(period.start) &&
    isValidTimeInput(period.end) &&
    parseTimeToSeconds(period.end) > parseTimeToSeconds(period.start)
}

function isSafeSchedule(schedule: SchedulePeriod[], lunchStart: string, lunchEnd: string) {
  if (schedule.length !== DEFAULT_SCHEDULE.length || !isValidTimeInput(lunchStart) || !isValidTimeInput(lunchEnd) || parseTimeToSeconds(lunchEnd) <= parseTimeToSeconds(lunchStart)) {
    return false
  }

  for (let index = 1; index < schedule.length; index += 1) {
    if (parseTimeToSeconds(schedule[index].start) < parseTimeToSeconds(schedule[index - 1].end)) {
      return false
    }
  }

  const blocks = [
    ...schedule.map((period) => ({ start: parseTimeToSeconds(period.start), end: parseTimeToSeconds(period.end) })),
    { start: parseTimeToSeconds(lunchStart), end: parseTimeToSeconds(lunchEnd) },
  ].sort((left, right) => left.start - right.start)

  return blocks.every((block, index) => index === 0 || block.start >= blocks[index - 1].end)
}

function getSafeSchedule(value: unknown, lunchStart: unknown, lunchEnd: unknown) {
  const candidate = Array.isArray(value) && value.length === DEFAULT_SCHEDULE.length && value.every(isSchedulePeriod)
    ? value
    : DEFAULT_SCHEDULE
  const safeLunchStart = typeof lunchStart === 'string' && isValidTimeInput(lunchStart) ? lunchStart : DEFAULT_LUNCH.start
  const safeLunchEnd = typeof lunchEnd === 'string' && isValidTimeInput(lunchEnd) ? lunchEnd : DEFAULT_LUNCH.end

  if (!isSafeSchedule(candidate, safeLunchStart, safeLunchEnd)) {
    return {
      schedule: DEFAULT_SCHEDULE.map((period) => ({ ...period })),
      lunchStart: DEFAULT_LUNCH.start,
      lunchEnd: DEFAULT_LUNCH.end,
    }
  }

  return {
    schedule: candidate.map((period) => ({ ...period })),
    lunchStart: safeLunchStart,
    lunchEnd: safeLunchEnd,
  }
}

function getSafeHolidayDates(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }
  return [...new Set(value.filter((date): date is string => typeof date === 'string' && isValidDateInput(date)))]
}

export function loadSettings(): UserSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return DEFAULT_SETTINGS
    }
    const parsed = JSON.parse(saved) as Partial<UserSettings>
    const scheduleSettings = getSafeSchedule(parsed.schedule, parsed.lunchStart, parsed.lunchEnd)
    const isDate = (value: unknown): value is string => typeof value === 'string' && isValidDateInput(value)
    const isTime = (value: unknown): value is string => typeof value === 'string' && isValidTimeInput(value)
    const dismissalTime = isTime(parsed.dismissalTime) && parseTimeToSeconds(parsed.dismissalTime) > getScheduleEndSeconds(scheduleSettings.schedule, scheduleSettings.lunchStart, scheduleSettings.lunchEnd)
      ? parsed.dismissalTime
      : DEFAULT_SETTINGS.dismissalTime
    const semesterStart = isDate(parsed.semesterStart) ? parsed.semesterStart : DEFAULT_SETTINGS.semesterStart
    const vacationDate = isDate(parsed.vacationDate) && parsed.vacationDate > semesterStart
      ? parsed.vacationDate
      : DEFAULT_SETTINGS.vacationDate

    return {
      displayName: typeof parsed.displayName === 'string' && parsed.displayName.trim()
        ? parsed.displayName.trim().slice(0, 42)
        : DEFAULT_SETTINGS.displayName,
      dismissalTime,
      semesterStart,
      vacationDate,
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
      ...scheduleSettings,
      holidayDates: getSafeHolidayDates(parsed.holidayDates),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: UserSettings) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Private browsing or a full storage quota should never stop the clock.
  }
}
