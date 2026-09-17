/**
 * 화면에 표시되는 문구.
 *
 * 순수 상태(ScheduleStatus)에서 문구를 만들어 내는 곳을 한 군데로 모아 두면
 * 컴포넌트는 선언적으로 남고, 문구는 렌더링 없이도 단위 테스트로 검증할 수 있다.
 * 모든 문구는 한국어로 쓴다(장식용 영어 카피는 쓰지 않는다).
 */
import type {
  DayPhase,
  DayType,
  KstTimeParts,
  NextSchoolDay,
  ScheduleStatus,
  TimelineSlot,
} from '../types'
import {
  formatDateKeyShort,
  formatDuration,
  formatHmFromSeconds,
  formatHumanDuration,
  formatMinutes,
  formatPercent,
} from './time'

export type HeroTone = 'focus' | 'break' | 'rest' | 'done' | 'waiting' | 'pre'

export interface HeroHeadline {
  /** 상태 이름(수업 중 / 쉬는 시간 / 등교 전 …). */
  kicker: string
  /** 굵게 보여 주는 한 줄. */
  title: string
  /** 보조 설명 한 줄. */
  helper: string
  /** 큰 카운트다운 값(이미 포맷된 문자열). */
  value: string
  /** 카운트다운 아래 보조 문구. */
  valueNote: string
  tone: HeroTone
  icon:
    | 'alarm-bold'
    | 'bell-ring-bold'
    | 'check-circle-bold'
    | 'cup-hot-bold'
    | 'plate-bold'
    | 'notebook-bold'
    | 'moon-stars-bold'
    | 'stopwatch-bold'
    | 'sunrise-bold'
  /** 진행 바 0..100. */
  barProgress: number
  /** 진행 바 오른쪽 라벨. */
  barLabel: string
}

export const DAY_TYPE_TONES: Record<DayType, string> = {
  school: 'is-school',
  'no-classes': 'is-soft',
  weekend: 'is-rest',
  holiday: 'is-rest',
  // `override`는 오늘 하루만 적용한 휴업 — 잠깐 쉬어 가는 날.
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

/** 다음 수업이 예비종 구간에 들어왔는가? (`preAlertSeconds === 0`이면 끈 것) */
function isPreAlertWindow(status: ScheduleStatus, preAlertSeconds: number) {
  return (
    preAlertSeconds > 0 &&
    status.secondsRemaining > 0 &&
    status.secondsRemaining <= preAlertSeconds
  )
}

/** 예비종 구간에서 공통으로 쓰는 헤드라인. */
function preAlertHeadline(
  status: ScheduleStatus,
  slot: TimelineSlot,
  valueNote: string,
  barProgress: number,
  barLabel: string,
): HeroHeadline {
  return {
    kicker: '예비종',
    title: `${slot.label} 곧 시작`,
    helper: `${slot.timeLabel} · 교실로 이동할 시간이에요`,
    value: formatDuration(status.secondsRemaining),
    valueNote,
    tone: 'pre',
    icon: 'bell-ring-bold',
    barProgress,
    barLabel,
  }
}

/** 진행 중인 블록의 상태 이름. */
function slotKicker(slot: TimelineSlot) {
  switch (slot.kind) {
    case 'break':
      return '쉬는 시간'
    case 'lunch':
      return '점심시간'
    case 'duty':
      return '방과후 · 업무'
    case 'club':
      return '재량 · 동아리'
    default:
      return slot.classIndex === null ? '수업 중' : `${slot.classIndex}교시 수업 중`
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
      kicker: '쉬는 날',
      title: day.label,
      helper: day.description,
      value: nextSchoolDay ? formatHumanDuration(nextSchoolDay.secondsUntilFirstPeriod, 2) : '미정',
      valueNote: nextSchoolDay
        ? `다음 등교 ${nextSchoolDay.label}${nextSchoolDay.daysUntil > 0 ? ` ${formatDateKeyShort(nextSchoolDay.dateKey)}` : ''}${
            nextSchoolDay.firstPeriodSeconds === null
              ? ''
              : ` · 첫 일정 ${formatHmFromSeconds(nextSchoolDay.firstPeriodSeconds)}`
          }`
        : '설정에서 학기와 시간표를 확인해 주세요',
      tone: 'rest',
      icon: day.dayType === 'vacation' ? 'moon-stars-bold' : 'sunrise-bold',
      barProgress: 0,
      barLabel: '충전 중',
    }
  }

  if (phase === 'dismissed') {
    return {
      kicker: '하루 완료',
      title: '오늘 일정 끝',
      helper: `${formatHmFromSeconds(outline.dismissalSeconds)} 하교 · 수고하셨어요`,
      value: `+${formatHumanDuration(status.secondsSinceDismissal, 2)}`,
      valueNote:
        status.totalClassCount > 0
          ? `${status.totalClassCount}교시 · ${formatMinutes(status.totalClassSeconds)} 수업 완료`
          : '오늘 블록을 모두 통과했어요',
      tone: 'done',
      icon: 'check-circle-bold',
      barProgress: 100,
      barLabel: '오늘 100%',
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
        `등교 ${formatHmFromSeconds(first.startSeconds)}`,
      )
    }
    return {
      kicker: '등교 전',
      title: first ? `${first.label}까지` : '첫 일정까지',
      helper: first ? `${first.timeLabel} 시작` : '오늘 첫 일정이 없어요',
      value: formatDuration(status.secondsRemaining),
      valueNote: `오늘 ${status.totalClassCount}교시 · 수업 ${formatMinutes(status.totalClassSeconds)}`,
      tone: 'waiting',
      icon: 'sunrise-bold',
      barProgress: 0,
      barLabel: first ? `등교 ${formatHmFromSeconds(first.startSeconds)}` : '시간표 없음',
    }
  }

  if (phase === 'in-slot' && activeSlot) {
    const isBreak = activeSlot.kind === 'break'
    const isLunch = activeSlot.kind === 'lunch'

    // 쉬는 시간에는 카운트다운이 이미 다음 수업을 향하므로, 마지막 몇 분은
    // 자연스럽게 "예비종" 상태가 된다.
    if ((isBreak || isLunch) && nextSlot?.kind === 'class' && isPreAlertWindow(status, preAlertSeconds)) {
      return preAlertHeadline(
        status,
        nextSlot,
        `남은 수업 ${formatMinutes(status.remainingClassSeconds)} · ${status.remainingClassCount}교시`,
        dayProgress,
        `오늘 ${formatPercent(dayProgress, 0)}%`,
      )
    }

    return {
      kicker: slotKicker(activeSlot),
      title: activeSlot.label,
      helper: `${activeSlot.timeLabel} · ${formatPercent(status.slotProgress, 0)}% 지남`,
      value: formatDuration(status.secondsRemaining),
      valueNote:
        isBreak || isLunch
          ? nextSlot
            ? `다음 ${nextSlot.label} ${formatHmFromSeconds(nextSlot.startSeconds)}`
            : '이어서 하교'
          : `남은 수업 ${formatMinutes(status.remainingClassSeconds)} · ${status.remainingClassCount}교시`,
      tone: isBreak || isLunch ? 'break' : 'focus',
      icon: isBreak
        ? 'cup-hot-bold'
        : isLunch
          ? 'plate-bold'
          : activeSlot.kind === 'duty'
            ? 'stopwatch-bold'
            : 'notebook-bold',
      barProgress: dayProgress,
      barLabel: `오늘 ${formatPercent(dayProgress, 0)}%`,
    }
  }

  // between-slots
  if (nextSlot?.kind === 'class' && isPreAlertWindow(status, preAlertSeconds)) {
    return preAlertHeadline(
      status,
      nextSlot,
      `남은 수업 ${formatMinutes(status.remainingClassSeconds)} · ${status.remainingClassCount}교시`,
      dayProgress,
      `오늘 ${formatPercent(dayProgress, 0)}%`,
    )
  }

  return {
    kicker: '틈새 시간',
    title: nextSlot ? `${nextSlot.label} 준비` : '하루 마무리',
    helper: nextSlot
      ? `${nextSlot.timeLabel} 시작`
      : `${formatHmFromSeconds(outline.dismissalSeconds)} 하교까지`,
    value: formatDuration(status.secondsRemaining),
    valueNote: `남은 수업 ${formatMinutes(status.remainingClassSeconds)}`,
    tone: 'break',
    icon: 'cup-hot-bold',
    barProgress: dayProgress,
    barLabel: `오늘 ${formatPercent(dayProgress, 0)}%`,
  }
}

/**
 * KST 시각대에 맞춘 인사말.
 *
 * 호출부가 `{인사말}, {이름}.` 형태로 조합하므로 문구 자체에 호칭을 넣지 않는다
 * (넣으면 "좋은 아침이에요, 선생님, 김선생님."이 된다).
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
    return '점심은 꼭 챙겨 드세요'
  }
  if (hour < 18) {
    return '오후도 무사히 갑니다'
  }
  if (hour < 22) {
    return '이제 퇴근 준비하세요'
  }
  return '오늘 하루도 마무리 중이에요'
}

/** 브라우저 탭 제목. 탭만 봐도 지금 상태를 알 수 있게 만든다. */
export function documentTitleFor(status: ScheduleStatus, now: KstTimeParts) {
  const base = '교사 생존 시계'

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

  return `${formatHumanDuration(status.secondsRemaining, 2)} 남음 · ${base} · ${formatDateKeyShort(now.dateKey)}`
}
