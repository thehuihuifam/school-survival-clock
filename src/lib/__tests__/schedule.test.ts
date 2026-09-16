import { describe, expect, it } from 'vitest'
import {
  buildOutline,
  getDayContext,
  getDayTimetable,
  getNextDayOff,
  getNextSchoolDay,
  getScheduleStatus,
  getWeekContext,
  isScheduledSchoolDay,
  sanitizePeriods,
} from '../schedule'
import { at, settingsWith } from './helpers'
import type { TimetablePeriod } from '../../types'

const periods = (rows: Array<Partial<TimetablePeriod> & { start: string; end: string }>): TimetablePeriod[] =>
  rows.map((row, index) => ({
    id: row.id ?? `p${index}`,
    label: row.label ?? `${index + 1}교시`,
    kind: row.kind ?? 'class',
    start: row.start,
    end: row.end,
  }))

describe('sanitizePeriods', () => {
  it('sorts by start time and drops overlapping or broken rows', () => {
    const cleaned = sanitizePeriods(
      periods([
        { start: '10:00', end: '10:40' },
        { start: '09:00', end: '09:40' },
        { start: '09:20', end: '09:50' }, // overlaps the previous block
        { start: '11:00', end: '11:00' }, // zero length
        { start: '99:99', end: '99:99' }, // impossible
      ]),
    )

    expect(cleaned.map((period) => period.start)).toEqual(['09:00', '10:00'])
  })
})

describe('buildOutline', () => {
  it('inserts breaks for gaps of five minutes or more and skips micro gaps', () => {
    const outline = buildOutline(
      {
        enabled: true,
        periods: periods([
          { start: '09:00', end: '09:40' },
          { start: '09:44', end: '10:24' }, // 4 minute gap: absorbed
          { start: '10:44', end: '11:24' }, // 20 minute gap: real break
        ]),
      },
      '16:30',
    )

    const kinds = outline.slots.map((slot) => slot.kind)
    expect(kinds).toEqual(['class', 'class', 'break', 'class', 'duty'])
    expect(outline.slots[2].startSeconds).toBe(10 * 3600 + 24 * 60)
    expect(outline.slots[2].endSeconds).toBe(10 * 3600 + 44 * 60)
  })

  it('appends an after-school duty tail only when there is room', () => {
    const withTail = buildOutline(
      { enabled: true, periods: periods([{ start: '09:00', end: '14:50', kind: 'class' }]) },
      '16:30',
    )
    expect(withTail.slots.at(-1)?.kind).toBe('duty')
    expect(withTail.dismissalSeconds).toBe(16 * 3600 + 30 * 60)

    const noTail = buildOutline(
      { enabled: true, periods: periods([{ start: '09:00', end: '16:25', kind: 'class' }]) },
      '16:30',
    )
    expect(noTail.slots.at(-1)?.kind).toBe('class')
  })

  it('returns an empty outline for disabled or empty timetables', () => {
    expect(buildOutline({ enabled: false, periods: [] }, '16:30').slots).toHaveLength(0)
    expect(buildOutline({ enabled: true, periods: [] }, '16:30').slots).toHaveLength(0)
  })
})

describe('getDayContext', () => {
  it('classifies weekends, holidays, vacation and pre-semester days', () => {
    const settings = settingsWith({
      semesterStart: '2026-08-25',
      vacationDate: '2026-12-31',
      holidays: [{ date: '2026-09-24', label: '재량휴업일' }],
    })

    expect(getDayContext(at('2026-09-17T01:00:00Z'), settings).dayType).toBe('school') // 목
    expect(getDayContext(at('2026-09-19T01:00:00Z'), settings).dayType).toBe('weekend') // 토
    expect(getDayContext(at('2026-09-24T01:00:00Z'), settings).dayType).toBe('holiday')
    expect(getDayContext(at('2026-09-24T01:00:00Z'), settings).label).toBe('재량휴업일')
    expect(getDayContext(at('2027-01-05T01:00:00Z'), settings).dayType).toBe('vacation')
    expect(getDayContext(at('2026-08-20T01:00:00Z'), settings).dayType).toBe('before-semester')
  })

  it('reports no-classes when the weekday timetable is empty', () => {
    const settings = settingsWith()
    settings.timetables['4'] = { enabled: true, periods: [] }
    expect(getDayContext(at('2026-09-17T01:00:00Z'), settings).dayType).toBe('no-classes')
  })
})

describe('getScheduleStatus', () => {
  const settings = settingsWith()

  it('is off-day outside school days', () => {
    const status = getScheduleStatus(at('2026-09-19T04:00:00Z'), settings) // 토요일
    expect(status.phase).toBe('off-day')
    expect(status.day.isSchoolDay).toBe(false)
  })

  it('walks through before-school, in-slot, between-slots and dismissed', () => {
    const before = getScheduleStatus(at('2026-09-16T23:00:00Z'), settings) // 08:00 KST
    expect(before.phase).toBe('before-first-slot')
    expect(before.nextSlot?.id).toBe('p1')
    expect(before.secondsRemaining).toBe(60 * 60)

    const firstClass = getScheduleStatus(at('2026-09-17T00:10:00Z'), settings) // 09:10 KST
    expect(firstClass.phase).toBe('in-slot')
    expect(firstClass.activeSlot?.label).toBe('1교시')
    expect(firstClass.secondsRemaining).toBe(30 * 60)
    expect(firstClass.slotProgress).toBeCloseTo(25, 5)
    expect(firstClass.isBreak).toBe(false)

    const breakTime = getScheduleStatus(at('2026-09-17T00:45:00Z'), settings) // 09:45 KST
    expect(breakTime.phase).toBe('in-slot')
    expect(breakTime.isBreak).toBe(true)
    expect(breakTime.activeSlot?.kind).toBe('break')

    const after = getScheduleStatus(at('2026-09-17T08:00:00Z'), settings) // 17:00 KST
    expect(after.phase).toBe('dismissed')
    expect(after.dayProgress).toBe(100)
    expect(after.secondsSinceDismissal).toBe(30 * 60)
  })

  it('counts remaining teaching load through the day (short Friday)', () => {
    const morning = getScheduleStatus(at('2026-09-18T00:10:00Z'), settings) // 금 09:10
    expect(morning.totalClassCount).toBe(4)
    expect(morning.remainingClassCount).toBe(4)
    expect(morning.remainingClassSeconds).toBe(3 * 40 * 60 + 30 * 60)

    const late = getScheduleStatus(at('2026-09-18T04:00:00Z'), settings) // 금 13:00
    expect(late.remainingClassCount).toBe(0)
    expect(late.completedClassCount).toBe(4)
    expect(late.classLoadProgress).toBe(100)
  })

  it('uses the full six-period outline on a regular weekday', () => {
    const thursday = getScheduleStatus(at('2026-09-17T00:10:00Z'), settings) // 목 09:10
    expect(thursday.totalClassCount).toBe(6)
    expect(thursday.outline.totalBreakSeconds).toBe(50 * 60)
  })

  it('produces a stable phase key that changes exactly on transitions', () => {
    const a = getScheduleStatus(at('2026-09-17T00:10:00Z'), settings)
    const b = getScheduleStatus(at('2026-09-17T00:11:00Z'), settings)
    const c = getScheduleStatus(at('2026-09-17T00:41:00Z'), settings)
    expect(a.phaseKey).toBe(b.phaseKey)
    expect(a.phaseKey).not.toBe(c.phaseKey)
  })
})

describe('look-ahead', () => {
  const settings = settingsWith({
    holidays: [{ date: '2026-09-21', label: '대체휴일' }],
  })

  it('finds the next day off including registered holidays', () => {
    const nextOff = getNextDayOff(at('2026-09-18T01:00:00Z'), settings) // 금요일
    expect(nextOff?.dateKey).toBe('2026-09-19')
    expect(nextOff?.reason).toBe('weekend')

    const fromSaturday = getNextDayOff(at('2026-09-19T01:00:00Z'), settings)
    expect(fromSaturday?.dateKey).toBe('2026-09-19')
    expect(fromSaturday?.daysUntil).toBe(0)
  })

  it('skips weekends and holidays when finding the next school day', () => {
    const nextSchool = getNextSchoolDay(at('2026-09-19T01:00:00Z'), settings) // 토요일
    expect(nextSchool?.dateKey).toBe('2026-09-22')
    expect(nextSchool?.firstPeriodSeconds).toBe(9 * 3600)
  })

  it('reports the weekly rhythm', () => {
    const week = getWeekContext(at('2026-09-17T01:00:00Z'), settings) // 목요일
    expect(week.schoolDaysThisWeek).toBe(5)
    expect(week.schoolDayPosition).toBe(4)
    expect(week.remainingSchoolDaysThisWeek).toBe(1)
  })

  it('keeps isScheduledSchoolDay consistent with holidays and timetables', () => {
    expect(isScheduledSchoolDay(settings, '2026-09-17')).toBe(true)
    expect(isScheduledSchoolDay(settings, '2026-09-19')).toBe(false)
    expect(isScheduledSchoolDay(settings, '2026-09-21')).toBe(false)
  })

  it('resolves per-weekday timetables', () => {
    expect(getDayTimetable(settings, 5).periods).toHaveLength(5) // 금요일 단축
    expect(getDayTimetable(settings, 1).periods).toHaveLength(7) // 월요일 6교시+점심
  })
})
