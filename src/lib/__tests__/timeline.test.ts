import { describe, expect, it } from 'vitest'
import { getUpcomingEvents, layoutTimeline } from '../timeline'
import { getNextSchoolDay, getScheduleStatus } from '../schedule'
import { at, settingsWith } from './helpers'

describe('layoutTimeline', () => {
  const settings = settingsWith()
  const outline = getScheduleStatus(at('2026-09-17T00:10:00Z'), settings).outline

  it('lays slots out proportionally without gaps', () => {
    const layout = layoutTimeline(outline, 9 * 3600 + 10 * 60)
    const total = layout.items.reduce((sum, item) => sum + item.widthPercent, 0)
    expect(total).toBeCloseTo(100, 6)
    expect(layout.items[0].startPercent).toBe(0)
    expect(layout.items[0].state).toBe('active')
    expect(layout.items[0].progress).toBeCloseTo(25, 5)
  })

  it('pins the playhead at the ends of the day', () => {
    expect(layoutTimeline(outline, 0).needlePercent).toBe(0)
    expect(layoutTimeline(outline, outline.dismissalSeconds + 600).needlePercent).toBe(100)
  })

  it('marks completed and upcoming blocks', () => {
    const layout = layoutTimeline(outline, 13 * 3600)
    const states = layout.items.map((item) => item.state)
    expect(states.at(0)).toBe('done')
    expect(states.at(-1)).toBe('upcoming')
  })
})

describe('getUpcomingEvents', () => {
  const settings = settingsWith()

  it('lists the running block first, then today’s remaining blocks', () => {
    const now = at('2026-09-17T00:10:00Z')
    const status = getScheduleStatus(now, settings)
    const events = getUpcomingEvents(now, settings, status, null, 4)

    expect(events[0].isActive).toBe(true)
    expect(events[0].label).toBe('1교시')
    expect(events.every((event) => event.isToday)).toBe(true)
    expect(events.length).toBeLessThanOrEqual(4)
  })

  it('rolls over to the next school day after dismissal', () => {
    const now = at('2026-09-17T08:30:00Z') // 목 17:30
    const status = getScheduleStatus(now, settings)
    const events = getUpcomingEvents(now, settings, status, null, 3)

    expect(status.phase).toBe('dismissed')
    expect(events.length).toBe(3)
    expect(events.every((event) => event.dateKey === '2026-09-18')).toBe(true)
    expect(events[0].secondsFromNow).toBeGreaterThan(0)
  })

  // 요구사항(D-3): 하교 완료 후에는 오늘의 지난 교시가 upcomingEvents에 포함되지 않는다.
  it('never shows today’s finished periods once 하교 is complete (D-3)', () => {
    const now = at('2026-09-17T09:00:00Z') // 목 18:00 KST · 하교(16:30) 완료
    const status = getScheduleStatus(now, settings)
    expect(status.phase).toBe('dismissed')

    // App은 하교 후 '오늘을 제외한' 앵커를 넘긴다. 그럼에도 낡은 앵커가 들어와도
    // 지난 교시가 "9시간 후"로 되살아나면 안 된다.
    const staleAnchor = getNextSchoolDay(now, settings)
    expect(staleAnchor?.dateKey).toBe(now.dateKey)

    const events = getUpcomingEvents(now, settings, status, staleAnchor, 6)
    expect(events.filter((event) => event.dateKey === now.dateKey)).toHaveLength(0)
    expect(events).toHaveLength(0)
  })

  it('never appends today a second time when a today anchor is handed in', () => {
    // 등교 전(00:05)에는 앵커가 정당하게 '오늘'이지만, 폴백이 같은 날을 한 번 더
    // 채우면 같은 교시가 두 번(지난 일정처럼) 쌓인다.
    const now = at('2026-09-17T15:05:00Z') // 금 00:05 KST
    const minimalFriday = settingsWith()
    minimalFriday.timetables['5'] = {
      enabled: true,
      periods: [{ id: 'p1', label: '1교시', kind: 'class', start: '09:00', end: '09:40' }],
    }
    const status = getScheduleStatus(now, minimalFriday)
    const todayAnchor = getNextSchoolDay(now, minimalFriday)
    expect(todayAnchor?.dateKey).toBe(now.dateKey)

    const events = getUpcomingEvents(now, minimalFriday, status, todayAnchor, 30)
    const keys = events.map((event) => `${event.dateKey}-${event.label}-${event.timeLabel}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(events.every((event) => event.dateKey === now.dateKey)).toBe(true)
    expect(events).toHaveLength(2) // 1교시 + 방과후 · 업무 시간
  })

  it('rolls the rail over to tomorrow once today is excluded (D-3)', () => {
    const now = at('2026-09-17T09:00:00Z') // 목 18:00 KST
    const status = getScheduleStatus(now, settings)
    const anchor = getNextSchoolDay(now, settings, now.dateKey)

    expect(anchor?.dateKey).toBe('2026-09-18')
    const events = getUpcomingEvents(now, settings, status, anchor, 3)
    expect(events).toHaveLength(3)
    expect(events.every((event) => event.dateKey === '2026-09-18')).toBe(true)
    expect(events.every((event) => event.isToday === false)).toBe(true)
    expect(events[0].dayLabel).toBe('내일')
    expect(events[0].secondsFromNow).toBeGreaterThan(0)
  })

  it('on a day off previews the next school day', () => {
    const now = at('2026-09-19T01:00:00Z') // 토요일
    const status = getScheduleStatus(now, settings)
    const events = getUpcomingEvents(now, settings, status, null, 2)

    expect(events.length).toBe(2)
    expect(events[0].dateKey).toBe('2026-09-21')
    expect(events[0].isToday).toBe(false)
  })
})
