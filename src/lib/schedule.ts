/**
 * Schedule engine.
 *
 * Pure functions that turn `UserSettings` + the current KST instant into the
 * day outline (classes, auto-generated breaks, lunch, after-school duty tail),
 * the live phase status and the "what comes next" lookups. No React, no DOM —
 * everything here is covered by unit tests in `src/lib/__tests__`.
 */
import {
  WEEKDAY_LONG_LABELS,
  type DayContext,
  type DayOutline,
  type DayOverride,
  type DayTimetable,
  type Holiday,
  type KstTimeParts,
  type NextDayOff,
  type NextSchoolDay,
  type ScheduleStatus,
  type TimetablePeriod,
  type UserSettings,
} from '../types'
import { builtinHolidayLabel } from './holidays'
import { getAutoSemesterWindow, type SemesterWindow } from './semesterWindow'
import {
  DAY_IN_SECONDS,
  clamp,
  formatDateKeyShort,
  formatHmFromSeconds,
  isValidDateInput,
  isValidTimeInput,
  parseDateInput,
  parseTimeToSeconds,
  secondsUntilDateKey,
  shiftDateKey,
  weekdayIndexFromDateKey,
  weekdayLabel,
  withParticle,
} from './time'

/** Gaps shorter than this are treated as back-to-back blocks (no break slot). */
const MIN_BREAK_SECONDS = 5 * 60
/** A duty tail shorter than this is folded into the last block instead. */
const MIN_DUTY_SECONDS = 10 * 60

const EMPTY_OUTLINE: DayOutline = {
  slots: [],
  dayStartSeconds: null,
  lastPeriodEndSeconds: null,
  dismissalSeconds: 0,
  classSlots: [],
  totalClassSeconds: 0,
  totalBreakSeconds: 0,
  spanSeconds: 0,
}

/** A fresh, empty outline (never the shared constant: callers may extend it). */
function emptyOutline(): DayOutline {
  return { ...EMPTY_OUTLINE, slots: [], classSlots: [] }
}

const EMPTY_TIMETABLE: DayTimetable = { enabled: false, periods: [] }

/* ------------------------------------------------------------------ *
 * Timetable access + sanitising
 * ------------------------------------------------------------------ */

export function getDayTimetable(settings: UserSettings, weekdayIndex: number): DayTimetable {
  const key = String(((weekdayIndex % 7) + 7) % 7)
  return settings.timetables[key] ?? EMPTY_TIMETABLE
}

/** The one-day exception registered for `dateKey`, when there is one. */
export function getDayOverride(settings: UserSettings, dateKey: string): DayOverride | null {
  return settings.dayOverrides?.[dateKey] ?? null
}

/** `true` when the teacher marked the whole day as "no classes". */
export function isDayOffOverride(settings: UserSettings, dateKey: string) {
  return getDayOverride(settings, dateKey)?.kind === 'off'
}

/**
 * Dismissal time that applies to a specific date.
 *
 * A `short` override (단축 수업, 시험 기간) replaces the configured dismissal for
 * that date only, so the timeline, the hero countdown and the celebration all
 * agree without touching the weekly timetable.
 */
export function dismissalTimeFor(settings: UserSettings, dateKey: string): string {
  const override = getDayOverride(settings, dateKey)
  if (override?.kind === 'short' && isValidTimeInput(override.dismissalTime)) {
    return override.dismissalTime
  }
  return settings.dismissalTime
}

/**
 * A short-day override is a hard stop, not just an earlier countdown: blocks
 * that start after it are dropped and a block straddling it is cut short, which
 * is what 단축 수업 actually does to the timetable.
 */
function hardStopFor(settings: UserSettings, dateKey: string): number | undefined {
  const override = getDayOverride(settings, dateKey)
  if (override?.kind !== 'short' || !isValidTimeInput(override.dismissalTime)) {
    return undefined
  }
  return parseTimeToSeconds(override.dismissalTime)
}

/** Day outline for a date, with every one-day exception already applied. */
export function buildDayOutline(settings: UserSettings, dateKey: string, weekdayIndex: number): DayOutline {
  return buildOutline(
    getDayTimetable(settings, weekdayIndex),
    dismissalTimeFor(settings, dateKey),
    hardStopFor(settings, dateKey),
  )
}

function isWellFormedPeriod(period: TimetablePeriod): boolean {
  return (
    typeof period?.label === 'string' &&
    period.label.trim().length > 0 &&
    isValidTimeInput(period.start) &&
    isValidTimeInput(period.end) &&
    parseTimeToSeconds(period.end) > parseTimeToSeconds(period.start)
  )
}

/**
 * Drop malformed rows, sort by start time and resolve overlaps by keeping the
 * earlier block. The engine is deliberately forgiving: a half-broken timetable
 * still renders the usable part instead of throwing the whole day away.
 */
export function sanitizePeriods(periods: TimetablePeriod[]): TimetablePeriod[] {
  const valid = (Array.isArray(periods) ? periods : []).filter(isWellFormedPeriod)
  const sorted = [...valid].sort(
    (left, right) => parseTimeToSeconds(left.start) - parseTimeToSeconds(right.start),
  )

  const kept: TimetablePeriod[] = []
  let previousEnd = -1
  for (const period of sorted) {
    const start = parseTimeToSeconds(period.start)
    if (start < previousEnd) {
      continue
    }
    kept.push(period)
    previousEnd = parseTimeToSeconds(period.end)
  }
  return kept
}

function shortLabelFor(period: TimetablePeriod, classOrdinal: number) {
  if (period.kind === 'lunch') {
    return '점심'
  }
  if (period.kind === 'club') {
    return '재량'
  }
  if (period.kind === 'duty') {
    return '업무'
  }
  return String(classOrdinal)
}

/* ------------------------------------------------------------------ *
 * Day outline
 * ------------------------------------------------------------------ */

export function buildOutline(
  timetable: DayTimetable,
  dismissalTime: string,
  hardStopSeconds?: number,
): DayOutline {
  if (!timetable?.enabled) {
    return emptyOutline()
  }

  const periods = truncatePeriods(sanitizePeriods(timetable.periods), hardStopSeconds)
  if (periods.length === 0) {
    return emptyOutline()
  }

  const slots: DayOutline['slots'] = []
  let classOrdinal = 0
  let previousEnd: number | null = null

  for (const period of periods) {
    const startSeconds = parseTimeToSeconds(period.start)
    const endSeconds = parseTimeToSeconds(period.end)

    if (previousEnd !== null && startSeconds - previousEnd >= MIN_BREAK_SECONDS) {
      slots.push({
        id: `break-${slots.length + 1}`,
        label: '쉬는 시간',
        shortLabel: '휴식',
        kind: 'break',
        startSeconds: previousEnd,
        endSeconds: startSeconds,
        timeLabel: `${formatHmFromSeconds(previousEnd)} ~ ${formatHmFromSeconds(startSeconds)}`,
        classIndex: null,
      })
    }

    if (period.kind === 'class') {
      classOrdinal += 1
    }

    slots.push({
      id: period.id,
      label: period.label,
      shortLabel: shortLabelFor(period, classOrdinal),
      kind: period.kind,
      startSeconds,
      endSeconds,
      timeLabel: `${period.start} ~ ${period.end}`,
      classIndex: period.kind === 'class' ? classOrdinal : null,
    })

    previousEnd = previousEnd === null ? endSeconds : Math.max(previousEnd, endSeconds)
  }

  const lastPeriodEndSeconds = previousEnd ?? 0
  const dismissalSeconds = Math.max(parseTimeToSeconds(dismissalTime), lastPeriodEndSeconds)

  if (dismissalSeconds - lastPeriodEndSeconds >= MIN_DUTY_SECONDS) {
    slots.push({
      id: 'after-school',
      label: '방과후 · 업무 시간',
      shortLabel: '업무',
      kind: 'duty',
      startSeconds: lastPeriodEndSeconds,
      endSeconds: dismissalSeconds,
      timeLabel: `${formatHmFromSeconds(lastPeriodEndSeconds)} ~ ${formatHmFromSeconds(dismissalSeconds)}`,
      classIndex: null,
    })
  }

  const classSlots = slots.filter((slot) => slot.kind === 'class')
  const dayStartSeconds = slots[0]?.startSeconds ?? null

  return {
    slots,
    dayStartSeconds,
    lastPeriodEndSeconds,
    dismissalSeconds,
    classSlots,
    totalClassSeconds: classSlots.reduce((total, slot) => total + (slot.endSeconds - slot.startSeconds), 0),
    totalBreakSeconds: slots
      .filter((slot) => slot.kind === 'break')
      .reduce((total, slot) => total + (slot.endSeconds - slot.startSeconds), 0),
    spanSeconds: dayStartSeconds === null ? 0 : Math.max(1, dismissalSeconds - dayStartSeconds),
  }
}

/**
 * Apply a hard stop to a day's blocks: anything starting at or after it is
 * dropped, anything straddling it ends exactly on it.
 */
function truncatePeriods(periods: TimetablePeriod[], hardStopSeconds?: number): TimetablePeriod[] {
  if (hardStopSeconds === undefined) {
    return periods
  }
  const truncated: TimetablePeriod[] = []
  for (const period of periods) {
    const startSeconds = parseTimeToSeconds(period.start)
    if (startSeconds >= hardStopSeconds) {
      continue
    }
    const endSeconds = Math.min(parseTimeToSeconds(period.end), hardStopSeconds)
    truncated.push(
      endSeconds === parseTimeToSeconds(period.end)
        ? period
        : { ...period, end: formatHmFromSeconds(endSeconds) },
    )
  }
  return truncated
}

/* ------------------------------------------------------------------ *
 * Day classification
 * ------------------------------------------------------------------ */

/**
 * 이 날짜가 쉬는 날인가?
 *
 * 직접 등록한 휴일이 항상 우선한다(학교마다 다른 재량휴업일·체험학습일을
 * 내장 달력이 덮어쓰면 안 되기 때문). 직접 등록한 항목이 없고 `autoHolidays`가
 * 켜져 있으면 내장 대한민국 공휴일 달력을 참조한다.
 */
export function isHolidayDate(settings: UserSettings, dateKey: string): Holiday | null {
  const registered = settings.holidays.find((holiday) => holiday.date === dateKey)
  if (registered) {
    return registered
  }
  if (!settings.autoHolidays) {
    return null
  }
  const builtin = builtinHolidayLabel(dateKey)
  return builtin === null ? null : { date: dateKey, label: builtin }
}

export function isSchoolWeekday(settings: UserSettings, weekdayIndex: number) {
  return settings.schoolDays.includes(((weekdayIndex % 7) + 7) % 7)
}

/**
 * The semester window that governs a date.
 *
 * With `semesterAuto` on, the window is looked up *for that date* on the Korean
 * school calendar, so a date after the current vacation (개학일, next semester)
 * is classified correctly instead of inheriting a stale vacation state. With it
 * off, the teacher's own pair of dates defines a single window for everything.
 */
export function semesterWindowFor(settings: UserSettings, dateKey: string): SemesterWindow {
  if (settings.semesterAuto) {
    return getAutoSemesterWindow(dateKey)
  }
  return {
    id: 'manual',
    label: '학기',
    startDate: settings.semesterStart,
    vacationDate: settings.vacationDate,
    vacationLabel: '방학',
  }
}

export function isInVacation(settings: UserSettings, dateKey: string) {
  if (!isValidDateInput(dateKey)) {
    return false
  }
  const vacationMs = parseDateInput(semesterWindowFor(settings, dateKey).vacationDate)
  const todayMs = parseDateInput(dateKey)
  return Number.isFinite(vacationMs) && Number.isFinite(todayMs) && todayMs >= vacationMs
}

export function isBeforeSemester(settings: UserSettings, dateKey: string) {
  if (!isValidDateInput(dateKey)) {
    return false
  }
  const startMs = parseDateInput(semesterWindowFor(settings, dateKey).startDate)
  const todayMs = parseDateInput(dateKey)
  return Number.isFinite(startMs) && Number.isFinite(todayMs) && todayMs < startMs
}

/** Does this weekday carry teaching blocks (class / lunch / club)? */
export function weekdayHasClasses(settings: UserSettings, weekdayIndex: number) {
  const timetable = getDayTimetable(settings, weekdayIndex)
  if (!timetable.enabled) {
    return false
  }
  return sanitizePeriods(timetable.periods).some((period) => period.kind !== 'duty')
}

/** Does this date have real teaching blocks on it? */
export function isScheduledSchoolDay(settings: UserSettings, dateKey: string) {
  if (!isValidDateInput(dateKey)) {
    return false
  }
  if (isInVacation(settings, dateKey) || isBeforeSemester(settings, dateKey)) {
    return false
  }
  if (isDayOffOverride(settings, dateKey)) {
    return false
  }
  if (isHolidayDate(settings, dateKey)) {
    return false
  }
  return weekdayHasClasses(settings, weekdayIndexFromDateKey(dateKey))
}

export function getDayContext(now: KstTimeParts, settings: UserSettings, outline?: DayOutline): DayContext {
  const resolvedOutline = outline ?? buildDayOutline(settings, now.dateKey, now.weekdayIndex)
  const holiday = isHolidayDate(settings, now.dateKey)
  const override = getDayOverride(settings, now.dateKey)

  if (isInVacation(settings, now.dateKey)) {
    return {
      dayType: 'vacation',
      label: '방학',
      description: '방학 중이에요. 배터리는 그대로 충전 중입니다.',
      isSchoolDay: false,
      hasClasses: false,
      holidayLabel: null,
    }
  }

  if (isBeforeSemester(settings, now.dateKey)) {
    return {
      dayType: 'before-semester',
      label: '개학 전',
      description: `개학(${formatDateKeyShort(semesterWindowFor(settings, now.dateKey).startDate)})까지는 여유 모드예요.`,
      isSchoolDay: false,
      hasClasses: false,
      holidayLabel: null,
    }
  }

  if (override?.kind === 'off') {
    return {
      dayType: 'override',
      label: override.label.trim() || '오늘 휴업',
      description: '오늘 하루는 수업이 없는 날로 표시했어요. 내일은 원래 시간표로 돌아옵니다.',
      isSchoolDay: false,
      hasClasses: false,
      holidayLabel: null,
    }
  }

  if (holiday) {
    return {
      dayType: 'holiday',
      label: holiday.label.trim() || '공휴일',
      description: holiday.label.trim()
        ? `${withParticle(holiday.label, '으로', '로')} 쉬는 날이에요.`
        : '등록한 휴일이라 학교가 쉬어요.',
      isSchoolDay: false,
      hasClasses: false,
      holidayLabel: holiday.label.trim() || null,
    }
  }

  if (!isSchoolWeekday(settings, now.weekdayIndex)) {
    const isWeekendDay = now.weekdayIndex === 0 || now.weekdayIndex === 6
    return {
      dayType: 'weekend',
      label: isWeekendDay ? '주말' : `${WEEKDAY_LONG_LABELS[now.weekdayIndex]} 휴무`,
      description: isWeekendDay
        ? '주말이에요. 교실 대신 나를 챙기는 날입니다.'
        : '수업 요일로 설정하지 않은 날이에요.',
      isSchoolDay: false,
      hasClasses: false,
      holidayLabel: null,
    }
  }

  if (!resolvedOutline.slots.some((slot) => slot.kind !== 'duty')) {
    return {
      dayType: 'no-classes',
      label: '시간표 없음',
      description: resolvedOutline.slots.length === 0
        ? `${WEEKDAY_LONG_LABELS[now.weekdayIndex]} 시간표가 비어 있어요. 설정에서 채워 보세요.`
        : '오늘은 수업 블록이 없고 업무 시간만 있어요.',
      isSchoolDay: true,
      hasClasses: false,
      holidayLabel: null,
    }
  }

  const dismissalLabel = formatHmFromSeconds(resolvedOutline.dismissalSeconds)
  return {
    dayType: 'school',
    label: '학교 가는 날',
    description: override?.kind === 'short'
      ? `${resolvedOutline.classSlots.length}교시 · 단축 하교 ${dismissalLabel}`
      : `${resolvedOutline.classSlots.length}교시 · 하교 ${dismissalLabel}`,
    isSchoolDay: true,
    hasClasses: true,
    holidayLabel: null,
  }
}


/* ------------------------------------------------------------------ *
 * Live status
 * ------------------------------------------------------------------ */

export function getScheduleStatus(now: KstTimeParts, settings: UserSettings): ScheduleStatus {
  const outline = buildDayOutline(settings, now.dateKey, now.weekdayIndex)
  const day = getDayContext(now, settings, outline)
  const currentSeconds = now.daySeconds

  // A day without school has no teaching load at all: the weekday timetable —
  // and its class counters — must not leak into a weekend, a holiday or a
  // one-day "오늘 휴업" exception.
  if (!day.isSchoolDay || outline.slots.length === 0 || outline.dayStartSeconds === null) {
    return {
      day,
      outline: emptyOutline(),
      completedClassCount: 0,
      remainingClassCount: 0,
      totalClassCount: 0,
      remainingClassSeconds: 0,
      completedClassSeconds: 0,
      totalClassSeconds: 0,
      classLoadProgress: 0,
      secondsSinceDismissal: 0,
      isBreak: false,
      phase: 'off-day',
      activeSlot: null,
      nextSlot: null,
      secondsRemaining: 0,
      slotProgress: 0,
      dayProgress: 0,
      phaseStartSeconds: 0,
      phaseEndSeconds: DAY_IN_SECONDS,
      phaseKey: `${now.dateKey}:off-day:${day.dayType}`,
    }
  }

  const classTotals = outline.classSlots.reduce(
    (accumulator, slot) => {
      const completedSeconds = clamp(currentSeconds - slot.startSeconds, 0, slot.endSeconds - slot.startSeconds)
      const remainingSeconds = Math.max(0, slot.endSeconds - Math.max(currentSeconds, slot.startSeconds))
      if (slot.endSeconds <= currentSeconds) {
        accumulator.completed += 1
      }
      if (slot.endSeconds > currentSeconds) {
        accumulator.remaining += 1
      }
      accumulator.completedSeconds += completedSeconds
      accumulator.remainingSeconds += remainingSeconds
      return accumulator
    },
    { completed: 0, remaining: 0, completedSeconds: 0, remainingSeconds: 0 },
  )

  const shared = {
    day,
    outline,
    completedClassCount: classTotals.completed,
    remainingClassCount: classTotals.remaining,
    totalClassCount: outline.classSlots.length,
    remainingClassSeconds: classTotals.remainingSeconds,
    completedClassSeconds: classTotals.completedSeconds,
    totalClassSeconds: outline.totalClassSeconds,
    secondsSinceDismissal: 0,
    isBreak: false,
    phaseStartSeconds: 0,
    phaseEndSeconds: 0,
    classLoadProgress: outline.totalClassSeconds > 0
      ? clamp((classTotals.completedSeconds / outline.totalClassSeconds) * 100, 0, 100)
      : 0,
  }

  const slots = outline.slots
  const dayStartSeconds = outline.dayStartSeconds
  const dismissalSeconds = outline.dismissalSeconds
  const dayProgress = clamp(
    ((currentSeconds - dayStartSeconds) / Math.max(1, dismissalSeconds - dayStartSeconds)) * 100,
    0,
    100,
  )

  if (currentSeconds >= dismissalSeconds) {
    return {
      ...shared,
      phase: 'dismissed',
      activeSlot: null,
      nextSlot: null,
      secondsRemaining: 0,
      slotProgress: 100,
      dayProgress: 100,
      secondsSinceDismissal: Math.max(0, currentSeconds - dismissalSeconds),
      isBreak: false,
      phaseStartSeconds: dismissalSeconds,
      phaseEndSeconds: DAY_IN_SECONDS,
      phaseKey: `${now.dateKey}:dismissed`,
    }
  }

  if (currentSeconds < dayStartSeconds) {
    return {
      ...shared,
      phase: 'before-first-slot',
      activeSlot: null,
      nextSlot: slots[0] ?? null,
      secondsRemaining: dayStartSeconds - currentSeconds,
      slotProgress: 0,
      dayProgress: 0,
      phaseStartSeconds: 0,
      phaseEndSeconds: dayStartSeconds,
      phaseKey: `${now.dateKey}:before-first-slot`,
    }
  }

  const activeSlot = slots.find((slot) => currentSeconds >= slot.startSeconds && currentSeconds < slot.endSeconds) ?? null

  if (activeSlot) {
    const duration = Math.max(1, activeSlot.endSeconds - activeSlot.startSeconds)
    return {
      ...shared,
      phase: 'in-slot',
      activeSlot,
      nextSlot: slots[slots.indexOf(activeSlot) + 1] ?? null,
      secondsRemaining: activeSlot.endSeconds - currentSeconds,
      slotProgress: clamp(((currentSeconds - activeSlot.startSeconds) / duration) * 100, 0, 100),
      dayProgress,
      isBreak: activeSlot.kind === 'break',
      phaseStartSeconds: activeSlot.startSeconds,
      phaseEndSeconds: activeSlot.endSeconds,
      phaseKey: `${now.dateKey}:in-slot:${activeSlot.id}`,
    }
  }

  const nextSlot = slots.find((slot) => slot.startSeconds > currentSeconds) ?? null
  const previousSlot = [...slots].reverse().find((slot) => slot.endSeconds <= currentSeconds) ?? null

  return {
    ...shared,
    phase: 'between-slots',
    activeSlot: null,
    nextSlot,
    secondsRemaining: nextSlot ? nextSlot.startSeconds - currentSeconds : dismissalSeconds - currentSeconds,
    slotProgress: 0,
    dayProgress,
    isBreak: true,
    phaseStartSeconds: previousSlot?.endSeconds ?? dayStartSeconds,
    phaseEndSeconds: nextSlot?.startSeconds ?? dismissalSeconds,
    phaseKey: `${now.dateKey}:between-slots:${nextSlot?.id ?? 'end'}`,
  }
}

/* ------------------------------------------------------------------ *
 * Look-ahead helpers
 * ------------------------------------------------------------------ */

const LOOKAHEAD_DAYS = 400

export function getNextDayOff(now: KstTimeParts, settings: UserSettings): NextDayOff | null {
  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const dateKey = shiftDateKey(now.dateKey, offset)
    const holiday = isHolidayDate(settings, dateKey)
    const override = getDayOverride(settings, dateKey)
    const isOffOverride = override?.kind === 'off'
    const inVacation = isInVacation(settings, dateKey)
    const beforeSemester = isBeforeSemester(settings, dateKey)
    const isOffWeekday = !isSchoolWeekday(settings, weekdayIndexFromDateKey(dateKey))

    if (!inVacation && !beforeSemester && !holiday && !isOffOverride && !isOffWeekday) {
      continue
    }

    const secondsUntil = secondsUntilDateKey(now, dateKey)
    const reason: NextDayOff['reason'] = inVacation
      ? 'vacation'
      : holiday
        ? 'holiday'
        : isOffOverride
          ? 'override'
          : 'weekend'

    return {
      dateKey,
      reason,
      label: inVacation
        ? '방학'
        : holiday
          ? (holiday.label.trim() || '공휴일')
          : isOffOverride
            ? (override.label.trim() || (offset === 0 ? '오늘 휴업' : '휴업일'))
            : offset === 0
              ? `${weekdayLabel(weekdayIndexFromDateKey(dateKey))}요일 휴식`
              : `${weekdayLabel(weekdayIndexFromDateKey(dateKey))}요일`,
      daysUntil: offset,
      secondsUntil: Math.max(0, secondsUntil),
    }
  }
  return null
}

export function getNextSchoolDay(
  now: KstTimeParts,
  settings: UserSettings,
  excludeDateKey?: string,
): NextSchoolDay | null {
  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const dateKey = shiftDateKey(now.dateKey, offset)
    if (dateKey === excludeDateKey) {
      continue
    }
    if (!isScheduledSchoolDay(settings, dateKey)) {
      continue
    }

    const weekdayIndex = weekdayIndexFromDateKey(dateKey)
    const outline = buildDayOutline(settings, dateKey, weekdayIndex)
    const firstPeriodSeconds = outline.classSlots[0]?.startSeconds ?? outline.dayStartSeconds
    const secondsUntilMidnight = Math.max(0, secondsUntilDateKey(now, dateKey))
    const secondsUntilFirstPeriod = firstPeriodSeconds === null
      ? secondsUntilMidnight
      : Math.max(0, secondsUntilMidnight + firstPeriodSeconds)

    return {
      dateKey,
      label: offset === 0 ? '오늘' : offset === 1 ? '내일' : `${weekdayLabel(weekdayIndex)}요일`,
      daysUntil: offset,
      secondsUntil: secondsUntilMidnight,
      secondsUntilFirstPeriod,
      firstPeriodSeconds,
    }
  }
  return null
}

export interface WeekContext {
  /** 1-based position among this week's school days (0 when today is off). */
  schoolDayPosition: number
  schoolDaysThisWeek: number
  remainingSchoolDaysThisWeek: number
  /** Seconds until the coming weekend/off day, `null` when already off. */
  secondsUntilWeekend: number | null
  weekendDateKey: string | null
}

/**
 * Weekly rhythm: how deep into the school week we are and how far the next
 * day off is. The week starts on Monday so `금요일` really is the finish line.
 */
export function getWeekContext(now: KstTimeParts, settings: UserSettings): WeekContext {
  const mondayOffset = ((now.weekdayIndex + 6) % 7) * -1
  const schoolKeys: string[] = []

  for (let index = 0; index < 7; index += 1) {
    const dateKey = shiftDateKey(now.dateKey, mondayOffset + index)
    if (isScheduledSchoolDay(settings, dateKey)) {
      schoolKeys.push(dateKey)
    }
  }

  const position = schoolKeys.indexOf(now.dateKey)
  const nextDayOff = getNextDayOff(now, settings)
  const isTodayOff = nextDayOff?.daysUntil === 0

  return {
    schoolDayPosition: position >= 0 ? position + 1 : 0,
    schoolDaysThisWeek: schoolKeys.length,
    remainingSchoolDaysThisWeek: position >= 0 ? Math.max(0, schoolKeys.length - position - 1) : schoolKeys.length,
    secondsUntilWeekend: isTodayOff || !nextDayOff ? null : nextDayOff.secondsUntil,
    weekendDateKey: nextDayOff?.dateKey ?? null,
  }
}

/** Outline for an arbitrary date (used to preview tomorrow / the next school day). */
export function outlineForDate(settings: UserSettings, dateKey: string): DayOutline {
  if (!isValidDateInput(dateKey)) {
    return emptyOutline()
  }
  return buildDayOutline(settings, dateKey, weekdayIndexFromDateKey(dateKey))
}
