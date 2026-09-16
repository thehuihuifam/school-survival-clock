/**
 * Timeline layout + "what happens next" projection.
 *
 * The visual timeline positions every block by its share of the *scheduled*
 * seconds (not by wall-clock offset), so the playhead lands exactly on a block
 * boundary even when tiny gaps were folded away. Everything here is pure and
 * covered by tests.
 */
import type {
  DayOutline,
  KstTimeParts,
  NextSchoolDay,
  ScheduleStatus,
  SlotKind,
  TimelineSlot,
  UserSettings,
} from '../types'
import { clamp, secondsUntilDateKey } from './time'
import { getNextSchoolDay, outlineForDate } from './schedule'

export type SlotState = 'done' | 'active' | 'upcoming'

export interface TimelineItem {
  slot: TimelineSlot
  state: SlotState
  /** 0..100 left offset inside the track. */
  startPercent: number
  /** 0..100 width inside the track. */
  widthPercent: number
  /** 0..100 completion of this individual block. */
  progress: number
  durationSeconds: number
  /** Narrow blocks drop their text label so they never overflow. */
  isCompact: boolean
}

export interface TimelineLayout {
  items: TimelineItem[]
  /** 0..100 playhead position, `null` when the day has no blocks. */
  needlePercent: number | null
  totalSeconds: number
  firstStartSeconds: number | null
  dismissalSeconds: number
}

/** Blocks narrower than this (in % of the track) render icon-only. */
export const COMPACT_WIDTH_PERCENT = 7

export function layoutTimeline(outline: DayOutline, currentSeconds: number): TimelineLayout {
  const slots = outline.slots
  if (slots.length === 0) {
    return {
      items: [],
      needlePercent: null,
      totalSeconds: 0,
      firstStartSeconds: null,
      dismissalSeconds: outline.dismissalSeconds,
    }
  }

  const totalSeconds = Math.max(
    1,
    slots.reduce((total, slot) => total + Math.max(1, slot.endSeconds - slot.startSeconds), 0),
  )

  const items: TimelineItem[] = []
  let consumedSeconds = 0
  let elapsedSeconds = 0

  for (const slot of slots) {
    const durationSeconds = Math.max(1, slot.endSeconds - slot.startSeconds)
    const startPercent = (consumedSeconds / totalSeconds) * 100
    const widthPercent = (durationSeconds / totalSeconds) * 100

    let state: SlotState = 'upcoming'
    let progress = 0
    if (currentSeconds >= slot.endSeconds) {
      state = 'done'
      progress = 100
      elapsedSeconds += durationSeconds
    } else if (currentSeconds >= slot.startSeconds) {
      state = 'active'
      progress = clamp(((currentSeconds - slot.startSeconds) / durationSeconds) * 100, 0, 100)
      elapsedSeconds += currentSeconds - slot.startSeconds
    }

    consumedSeconds += durationSeconds

    items.push({
      slot,
      state,
      startPercent,
      widthPercent,
      progress,
      durationSeconds,
      isCompact: widthPercent < COMPACT_WIDTH_PERCENT,
    })
  }

  const firstStartSeconds = slots[0].startSeconds
  let needlePercent: number
  if (currentSeconds <= firstStartSeconds) {
    needlePercent = 0
  } else if (currentSeconds >= outline.dismissalSeconds) {
    needlePercent = 100
  } else {
    needlePercent = clamp((elapsedSeconds / totalSeconds) * 100, 0, 100)
  }

  return { items, needlePercent, totalSeconds, firstStartSeconds, dismissalSeconds: outline.dismissalSeconds }
}

export interface UpcomingEvent {
  id: string
  label: string
  timeLabel: string
  kind: SlotKind
  /** Whole seconds from "now" until this block starts (0 while it is running). */
  secondsFromNow: number
  /** Whole seconds until this block ends. */
  secondsUntilEnd: number
  dateKey: string
  isToday: boolean
  isActive: boolean
  /** Day label used when the event belongs to another day (`내일`, `월요일`). */
  dayLabel: string
}

/**
 * The next few things that will happen: the running block first (if any), then
 * today's remaining blocks. Once the day is over — or on a day off — the list
 * rolls over to the next school day so the card is never empty.
 */
export function getUpcomingEvents(
  now: KstTimeParts,
  settings: UserSettings,
  status: ScheduleStatus,
  nextSchoolDay: NextSchoolDay | null,
  limit = 4,
): UpcomingEvent[] {
  const events: UpcomingEvent[] = []

  const pushToday = () => {
    const { activeSlot, outline } = status
    if (activeSlot) {
      events.push({
        id: `today-${activeSlot.id}`,
        label: activeSlot.label,
        timeLabel: activeSlot.timeLabel,
        kind: activeSlot.kind,
        secondsFromNow: 0,
        secondsUntilEnd: status.secondsRemaining,
        dateKey: now.dateKey,
        isToday: true,
        isActive: true,
        dayLabel: '오늘',
      })
    }

    const referenceSeconds = activeSlot ? activeSlot.endSeconds : now.daySeconds
    for (const slot of outline.slots) {
      if (events.length >= limit) {
        return
      }
      if (slot.endSeconds <= referenceSeconds) {
        continue
      }
      if (activeSlot && slot.id === activeSlot.id) {
        continue
      }
      events.push({
        id: `today-${slot.id}`,
        label: slot.label,
        timeLabel: slot.timeLabel,
        kind: slot.kind,
        secondsFromNow: Math.max(0, slot.startSeconds - now.daySeconds),
        secondsUntilEnd: Math.max(0, slot.endSeconds - now.daySeconds),
        dateKey: now.dateKey,
        isToday: true,
        isActive: false,
        dayLabel: '오늘',
      })
    }
  }

  if (status.phase !== 'off-day' && status.phase !== 'dismissed') {
    pushToday()
  }

  if (events.length < limit) {
    const upcomingDay = nextSchoolDay ?? getNextSchoolDay(now, settings, now.dateKey)
    if (upcomingDay) {
      const secondsToMidnight = secondsUntilDateKey(now, upcomingDay.dateKey)
      const outline = outlineForDate(settings, upcomingDay.dateKey)
      for (const slot of outline.slots) {
        if (events.length >= limit) {
          break
        }
        const startsIn = secondsToMidnight + slot.startSeconds
        if (startsIn < 0) {
          continue
        }
        events.push({
          id: `${upcomingDay.dateKey}-${slot.id}`,
          label: slot.label,
          timeLabel: slot.timeLabel,
          kind: slot.kind,
          secondsFromNow: startsIn,
          secondsUntilEnd: secondsToMidnight + slot.endSeconds,
          dateKey: upcomingDay.dateKey,
          isToday: upcomingDay.dateKey === now.dateKey,
          isActive: false,
          dayLabel: upcomingDay.dateKey === now.dateKey ? '오늘' : upcomingDay.label,
        })
      }
    }
  }

  return events.slice(0, limit)
}
