import type { Theme, UserSettings } from '../types'

export const STORAGE_KEY = 'teacher-survival-dashboard-settings'

export const DEFAULT_SETTINGS: UserSettings = {
  displayName: '전주 OO초등학교 김선생님',
  dismissalTime: '16:30',
  semesterStart: '2026-08-25',
  vacationDate: '2026-12-31',
  theme: 'dark',
}

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
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
    const isDateInput = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    const isTimeInput = (value: unknown): value is string => typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)

    return {
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : DEFAULT_SETTINGS.displayName,
      dismissalTime: isTimeInput(parsed.dismissalTime) ? parsed.dismissalTime : DEFAULT_SETTINGS.dismissalTime,
      semesterStart: isDateInput(parsed.semesterStart) ? parsed.semesterStart : DEFAULT_SETTINGS.semesterStart,
      vacationDate: isDateInput(parsed.vacationDate) ? parsed.vacationDate : DEFAULT_SETTINGS.vacationDate,
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: UserSettings) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }
}
