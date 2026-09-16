export type Theme = 'dark' | 'light'

export interface SchedulePeriod {
  id: string
  label: string
  shortLabel: string
  start: string
  end: string
}

export const DEFAULT_SCHEDULE: SchedulePeriod[] = [
  { id: 'period-1', label: '1교시', shortLabel: '1', start: '09:00', end: '09:40' },
  { id: 'period-2', label: '2교시', shortLabel: '2', start: '09:50', end: '10:30' },
  { id: 'period-3', label: '3교시', shortLabel: '3', start: '10:50', end: '11:30' },
  { id: 'period-4', label: '4교시', shortLabel: '4', start: '11:40', end: '12:20' },
  { id: 'period-5', label: '5교시', shortLabel: '5', start: '13:20', end: '14:00' },
  { id: 'period-6', label: '6교시', shortLabel: '6', start: '14:10', end: '14:50' },
]

export const DEFAULT_LUNCH = {
  start: '12:20',
  end: '13:20',
}

export interface UserSettings {
  displayName: string
  dismissalTime: string
  semesterStart: string
  vacationDate: string
  theme: Theme
  schedule: SchedulePeriod[]
  lunchStart: string
  lunchEnd: string
  holidayDates: string[]
}

export interface KstTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: string
  weekdayIndex: number
  dateKey: string
}

export interface BatteryMetrics {
  progress: number
  daysRemaining: number
  totalDays: number
  elapsedDays: number
  totalSchoolDays: number
  elapsedSchoolDays: number
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

export type DayOffReason = 'weekend' | 'holiday'

export interface SchoolDayContext {
  isSchoolDay: boolean
  isWeekend: boolean
  isHoliday: boolean
  reason: DayOffReason | null
  label: string
  dateKey: string
}

export interface PeriodStatus {
  slotId: string
  label: string
  timeLabel: string
  minutesRemaining: number
  isBreak: boolean
  isBeforeSchool: boolean
  isAfterSchool: boolean
  isOffDay: boolean
}
