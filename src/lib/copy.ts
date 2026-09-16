/**
 * Presentation copy derived from the pure schedule state.
 *
 * Keeping the Korean phrasing in one module means components stay declarative
 * and the wording can be reviewed (and unit tested) without rendering React.
 */
import type {
  DayPhase,
  DayType,
  KstTimeParts,
  NextSchoolDay,
  ScheduleStatus,
  TimelineSlot,
} from '../types'
import { formatDuration, formatHumanDuration, formatMinutes, formatPercent } from './time'

/** `2026-09-17` → `09.17` */
export function formatShortDate(dateKey: string) {
  return dateKey.slice(5).replace('-', '.')
}

export type HeroTone = 'focus' | 'break' | 'rest' | 'done' | 'waiting' | 'pre'

export interface HeroHeadline {
  kicker: string
  title: string
  helper: string
  /** Big countdown value, already formatted. */
  value: string
  /** Secondary read-out under the value. */
  valueNote: string
  tone: HeroTone
  icon: 'alarm-bold' | 'bell-ring-bold' | 'check-circle-bold' | 'cup-hot-bold' | 'plate-bold' | 'notebook-bold' | 'moon-stars-bold' | 'stopwatch-bold' | 'sunrise-bold'
  /** 0..100 progress of the bar shown under the countdown. */
  barProgress: number
  barLabel: string
}

export const DAY_TYPE_TONES: Record<DayType, string> = {
  school: 'is-school',
  'no-classes': 'is-soft',
  weekend: 'is-rest',
  holiday: 'is-rest',
  // `override` is the one-day exception ("오늘 휴업") — a restful, temporary day.
  override: 'is-soft',
  vacation: 'is-vacation',
  'before-semester': 'is-vacation',
}

export const PHASE_LABELS: Record<DayPhase, string> = {
  'off-day': '쉬는 날',
  'before-first-slot': '등교 전',
  'in-slot': '진행 중',
  'between-slots': '틈새 시간',
  dismissed: '하루 완료',
}

/**
 * Is the next class inside the pre-bell window? (`preAlertSeconds` is 0 when the
 * teacher turned 예비종 off, which disables the state entirely.)
 */
export function isPreAlertWindow(status: ScheduleStatus, preAlertSeconds: number) {
  return preAlertSeconds > 0
    && status.secondsRemaining > 0
    && status.secondsRemaining <= preAlertSeconds
}

/** Shared "get ready" headline used wherever the pre-bell window opens. */
function preAlertHeadline(
  status: ScheduleStatus,
  slot: TimelineSlot,
  valueNote: string,
  barProgress: number,
  barLabel: string,
): HeroHeadline {
  return {
    kicker: 'GET READY · 예비종',
    title: `${slot.label} 곧 시작`,
    helper: `${slot.timeLabel} · 교실로 이동할 시간입니다`,
    value: formatDuration(status.secondsRemaining),
    valueNote,
    tone: 'pre',
    icon: 'bell-ring-bold',
    barProgress,
    barLabel,
  }
}

export function heroHeadline(
  status: ScheduleStatus,
  nextSchoolDay: NextSchoolDay | null,
  preAlertSeconds = 0,
): HeroHeadline {
  const { phase, day, activeSlot, nextSlot, outline } = status
  const dayProgress = status.dayProgress

  if (phase === 'off-day') {
    return {
      kicker: 'RECOVERY MODE',
      title: day.label,
      helper: day.description,
      value: nextSchoolDay ? formatHumanDuration(nextSchoolDay.secondsUntilFirstPeriod, 2) : '미정',
      valueNote: nextSchoolDay
        ? `다음 등교 ${nextSchoolDay.label}${nextSchoolDay.daysUntil > 0 ? ` ${formatShortDate(nextSchoolDay.dateKey)}` : ''} · 첫 일정 ${nextSchoolDay.firstPeriodSeconds === null ? '시간표 없음' : clockFromSeconds(nextSchoolDay.firstPeriodSeconds)}`
        : '설정에서 학기 일정과 시간표를 확인해 주세요',
      tone: 'rest',
      icon: day.dayType === 'vacation' ? 'moon-stars-bold' : 'sunrise-bold',
      barProgress: 0,
      barLabel: '배터리 충전 중',
    }
  }

  if (phase === 'dismissed') {
    return {
      kicker: 'MISSION COMPLETE',
      title: '오늘 일정 완료',
      helper: `${clockFromSeconds(outline.dismissalSeconds)} 하교 · 수고하셨습니다`,
      value: `+${formatHumanDuration(status.secondsSinceDismissal, 2)}`,
      valueNote: status.totalClassCount > 0
        ? `${status.totalClassCount}교시 · ${formatMinutes(status.totalClassSeconds)} 수업 모두 완료`
        : '오늘의 블록을 모두 통과했습니다',
      tone: 'done',
      icon: 'check-circle-bold',
      barProgress: 100,
      barLabel: '하루 100% 돌파',
    }
  }

  if (phase === 'before-first-slot') {
    const first = nextSlot
    if (first && isPreAlertWindow(status, preAlertSeconds)) {
      return preAlertHeadline(
        status,
        first,
        `오늘 ${status.totalClassCount}교시 · 수업 ${formatMinutes(status.totalClassSeconds)}`,
        0,
        `등교 ${clockFromSeconds(first.startSeconds)}`,
      )
    }
    return {
      kicker: 'BEFORE THE BELL',
      title: first ? `${first.label}까지` : '첫 일정까지',
      helper: first
        ? `${first.timeLabel} 시작 · ${formatHumanDuration(status.secondsRemaining, 2)} 남음`
        : '오늘 첫 일정이 없습니다',
      value: formatDuration(status.secondsRemaining),
      valueNote: `오늘 ${status.totalClassCount}교시 · 수업 ${formatMinutes(status.totalClassSeconds)}`,
      tone: 'waiting',
      icon: 'sunrise-bold',
      barProgress: 0,
      barLabel: `등교 ${first ? clockFromSeconds(first.startSeconds) : '--:--'}`,
    }
  }

  if (phase === 'in-slot' && activeSlot) {
    const isBreak = activeSlot.kind === 'break'
    const isLunch = activeSlot.kind === 'lunch'

    // During a break the countdown already runs towards the next class, so the
    // last minutes before the bell become a "get ready" state.
    if ((isBreak || isLunch) && nextSlot?.kind === 'class' && isPreAlertWindow(status, preAlertSeconds)) {
      return preAlertHeadline(
        status,
        nextSlot,
        `오늘 남은 수업 ${formatMinutes(status.remainingClassSeconds)} · ${status.remainingClassCount}교시`,
        dayProgress,
        `하루 ${formatPercent(dayProgress, 0)}% 진행`,
      )
    }

    return {
      kicker: isBreak
        ? 'SHORT BREAK'
        : isLunch
          ? 'LUNCH TIME'
          : activeSlot.kind === 'duty'
            ? 'AFTER SCHOOL'
            : `PERIOD ${activeSlot.classIndex ?? ''}`.trim(),
      title: `${activeSlot.label} 진행 중`,
      helper: `${activeSlot.timeLabel} · ${formatPercent(status.slotProgress, 0)}% 지남`,
      value: formatDuration(status.secondsRemaining),
      valueNote: isBreak || isLunch
        ? nextSlot ? `다음: ${nextSlot.label} ${clockFromSeconds(nextSlot.startSeconds)}` : '이어서 하교'
        : `오늘 남은 수업 ${formatMinutes(status.remainingClassSeconds)} · ${status.remainingClassCount}교시`,
      tone: isBreak ? 'break' : isLunch ? 'break' : 'focus',
      icon: isBreak ? 'cup-hot-bold' : isLunch ? 'plate-bold' : activeSlot.kind === 'duty' ? 'stopwatch-bold' : 'notebook-bold',
      barProgress: dayProgress,
      barLabel: `하루 ${formatPercent(dayProgress, 0)}% · 하교 ${clockFromSeconds(outline.dismissalSeconds)}`,
    }
  }

  // between-slots
  if (nextSlot?.kind === 'class' && isPreAlertWindow(status, preAlertSeconds)) {
    return preAlertHeadline(
      status,
      nextSlot,
      `오늘 남은 수업 ${formatMinutes(status.remainingClassSeconds)} · ${status.remainingClassCount}교시`,
      dayProgress,
      `하루 ${formatPercent(dayProgress, 0)}% 진행`,
    )
  }

  return {
    kicker: 'IN BETWEEN',
    title: nextSlot ? `${nextSlot.label} 준비` : '하루 마무리',
    helper: nextSlot
      ? `${nextSlot.timeLabel}까지 ${formatHumanDuration(status.secondsRemaining, 2)}`
      : `${clockFromSeconds(outline.dismissalSeconds)} 하교까지 ${formatHumanDuration(status.secondsRemaining, 2)}`,
    value: formatDuration(status.secondsRemaining),
    valueNote: `오늘 남은 수업 ${formatMinutes(status.remainingClassSeconds)}`,
    tone: 'break',
    icon: 'cup-hot-bold',
    barProgress: dayProgress,
    barLabel: `하루 ${formatPercent(dayProgress, 0)}% 진행`,
  }
}

export function clockFromSeconds(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Greeting that follows the real hour of the KST day.
 *
 * The caller composes it as `{greeting}, {이름}.` (and shows it bare in the
 * clock footer), so it must never contain the honorific itself — otherwise the
 * hero reads "좋은 아침입니다, 선생님, 김선생님."
 */
export function greetingForHour(hour: number) {
  if (hour < 5) {
    return '새벽까지 고생 많으셨어요'
  }
  if (hour < 9) {
    return '좋은 아침이에요'
  }
  if (hour < 12) {
    return '오전 수업 화이팅이에요'
  }
  if (hour < 14) {
    return '점심은 꼭 챙겨 드셨죠'
  }
  if (hour < 18) {
    return '오후도 무사히 갑니다'
  }
  if (hour < 22) {
    return '저녁이에요, 퇴근 준비하세요'
  }
  return '오늘 하루도 마무리 중이에요'
}

/** One-line status used by the document title and the celebration toast. */
export function documentTitleFor(status: ScheduleStatus, now: KstTimeParts) {
  const base = '교사 생존 배터리'

  if (status.phase === 'off-day') {
    return `${status.day.label} · ${base}`
  }
  if (status.phase === 'dismissed') {
    return `하루 완료 · ${base}`
  }
  if (status.phase === 'in-slot' && status.activeSlot) {
    return `${status.activeSlot.label} ${formatDuration(status.secondsRemaining)} · ${base}`
  }
  if (status.phase === 'between-slots' && status.nextSlot) {
    return `${status.nextSlot.label}까지 ${formatDuration(status.secondsRemaining)} · ${base}`
  }

  return `${formatHumanDuration(status.secondsRemaining, 2)} 남음 · ${base} · ${formatShortDate(now.dateKey)}`
}
