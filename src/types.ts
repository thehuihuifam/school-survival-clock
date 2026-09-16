/**
 * Domain model for the survival dashboard.
 *
 * Everything the UI renders is derived from `UserSettings` + the current KST
 * instant, so these types are the single source of truth shared by the pure
 * schedule engine (`src/lib/schedule.ts`), persistence (`src/lib/settings.ts`)
 * and the components.
 */

export type ThemeMode = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

/** What a block of time means during a school day. */
export type PeriodKind = 'class' | 'lunch' | 'club' | 'duty'

/** Kinds produced by the engine rather than typed in by the user. */
export type SlotKind = PeriodKind | 'break'

/** One user-editable row of a day's timetable. */
export interface TimetablePeriod {
  id: string
  label: string
  kind: PeriodKind
  /** `HH:MM`, KST. */
  start: string
  /** `HH:MM`, KST. Must be later than `start`. */
  end: string
}

/** A single weekday's timetable. */
export interface DayTimetable {
  /** `false` renders the day as "no classes" even if it is a school day. */
  enabled: boolean
  periods: TimetablePeriod[]
}

export interface Holiday {
  /** `YYYY-MM-DD`, KST. */
  date: string
  label: string
}

/** What a one-day exception does to an otherwise normal school day. */
export type DayOverrideKind = 'off' | 'short'

/**
 * A single-date exception that beats the weekly timetable.
 *
 * It exists because real school days are not always the ones in the timetable:
 * a surprise 재량휴업일, a field trip, an exam-day short schedule. The override
 * is keyed by date, so it disappears on its own the next morning.
 */
export interface DayOverride {
  /** `off` = no classes today, `short` = today ends earlier than usual. */
  kind: DayOverrideKind
  /** Free-text reason shown in the day badge (e.g. `재량휴업`). */
  label: string
  /** `HH:MM` KST dismissal for `kind: 'short'`; empty for `kind: 'off'`. */
  dismissalTime: string
}

export interface UserSettings {
  /** Bumped whenever the persisted shape changes (see `src/lib/settings.ts`). */
  version: number
  displayName: string
  /** 목표 퇴근(하교) 시각, `HH:MM` KST. */
  dismissalTime: string
  /** 학기 시작일 `YYYY-MM-DD`. */
  semesterStart: string
  /** 방학 시작일 `YYYY-MM-DD`. */
  vacationDate: string
  /**
   * `true` while the semester window is derived from the Korean school calendar
   * (`src/lib/semesterWindow.ts`) and refreshed on every load. Turning it off
   * keeps the teacher's own dates.
   */
  semesterAuto: boolean
  themeMode: ThemeMode
  soundEnabled: boolean
  notifyEnabled: boolean
  /** 예비종: warn this many minutes before a class starts. */
  preAlertEnabled: boolean
  /** Minutes before the bell (1–15). */
  preAlertMinutes: number
  /** Weekday indices that count as school days (0 = Sunday … 6 = Saturday). */
  schoolDays: number[]
  holidays: Holiday[]
  /** `YYYY-MM-DD` → one-day exception. Expired entries are pruned on load. */
  dayOverrides: Record<string, DayOverride>
  /** Weekday index (as a string key) → timetable. */
  timetables: Record<string, DayTimetable>
}

export interface KstTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** Localised weekday name, e.g. `목요일`. */
  weekday: string
  /** 0 = Sunday … 6 = Saturday, in KST. */
  weekdayIndex: number
  /** `YYYY-MM-DD` in KST. */
  dateKey: string
  /** Seconds since KST midnight. */
  daySeconds: number
  /** The instant these parts describe (ms since the epoch). */
  epochMs: number
  /** KST offset from UTC in ms (32,400,000 unless the rules ever change). */
  offsetMs: number
}

/** One block of the rendered day timeline (class, break, lunch, duty …). */
export interface TimelineSlot {
  id: string
  label: string
  shortLabel: string
  kind: SlotKind
  startSeconds: number
  endSeconds: number
  /** `09:00 ~ 09:40` */
  timeLabel: string
  /** 1-based class ordinal for `kind === 'class'`, otherwise `null`. */
  classIndex: number | null
}

export interface DayOutline {
  slots: TimelineSlot[]
  /** First slot start (seconds since midnight), `null` when the day is empty. */
  dayStartSeconds: number | null
  /** End of the last scheduled block before the duty tail. */
  lastPeriodEndSeconds: number | null
  /** Effective end of the working day (dismissal, never before the last block). */
  dismissalSeconds: number
  classSlots: TimelineSlot[]
  totalClassSeconds: number
  totalBreakSeconds: number
  /** Whole-day span used for the day progress bar. */
  spanSeconds: number
}

export type DayType = 'school' | 'no-classes' | 'weekend' | 'holiday' | 'vacation' | 'before-semester' | 'override'

export interface DayContext {
  dayType: DayType
  /** Short Korean label, e.g. `학교 가는 날`, `주말`. */
  label: string
  /** Longer explanation shown in the hero, e.g. `추석 연휴로 쉬는 날이에요`. */
  description: string
  isSchoolDay: boolean
  /** `true` when there are actual blocks on the timeline today. */
  hasClasses: boolean
  holidayLabel: string | null
}

export type DayPhase =
  | 'off-day'
  | 'before-first-slot'
  | 'in-slot'
  | 'between-slots'
  | 'dismissed'

export interface ScheduleStatus {
  phase: DayPhase
  day: DayContext
  outline: DayOutline
  activeSlot: TimelineSlot | null
  nextSlot: TimelineSlot | null
  /** Seconds left in the active phase (slot, gap, or until the first block). */
  secondsRemaining: number
  /** 0..100 progress through the active slot. */
  slotProgress: number
  /** 0..100 progress from the first block to dismissal. */
  dayProgress: number
  /** 0..100 progress through the break-free teaching load of the day. */
  classLoadProgress: number
  completedClassCount: number
  remainingClassCount: number
  totalClassCount: number
  remainingClassSeconds: number
  completedClassSeconds: number
  totalClassSeconds: number
  /** Seconds since dismissal (0 while still working). */
  secondsSinceDismissal: number
  isBreak: boolean
  /** Seconds-since-midnight boundaries of the current phase. */
  phaseStartSeconds: number
  phaseEndSeconds: number
  /** Stable identity used to detect transitions, e.g. `2026-09-17:in-slot:p3`. */
  phaseKey: string
}

export interface SemesterMetrics {
  /** School-day based charge of the survival battery, 0..100. */
  progress: number
  phase: 'before-semester' | 'in-semester' | 'vacation'
  calendarDaysRemaining: number
  schoolDaysRemaining: number
  totalSchoolDays: number
  elapsedSchoolDays: number
  totalCalendarDays: number
  elapsedCalendarDays: number
  startDate: string
  vacationDate: string
  /** `true` when the configured dates are unusable (battery shows 0). */
  isConfigured: boolean
}

export interface NextDayOff {
  dateKey: string
  label: string
  reason: 'weekend' | 'holiday' | 'vacation' | 'override'
  daysUntil: number
  /** Whole seconds from `now` until KST midnight of that day. */
  secondsUntil: number
}

export interface NextSchoolDay {
  dateKey: string
  label: string
  daysUntil: number
  secondsUntil: number
  /** Seconds from `now` until the first block of that day. */
  secondsUntilFirstPeriod: number
  firstPeriodSeconds: number | null
}

/** Transition events the alert layer reacts to. */
export type ScheduleEventKind =
  | 'class-started'
  | 'break-started'
  | 'lunch-started'
  | 'duty-started'
  | 'dismissed'
  | 'before-first-slot'

export interface ScheduleEvent {
  kind: ScheduleEventKind
  slot: TimelineSlot | null
  /** Seconds the transition happened ago (used to suppress stale replays). */
  ageSeconds: number
}

export const PERIOD_KIND_LABELS: Record<PeriodKind, string> = {
  class: '수업',
  lunch: '점심',
  club: '재량·동아리',
  duty: '방과후·업무',
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const
export const WEEKDAY_LONG_LABELS = [
  '일요일',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
] as const

export const DEFAULT_SCHOOL_DAYS = [1, 2, 3, 4, 5]

export const ELEMENTARY_PERIODS: TimetablePeriod[] = [
  { id: 'p1', label: '1교시', kind: 'class', start: '09:00', end: '09:40' },
  { id: 'p2', label: '2교시', kind: 'class', start: '09:50', end: '10:30' },
  { id: 'p3', label: '3교시', kind: 'class', start: '10:50', end: '11:30' },
  { id: 'p4', label: '4교시', kind: 'class', start: '11:40', end: '12:20' },
  { id: 'lunch', label: '점심시간 및 급식', kind: 'lunch', start: '12:20', end: '13:20' },
  { id: 'p5', label: '5교시', kind: 'class', start: '13:20', end: '14:00' },
  { id: 'p6', label: '6교시', kind: 'class', start: '14:10', end: '14:50' },
]

export const MIDDLE_PERIODS: TimetablePeriod[] = [
  { id: 'p1', label: '1교시', kind: 'class', start: '09:00', end: '09:45' },
  { id: 'p2', label: '2교시', kind: 'class', start: '09:55', end: '10:40' },
  { id: 'p3', label: '3교시', kind: 'class', start: '10:50', end: '11:35' },
  { id: 'p4', label: '4교시', kind: 'class', start: '11:45', end: '12:30' },
  { id: 'lunch', label: '점심시간 및 급식', kind: 'lunch', start: '12:30', end: '13:20' },
  { id: 'p5', label: '5교시', kind: 'class', start: '13:20', end: '14:05' },
  { id: 'p6', label: '6교시', kind: 'class', start: '14:15', end: '15:00' },
  { id: 'p7', label: '7교시', kind: 'class', start: '15:10', end: '15:55' },
]

export const HIGH_PERIODS: TimetablePeriod[] = [
  { id: 'p1', label: '1교시', kind: 'class', start: '08:40', end: '09:30' },
  { id: 'p2', label: '2교시', kind: 'class', start: '09:40', end: '10:30' },
  { id: 'p3', label: '3교시', kind: 'class', start: '10:40', end: '11:30' },
  { id: 'p4', label: '4교시', kind: 'class', start: '11:40', end: '12:30' },
  { id: 'lunch', label: '점심시간 및 급식', kind: 'lunch', start: '12:30', end: '13:20' },
  { id: 'p5', label: '5교시', kind: 'class', start: '13:20', end: '14:10' },
  { id: 'p6', label: '6교시', kind: 'class', start: '14:20', end: '15:10' },
  { id: 'p7', label: '7교시', kind: 'class', start: '15:20', end: '16:10' },
  { id: 'self-study', label: '야간 자율학습', kind: 'club', start: '16:30', end: '17:20' },
]

export const SHORT_FRIDAY_PERIODS: TimetablePeriod[] = [
  { id: 'p1', label: '1교시', kind: 'class', start: '09:00', end: '09:40' },
  { id: 'p2', label: '2교시', kind: 'class', start: '09:50', end: '10:30' },
  { id: 'p3', label: '3교시', kind: 'class', start: '10:40', end: '11:20' },
  { id: 'lunch', label: '점심시간 및 급식', kind: 'lunch', start: '11:30', end: '12:20' },
  { id: 'p4', label: '4교시', kind: 'class', start: '12:20', end: '13:00' },
]

export const MINIMAL_PERIODS: TimetablePeriod[] = []

export interface TimetablePreset {
  id: string
  label: string
  description: string
  periods: TimetablePeriod[]
}

export const TIMETABLE_PRESETS: TimetablePreset[] = [
  {
    id: 'elementary',
    label: '초등학교 6교시',
    description: '09:00 등교 · 40분 수업 · 14:50 하교',
    periods: ELEMENTARY_PERIODS,
  },
  {
    id: 'middle',
    label: '중학교 7교시',
    description: '09:00 등교 · 45분 수업 · 15:55 하교',
    periods: MIDDLE_PERIODS,
  },
  {
    id: 'high',
    label: '고등학교 7교시 + 자습',
    description: '08:40 등교 · 50분 수업 · 야자 17:20',
    periods: HIGH_PERIODS,
  },
  {
    id: 'short-friday',
    label: '단축 4교시',
    description: '금요일·재량휴업일용 짧은 시간표',
    periods: SHORT_FRIDAY_PERIODS,
  },
  {
    id: 'empty',
    label: '비우기',
    description: '이 요일의 교시를 모두 지웁니다',
    periods: MINIMAL_PERIODS,
  },
]

export const SETTINGS_VERSION = 3

/** 예비종 fires this many minutes before a class by default. */
export const DEFAULT_PRE_ALERT_MINUTES = 3
/** Choices offered by the settings UI (minutes before the bell). */
export const PRE_ALERT_MINUTE_OPTIONS = [1, 3, 5, 10]
export const MIN_PRE_ALERT_MINUTES = 1
export const MAX_PRE_ALERT_MINUTES = 15

/**
 * The semester window that older builds shipped as their *defaults*. Payloads
 * still carrying exactly these dates were never edited by hand, so the v2 → v3
 * migration is free to switch them over to the automatic window.
 */
export const LEGACY_DEFAULT_SEMESTER_START = '2026-08-25'
export const LEGACY_DEFAULT_VACATION_DATE = '2026-12-31'

function timetable(periods: TimetablePeriod[], enabled = true): DayTimetable {
  return { enabled, periods: periods.map((period) => ({ ...period })) }
}

export function createDefaultTimetables(): Record<string, DayTimetable> {
  const weekdays = timetable(ELEMENTARY_PERIODS)
  const friday = timetable(SHORT_FRIDAY_PERIODS)
  return {
    0: timetable(MINIMAL_PERIODS, false),
    1: { ...weekdays, periods: weekdays.periods.map((period) => ({ ...period })) },
    2: { ...weekdays, periods: weekdays.periods.map((period) => ({ ...period })) },
    3: { ...weekdays, periods: weekdays.periods.map((period) => ({ ...period })) },
    4: { ...weekdays, periods: weekdays.periods.map((period) => ({ ...period })) },
    5: { ...friday, periods: friday.periods.map((period) => ({ ...period })) },
    6: timetable(MINIMAL_PERIODS, false),
  }
}

/**
 * Every setting except the semester window.
 *
 * The window itself cannot live here: it is derived from today's date
 * (`createDefaultSettings()` in `src/lib/settings.ts`), which is what keeps a
 * fresh install usable in any year instead of freezing on one hard-coded
 * semester.
 */
export type StaticSettings = Omit<UserSettings, 'semesterStart' | 'vacationDate' | 'semesterAuto'>

export const BASE_SETTINGS: StaticSettings = {
  version: SETTINGS_VERSION,
  displayName: '김선생님',
  dismissalTime: '16:30',
  themeMode: 'dark',
  soundEnabled: true,
  notifyEnabled: false,
  preAlertEnabled: true,
  preAlertMinutes: DEFAULT_PRE_ALERT_MINUTES,
  schoolDays: [...DEFAULT_SCHOOL_DAYS],
  holidays: [],
  dayOverrides: {},
  timetables: createDefaultTimetables(),
}
