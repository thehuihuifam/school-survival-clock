import { DEFAULT_LUNCH, DEFAULT_SCHEDULE } from '../types'
import type {
  BatteryMetrics,
  DayOffReason,
  KstTimeParts,
  PeriodDefinition,
  PeriodStatus,
  SchedulePeriod,
  SchoolDayContext,
} from '../types'

const SEOUL_TIME_ZONE = 'Asia/Seoul'
const DAY_IN_MS = 24 * 60 * 60 * 1000

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

const pad = (value: number) => String(value).padStart(2, '0')

export function getKstTimeParts(date: Date): KstTimeParts {
  const parts = kstFormatter.formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value
    return result
  }, {})

  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)
  const hour = Number(parts.hour) % 24
  const minute = Number(parts.minute)
  const second = Number(parts.second)
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: parts.weekday ?? '',
    weekdayIndex,
    dateKey: `${year}-${pad(month)}-${pad(day)}`,
  }
}

export function formatKstDate(parts: KstTimeParts) {
  return `${String(parts.year).slice(-2)}.${pad(parts.month)}.${pad(parts.day)} ${parts.weekday}`
}

export function formatKstTime(parts: KstTimeParts) {
  return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
}

export function getKstSeconds(parts: KstTimeParts) {
  return parts.hour * 60 * 60 + parts.minute * 60 + parts.second
}

export function isValidTimeInput(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false
  }
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

export function parseTimeToSeconds(time: string) {
  if (!isValidTimeInput(time)) {
    return 16 * 60 * 60 + 30 * 60
  }
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 * 60 + minutes * 60
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function formatHmFromSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  return `${pad(hours)}:${pad(minutes)}`
}

export function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function parseDateInput(value: string) {
  if (!isValidDateInput(value)) {
    return Number.NaN
  }
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function dateInputFromKst(parts: KstTimeParts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function differenceInDays(later: number, earlier: number) {
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) {
    return 0
  }
  return Math.round((later - earlier) / DAY_IN_MS)
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function dateKeyFromUtcMs(value: number) {
  const date = new Date(value)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function isSchoolDate(value: number, holidaySet: Set<string>) {
  const dayOfWeek = new Date(value).getUTCDay()
  return dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateKeyFromUtcMs(value))
}

function countSchoolDays(startMs: number, endMs: number, holidaySet: Set<string>) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0
  }

  let count = 0
  for (let cursor = startMs; cursor < endMs; cursor += DAY_IN_MS) {
    if (isSchoolDate(cursor, holidaySet)) {
      count += 1
    }
  }
  return count
}

export function getBatteryMetrics(
  today: KstTimeParts,
  semesterStart: string,
  vacationDate: string,
  holidayDates: string[] = [],
): BatteryMetrics {
  const todayMs = parseDateInput(dateInputFromKst(today))
  const startMs = parseDateInput(semesterStart)
  const vacationMs = parseDateInput(vacationDate)
  const safeDates = Number.isFinite(startMs) && Number.isFinite(vacationMs)
  const totalDays = safeDates ? Math.max(1, differenceInDays(vacationMs, startMs)) : 1
  const elapsedDays = safeDates ? differenceInDays(todayMs, startMs) : 0
  const holidaySet = new Set(holidayDates)
  const totalSchoolDays = safeDates ? Math.max(1, countSchoolDays(startMs, vacationMs, holidaySet)) : 1
  const boundedTodayMs = safeDates ? clamp(todayMs, startMs, vacationMs) : startMs
  const elapsedSchoolDays = safeDates
    ? clamp(countSchoolDays(startMs, boundedTodayMs, holidaySet), 0, totalSchoolDays)
    : 0
  const progress = !safeDates || vacationMs <= startMs
    ? (safeDates && todayMs >= vacationMs ? 100 : 0)
    : clamp((elapsedSchoolDays / totalSchoolDays) * 100, 0, 100)

  return {
    progress,
    daysRemaining: safeDates ? Math.max(0, differenceInDays(vacationMs, todayMs)) : 0,
    totalDays,
    elapsedDays: Math.max(0, elapsedDays),
    totalSchoolDays,
    elapsedSchoolDays,
    startDate: semesterStart,
    vacationDate,
  }
}

function makePeriod(
  id: string,
  label: string,
  shortLabel: string,
  start: string,
  end: string,
  kind: PeriodDefinition['kind'] = 'period',
): PeriodDefinition {
  const startSeconds = parseTimeToSeconds(start)
  const endSeconds = parseTimeToSeconds(end)
  return {
    id,
    label,
    shortLabel,
    startSeconds,
    endSeconds,
    timeLabel: `${start} ~ ${end}`,
    kind,
  }
}

function validSchedulePeriods(schedule: SchedulePeriod[]) {
  return schedule.length > 0 && schedule.every((period) => {
    return isValidTimeInput(period.start) && isValidTimeInput(period.end) && parseTimeToSeconds(period.end) > parseTimeToSeconds(period.start)
  })
}

function getScheduledBlocks(schedule: SchedulePeriod[], lunchStart: string, lunchEnd: string) {
  if (!validSchedulePeriods(schedule) || !isValidTimeInput(lunchStart) || !isValidTimeInput(lunchEnd)) {
    return []
  }

  const blocks = [
    ...schedule.map((period) => makePeriod(period.id, period.label, period.shortLabel, period.start, period.end)),
    makePeriod('lunch', '점심시간 및 급식', '점심', lunchStart, lunchEnd),
  ]
  return blocks
    .filter((block) => block.endSeconds > block.startSeconds)
    .sort((left, right) => left.startSeconds - right.startSeconds)
}

export function getScheduleEndSeconds(schedule: SchedulePeriod[] = DEFAULT_SCHEDULE, lunchStart = DEFAULT_LUNCH.start, lunchEnd = DEFAULT_LUNCH.end) {
  const blocks = getScheduledBlocks(schedule, lunchStart, lunchEnd)
  return blocks.reduce((latest, block) => Math.max(latest, block.endSeconds), 0)
}

export function isScheduleConfigurationValid(
  schedule: SchedulePeriod[],
  lunchStart: string,
  lunchEnd: string,
  dismissalTime: string,
) {
  if (!validSchedulePeriods(schedule) || !isValidTimeInput(lunchStart) || !isValidTimeInput(lunchEnd) || !isValidTimeInput(dismissalTime)) {
    return false
  }

  for (let index = 1; index < schedule.length; index += 1) {
    if (parseTimeToSeconds(schedule[index].start) < parseTimeToSeconds(schedule[index - 1].end)) {
      return false
    }
  }

  const blocks = getScheduledBlocks(schedule, lunchStart, lunchEnd)
  if (blocks.length !== schedule.length + 1) {
    return false
  }

  for (let index = 1; index < blocks.length; index += 1) {
    if (blocks[index].startSeconds < blocks[index - 1].endSeconds) {
      return false
    }
  }

  return parseTimeToSeconds(dismissalTime) > getScheduleEndSeconds(schedule, lunchStart, lunchEnd)
}

export function getEffectiveDismissalSeconds(
  dismissalTime: string,
  schedule: SchedulePeriod[] = DEFAULT_SCHEDULE,
  lunchStart = DEFAULT_LUNCH.start,
  lunchEnd = DEFAULT_LUNCH.end,
) {
  return Math.max(parseTimeToSeconds(dismissalTime), getScheduleEndSeconds(schedule, lunchStart, lunchEnd))
}

export function getTimelineSlots(
  dismissalTime: string,
  schedule: SchedulePeriod[] = DEFAULT_SCHEDULE,
  lunchStart = DEFAULT_LUNCH.start,
  lunchEnd = DEFAULT_LUNCH.end,
): PeriodDefinition[] {
  const blocks = getScheduledBlocks(schedule, lunchStart, lunchEnd)
  if (blocks.length === 0) {
    return []
  }

  const dismissalSeconds = getEffectiveDismissalSeconds(dismissalTime, schedule, lunchStart, lunchEnd)
  const lastScheduledEnd = getScheduleEndSeconds(schedule, lunchStart, lunchEnd)
  const timelineBlocks = dismissalSeconds > lastScheduledEnd
    ? [...blocks, makePeriod('after-school', '방과후/업무 시간', '업무', formatHmFromSeconds(lastScheduledEnd), formatHmFromSeconds(dismissalSeconds))]
    : blocks

  const slots: PeriodDefinition[] = []
  let previousEnd: number | null = null
  timelineBlocks
    .sort((left, right) => left.startSeconds - right.startSeconds)
    .forEach((block) => {
      if (previousEnd !== null && block.startSeconds > previousEnd) {
        slots.push(
          makePeriod(
            `break-${slots.length + 1}`,
            '쉬는 시간',
            '휴식',
            formatHmFromSeconds(previousEnd),
            formatHmFromSeconds(block.startSeconds),
            'break',
          ),
        )
      }
      slots.push(block)
      previousEnd = previousEnd === null ? block.endSeconds : Math.max(previousEnd, block.endSeconds)
    })
  return slots
}

export function getSchoolDayContext(today: KstTimeParts, holidayDates: string[] = []): SchoolDayContext {
  const isWeekend = today.weekdayIndex === 0 || today.weekdayIndex === 6
  const isHoliday = holidayDates.includes(today.dateKey)
  const reason: DayOffReason | null = isWeekend ? 'weekend' : isHoliday ? 'holiday' : null

  return {
    isSchoolDay: reason === null,
    isWeekend,
    isHoliday,
    reason,
    label: isWeekend ? '주말 휴식' : isHoliday ? '등록한 휴일' : '학교 운영일',
    dateKey: today.dateKey,
  }
}

export function getPeriodStatus(
  currentSeconds: number,
  dismissalTime: string,
  schedule: SchedulePeriod[] = DEFAULT_SCHEDULE,
  lunchStart = DEFAULT_LUNCH.start,
  lunchEnd = DEFAULT_LUNCH.end,
  schoolDay?: SchoolDayContext,
): PeriodStatus {
  if (schoolDay && !schoolDay.isSchoolDay) {
    return {
      slotId: 'off-day',
      label: schoolDay.label,
      timeLabel: schoolDay.reason === 'weekend' ? '주말에는 학교가 쉬어요' : '등록한 휴일에는 학교가 쉬어요',
      minutesRemaining: 0,
      isBreak: true,
      isBeforeSchool: false,
      isAfterSchool: false,
      isOffDay: true,
    }
  }

  const dismissalSeconds = getEffectiveDismissalSeconds(dismissalTime, schedule, lunchStart, lunchEnd)
  const slots = getTimelineSlots(dismissalTime, schedule, lunchStart, lunchEnd)
  const firstScheduledSlot = slots.find((slot) => slot.kind === 'period')

  if (currentSeconds >= dismissalSeconds) {
    return {
      slotId: 'after-school-complete',
      label: '오늘 수업 종료',
      timeLabel: `${formatHmFromSeconds(dismissalSeconds)} 퇴근 완료`,
      minutesRemaining: 0,
      isBreak: false,
      isBeforeSchool: false,
      isAfterSchool: true,
      isOffDay: false,
    }
  }

  if (firstScheduledSlot && currentSeconds < firstScheduledSlot.startSeconds) {
    const minutesUntilSchool = Math.max(1, Math.ceil((firstScheduledSlot.startSeconds - currentSeconds) / 60))
    return {
      slotId: 'before-school',
      label: '수업 시작 전',
      timeLabel: `${formatHmFromSeconds(firstScheduledSlot.startSeconds)}까지 ${minutesUntilSchool}분`,
      minutesRemaining: minutesUntilSchool,
      isBreak: false,
      isBeforeSchool: true,
      isAfterSchool: false,
      isOffDay: false,
    }
  }

  const activeSlot = slots.find(
    (slot) => currentSeconds >= slot.startSeconds && currentSeconds < slot.endSeconds,
  )

  if (activeSlot) {
    const minutesRemaining = Math.max(1, Math.ceil((activeSlot.endSeconds - currentSeconds) / 60))
    return {
      slotId: activeSlot.id,
      label: activeSlot.label,
      timeLabel: activeSlot.timeLabel,
      minutesRemaining,
      isBreak: activeSlot.kind === 'break',
      isBeforeSchool: false,
      isAfterSchool: false,
      isOffDay: false,
    }
  }

  const nextSlot = slots.find((slot) => slot.startSeconds > currentSeconds)
  const minutesUntilNext = nextSlot
    ? Math.max(1, Math.ceil((nextSlot.startSeconds - currentSeconds) / 60))
    : 0

  return {
    slotId: 'between-slots',
    label: '잠깐의 공백',
    timeLabel: nextSlot ? `${nextSlot.label}까지 ${minutesUntilNext}분` : '오늘 일정 정리 중',
    minutesRemaining: minutesUntilNext,
    isBreak: true,
    isBeforeSchool: false,
    isAfterSchool: false,
    isOffDay: false,
  }
}
