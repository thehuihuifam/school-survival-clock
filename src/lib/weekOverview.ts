/**
 * 이번 주 한눈에 보기.
 *
 * 하루짜리 타임라인만으로는 "이번 주에 언제가 제일 빡센지"를 알 수 없다. 이
 * 모듈은 월요일부터 일요일까지 7일을 같은 규칙(학기/방학, 공휴일, 하루 예외,
 * 요일별 시간표)으로 평가해 요약 카드가 쓸 수 있는 순수 데이터로 만든다.
 * React도 DOM도 쓰지 않으므로 그대로 단위 테스트할 수 있다.
 */
import type { KstTimeParts, UserSettings } from '../types'
import { WEEKDAY_LABELS } from '../types'
import {
  buildDayOutline,
  getDayOverride,
  isBeforeSemester,
  isHolidayDate,
  isInVacation,
  isSchoolWeekday,
} from './schedule'
import { formatHmFromSeconds, shiftDateKey, weekdayIndexFromDateKey } from './time'

export type WeekDayState =
  | 'school'
  | 'today'
  | 'holiday'
  | 'weekend'
  | 'vacation'
  | 'override'
  | 'empty'

export interface WeekDaySummary {
  /** `YYYY-MM-DD`, KST. */
  dateKey: string
  /** `월` … `일`. */
  weekdayLabel: string
  weekdayIndex: number
  isToday: boolean
  isPast: boolean
  state: WeekDayState
  /** 수업 교시 수(수업이 없는 날은 0). */
  classCount: number
  /** 그날 수업 시간 합계(초). */
  classSeconds: number
  /** `09:00~16:30` 형태의 하루 범위, 일정이 없으면 `null`. */
  spanLabel: string | null
  /** 공휴일·휴업 이름처럼 그날을 설명하는 짧은 문구. */
  note: string | null
}

export interface WeekOverview {
  days: WeekDaySummary[]
  /** 이번 주 수업이 있는 날 수. */
  schoolDayCount: number
  /** 이번 주 남은 수업일 수(오늘 포함, 오늘이 수업일이고 아직 안 끝났으면 1). */
  remainingSchoolDayCount: number
  /** 이번 주 수업 시간 합계(초). */
  totalClassSeconds: number
  /** 가장 수업이 많은 날(동률이면 먼저 오는 요일). `null`이면 수업 없는 주. */
  heaviestDateKey: string | null
}

/** 이번 주(월요일 시작) 7일의 요약. */
export function getWeekOverview(now: KstTimeParts, settings: UserSettings): WeekOverview {
  // 월요일을 주의 시작으로 삼아야 금요일이 실제 결승선으로 읽힌다.
  const mondayOffset = -(((now.weekdayIndex + 6) % 7))
  const days: WeekDaySummary[] = []

  let schoolDayCount = 0
  let remainingSchoolDayCount = 0
  let totalClassSeconds = 0
  let heaviestDateKey: string | null = null
  let heaviestSeconds = 0

  for (let index = 0; index < 7; index += 1) {
    const dateKey = shiftDateKey(now.dateKey, mondayOffset + index)
    const weekdayIndex = weekdayIndexFromDateKey(dateKey)
    const isToday = dateKey === now.dateKey
    const isPast = dateKey < now.dateKey

    const override = getDayOverride(settings, dateKey)
    const holiday = isHolidayDate(settings, dateKey)
    const outline = buildDayOutline(settings, dateKey, weekdayIndex)
    const hasBlocks = outline.slots.some((slot) => slot.kind !== 'duty')

    let state: WeekDayState
    let note: string | null = null

    if (isInVacation(settings, dateKey)) {
      state = 'vacation'
      note = '방학'
    } else if (isBeforeSemester(settings, dateKey)) {
      state = 'vacation'
      note = '개학 전'
    } else if (override?.kind === 'off') {
      state = 'override'
      note = override.label.trim() || '휴업'
    } else if (holiday) {
      state = 'holiday'
      note = holiday.label.trim() || '공휴일'
    } else if (!isSchoolWeekday(settings, weekdayIndex)) {
      state = 'weekend'
      note = weekdayIndex === 0 || weekdayIndex === 6 ? '주말' : '휴무'
    } else if (!hasBlocks) {
      state = 'empty'
      note = '수업 없음'
    } else {
      state = isToday ? 'today' : 'school'
      if (override?.kind === 'short') {
        note = `단축 ${override.dismissalTime}`
      }
    }

    const isTeachingDay = state === 'school' || state === 'today'
    const classCount = isTeachingDay ? outline.classSlots.length : 0
    const classSeconds = isTeachingDay ? outline.totalClassSeconds : 0

    if (isTeachingDay) {
      schoolDayCount += 1
      totalClassSeconds += classSeconds
      if (!isPast) {
        remainingSchoolDayCount += 1
      }
      if (classSeconds > heaviestSeconds) {
        heaviestSeconds = classSeconds
        heaviestDateKey = dateKey
      }
    }

    days.push({
      dateKey,
      weekdayLabel: WEEKDAY_LABELS[weekdayIndex],
      weekdayIndex,
      isToday,
      isPast,
      state,
      classCount,
      classSeconds,
      spanLabel:
        isTeachingDay && outline.dayStartSeconds !== null
          ? `${formatHmFromSeconds(outline.dayStartSeconds)}~${formatHmFromSeconds(outline.dismissalSeconds)}`
          : null,
      note,
    })
  }

  return { days, schoolDayCount, remainingSchoolDayCount, totalClassSeconds, heaviestDateKey }
}
