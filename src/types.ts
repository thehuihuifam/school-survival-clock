export type Theme = 'dark' | 'light'

export interface UserSettings {
  displayName: string
  dismissalTime: string
  semesterStart: string
  vacationDate: string
  theme: Theme
}

export interface KstTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: string
  dateKey: string
}

export interface BatteryMetrics {
  progress: number
  daysRemaining: number
  totalDays: number
  elapsedDays: number
  startDate: string
  vacationDate: string
}

export interface PeriodDefinition {
  id: string
  label: string
  shortLabel: string
  startSeconds: number
  endSeconds: number
  timeLabel: string
  kind: 'period' | 'break'
}

export interface PeriodStatus {
  slotId: string
  label: string
  timeLabel: string
  minutesRemaining: number
  isBreak: boolean
  isBeforeSchool: boolean
  isAfterSchool: boolean
}
