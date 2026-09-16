/**
 * Transition alerts.
 *
 * The dashboard watches the schedule phase key; when it changes we know a bell
 * just rang somewhere in the school day (class started, break started, lunch,
 * after-school duty, dismissal). This module turns that transition into a
 * chime + an optional system notification, and — importantly — ignores
 * transitions that happened long ago, so waking a laptop at 15:00 does not
 * replay the whole morning's bells.
 */
import type { ScheduleEvent, ScheduleEventKind, ScheduleStatus, TimelineSlot } from '../types'
import { formatHumanDuration, formatMinutes } from './time'
import { chimeEngine, type ChimeKind } from './sound'
import { showNotification } from './notify'

/** Transitions older than this are treated as history, not as events. */
export const STALE_EVENT_SECONDS = 90

const CHIME_FOR_EVENT: Record<ScheduleEventKind, ChimeKind | null> = {
  'class-started': 'class-started',
  'break-started': 'break-started',
  'lunch-started': 'lunch-started',
  'duty-started': 'duty-started',
  dismissed: 'dismissed',
  'before-first-slot': null,
}

export function eventKindForStatus(status: ScheduleStatus): ScheduleEventKind | null {
  switch (status.phase) {
    case 'dismissed':
      return 'dismissed'
    case 'in-slot':
      if (!status.activeSlot) {
        return null
      }
      if (status.activeSlot.kind === 'break') {
        return 'break-started'
      }
      if (status.activeSlot.kind === 'lunch') {
        return 'lunch-started'
      }
      if (status.activeSlot.kind === 'duty') {
        return 'duty-started'
      }
      return 'class-started'
    case 'before-first-slot':
      return 'before-first-slot'
    default:
      return null
  }
}

/**
 * Compare the previous phase key with the current status. Returns an event only
 * for a *fresh* transition (`ageSeconds` within the stale window).
 */
export function detectScheduleEvent(
  previousPhaseKey: string | null,
  status: ScheduleStatus,
  currentDaySeconds: number,
): ScheduleEvent | null {
  if (previousPhaseKey === null || previousPhaseKey === status.phaseKey) {
    return null
  }

  const kind = eventKindForStatus(status)
  if (!kind || kind === 'before-first-slot') {
    return null
  }

  const ageSeconds = Math.max(0, currentDaySeconds - status.phaseStartSeconds)
  if (ageSeconds > STALE_EVENT_SECONDS) {
    return null
  }

  return { kind, slot: status.activeSlot, ageSeconds }
}

function describeNext(status: ScheduleStatus, slot: TimelineSlot | null) {
  const next = status.nextSlot
  if (next) {
    return `다음은 ${next.label} ${next.timeLabel}`
  }
  if (slot) {
    return `${slot.timeLabel} 일정입니다`
  }
  return '오늘 일정은 여기까지입니다'
}

export function alertCopy(event: ScheduleEvent, status: ScheduleStatus): { title: string; body: string } {
  const slot = event.slot

  switch (event.kind) {
    case 'class-started':
      return {
        title: `${slot?.label ?? '수업'} 시작`,
        body: `${slot?.timeLabel ?? ''} · 오늘 남은 수업 ${formatMinutes(status.remainingClassSeconds)}`.trim(),
      }
    case 'break-started':
      return {
        title: '쉬는 시간 시작',
        body: slot
          ? `${formatHumanDuration(slot.endSeconds - slot.startSeconds, 1)} 휴식 · ${describeNext(status, slot)}`
          : describeNext(status, slot),
      }
    case 'lunch-started':
      return {
        title: '점심시간입니다',
        body: slot ? `${slot.timeLabel} · 천천히 드시고 오세요` : '천천히 드시고 오세요',
      }
    case 'duty-started':
      return {
        title: '방과후 · 업무 시간',
        body: `하교까지 ${formatHumanDuration(status.secondsRemaining, 2)} 남았습니다`,
      }
    case 'dismissed':
      return {
        title: '퇴근 시간입니다',
        body: '오늘도 무사히 생존하셨습니다. 이제 정말 가세요!',
      }
    default:
      return { title: '일정 알림', body: describeNext(status, slot) }
  }
}

export interface AlertOptions {
  sound: boolean
  notify: boolean
}

/** Fire the chime and/or system notification for a fresh transition. */
export function dispatchScheduleEvent(
  event: ScheduleEvent,
  status: ScheduleStatus,
  { sound, notify }: AlertOptions,
) {
  if (sound) {
    const chime = CHIME_FOR_EVENT[event.kind]
    if (chime) {
      chimeEngine.play(chime)
    }
  }

  if (notify) {
    const { title, body } = alertCopy(event, status)
    showNotification({ title, body, tag: `survival-${event.kind}` })
  }
}
