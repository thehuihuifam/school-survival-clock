import { describe, expect, it } from 'vitest'
import { getUpcomingEvents, layoutTimeline } from '../timeline'
import { getScheduleStatus } from '../schedule'
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

  it('on a day off previews the next school day', () => {
    const now = at('2026-09-19T01:00:00Z') // 토요일
    const status = getScheduleStatus(now, settings)
    const events = getUpcomingEvents(now, settings, status, null, 2)

    expect(events.length).toBe(2)
    expect(events[0].dateKey).toBe('2026-09-21')
    expect(events[0].isToday).toBe(false)
  })
})
