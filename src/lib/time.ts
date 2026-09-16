import type { BatteryMetrics, KstTimeParts, PeriodDefinition, PeriodStatus } from '../types'

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

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: parts.weekday ?? '',
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

export function parseTimeToSeconds(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 16 * 60 * 60 + 30 * 60
  }
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
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${pad(hours)}:${pad(minutes)}`
}

export function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return Number.NaN
  }
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

export function getBatteryMetrics(
  today: KstTimeParts,
  semesterStart: string,
  vacationDate: string,
): BatteryMetrics {
  const todayMs = parseDateInput(dateInputFromKst(today))
  const startMs = parseDateInput(semesterStart)
  const vacationMs = parseDateInput(vacationDate)
  const totalDays = Math.max(1, differenceInDays(vacationMs, startMs))
  const elapsedDays = differenceInDays(todayMs, startMs)
  const progress = vacationMs <= startMs
    ? (todayMs >= vacationMs ? 100 : 0)
    : clamp((elapsedDays / totalDays) * 100, 0, 100)

  return {
    progress,
    daysRemaining: Math.max(0, differenceInDays(vacationMs, todayMs)),
    totalDays,
    elapsedDays: Math.max(0, elapsedDays),
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

export function getTimelineSlots(dismissalTime: string): PeriodDefinition[] {
  const dismissalSeconds = Math.max(parseTimeToSeconds(dismissalTime), parseTimeToSeconds('14:50'))
  const dismissalLabel = formatHmFromSeconds(dismissalSeconds)
  const periods = [
    makePeriod('period-1', '1교시', '1', '09:00', '09:40'),
    makePeriod('period-2', '2교시', '2', '09:50', '10:30'),
    makePeriod('period-3', '3교시', '3', '10:50', '11:30'),
    makePeriod('period-4', '4교시', '4', '11:40', '12:20'),
    makePeriod('lunch', '점심시간 및 급식', '점심', '12:20', '13:20'),
    makePeriod('period-5', '5교시', '5', '13:20', '14:00'),
    makePeriod('period-6', '6교시', '6', '14:10', '14:50'),
    makePeriod('after-school', '방과후/업무 시간', '업무', '14:50', dismissalLabel),
  ]

  const slots: PeriodDefinition[] = []
  periods.forEach((period, index) => {
    if (period.endSeconds <= period.startSeconds) {
      return
    }
    slots.push(period)
    const nextPeriod = periods[index + 1]
    if (nextPeriod && nextPeriod.startSeconds > period.endSeconds) {
      slots.push(
        makePeriod(
          `break-${index + 1}`,
          '쉬는 시간',
          '휴식',
          formatHmFromSeconds(period.endSeconds),
          formatHmFromSeconds(nextPeriod.startSeconds),
          'break',
        ),
      )
    }
  })
  return slots
}

export function getPeriodStatus(currentSeconds: number, dismissalTime: string): PeriodStatus {
  const dismissalSeconds = parseTimeToSeconds(dismissalTime)
  const slots = getTimelineSlots(dismissalTime)

  if (currentSeconds >= dismissalSeconds) {
    return {
      slotId: 'after-school-complete',
      label: '오늘 수업 종료',
      timeLabel: `${dismissalTime} 퇴근 완료`,
      minutesRemaining: 0,
      isBreak: false,
      isBeforeSchool: false,
      isAfterSchool: true,
    }
  }

  if (currentSeconds < parseTimeToSeconds('09:00')) {
    const minutesUntilSchool = Math.max(1, Math.ceil((parseTimeToSeconds('09:00') - currentSeconds) / 60))
    return {
      slotId: 'before-school',
      label: '수업 시작 전',
      timeLabel: `09:00까지 ${minutesUntilSchool}분`,
      minutesRemaining: minutesUntilSchool,
      isBreak: false,
      isBeforeSchool: true,
      isAfterSchool: false,
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
  }
}
