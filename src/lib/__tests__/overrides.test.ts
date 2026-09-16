import { describe, expect, it } from 'vitest'
import {
  dismissalTimeFor,
  getDayContext,
  getDayOverride,
  getNextDayOff,
  getNextSchoolDay,
  getScheduleStatus,
  getWeekContext,
  isDayOffOverride,
  isScheduledSchoolDay,
  outlineForDate,
} from '../schedule'
import { countSchoolDays, getSemesterMetrics } from '../semester'
import { getUpcomingEvents } from '../timeline'
import { at, settingsWith } from './helpers'
import type { DayOverride } from '../../types'

const offDay: DayOverride = { kind: 'off', label: '재량휴업', dismissalTime: '' }
const shortDay: DayOverride = { kind: 'short', label: '시험 기간', dismissalTime: '13:00' }

// 목요일 2026-09-17
const THURSDAY_0910 = '2026-09-17T00:10:00Z'
const THURSDAY_1400 = '2026-09-17T05:00:00Z'

describe('dismissalTimeFor', () => {
  it('falls back to the configured dismissal time', () => {
    const settings = settingsWith({ dismissalTime: '16:30' })
    expect(dismissalTimeFor(settings, '2026-09-17')).toBe('16:30')
  })

  it('lets a short-day override win for that date only', () => {
    const settings = settingsWith({ dayOverrides: { '2026-09-17': shortDay } })
    expect(dismissalTimeFor(settings, '2026-09-17')).toBe('13:00')
    expect(dismissalTimeFor(settings, '2026-09-18')).toBe('16:30')
  })

  it('ignores an off-day override (there is nothing to dismiss from)', () => {
    const settings = settingsWith({ dayOverrides: { '2026-09-17': offDay } })
    expect(dismissalTimeFor(settings, '2026-09-17')).toBe('16:30')
  })
})

describe('day-off override', () => {
  const settings = settingsWith({ dayOverrides: { '2026-09-17': offDay } })

  it('classifies the day as an override day', () => {
    const context = getDayContext(at(THURSDAY_0910), settings)
    expect(context.dayType).toBe('override')
    expect(context.label).toBe('재량휴업')
    expect(context.isSchoolDay).toBe(false)
    expect(context.hasClasses).toBe(false)
    expect(isDayOffOverride(settings, '2026-09-17')).toBe(true)
    expect(getDayOverride(settings, '2026-09-17')).toEqual(offDay)
  })

  it('turns the whole day into an off-day dashboard state', () => {
    const status = getScheduleStatus(at(THURSDAY_0910), settings)
    expect(status.phase).toBe('off-day')
    expect(status.activeSlot).toBeNull()
    expect(status.remainingClassCount).toBe(0)
    expect(status.phaseKey).toContain('override')
  })

  it('removes the day from school-day maths and the weekly rhythm', () => {
    expect(isScheduledSchoolDay(settings, '2026-09-17')).toBe(false)
    expect(countSchoolDays(settings, '2026-09-17', '2026-09-18')).toBe(0)
    expect(getWeekContext(at(THURSDAY_0910), settings).schoolDayPosition).toBe(0)

    const metrics = getSemesterMetrics(at(THURSDAY_0910), settings)
    const withoutOverride = getSemesterMetrics(at(THURSDAY_0910), settingsWith())
    expect(metrics.totalSchoolDays).toBe(withoutOverride.totalSchoolDays - 1)
  })

  it('reports today as the next day off', () => {
    const nextOff = getNextDayOff(at(THURSDAY_0910), settings)
    expect(nextOff?.dateKey).toBe('2026-09-17')
    expect(nextOff?.reason).toBe('override')
    expect(nextOff?.label).toBe('재량휴업')
    expect(nextOff?.daysUntil).toBe(0)
  })

  it('skips the day when looking ahead to the next school day', () => {
    const nextSchoolDay = getNextSchoolDay(at(THURSDAY_0910), settings, '2026-09-17')
    expect(nextSchoolDay?.dateKey).toBe('2026-09-18')
  })

  it('rolls the next-up rail over to tomorrow’s first class', () => {
    const now = at(THURSDAY_0910)
    const status = getScheduleStatus(now, settings)
    const events = getUpcomingEvents(now, settings, status, getNextSchoolDay(now, settings), 4)

    expect(events.length).toBeGreaterThan(0)
    expect(events[0].dateKey).toBe('2026-09-18')
    expect(events[0].label).toBe('1교시')
  })
})

describe('short-day override', () => {
  const settings = settingsWith({ dayOverrides: { '2026-09-17': shortDay } })

  it('moves dismissal forward and says so in the hero copy', () => {
    const context = getDayContext(at(THURSDAY_0910), settings)
    expect(context.dayType).toBe('school')
    expect(context.description).toContain('단축 하교 13:00')

    const status = getScheduleStatus(at(THURSDAY_0910), settings)
    expect(status.outline.dismissalSeconds).toBe(13 * 3600)
  })

  it('treats everything after the early dismissal as done', () => {
    const status = getScheduleStatus(at(THURSDAY_1400), settings) // 14:00 KST
    expect(status.phase).toBe('dismissed')
    expect(status.dayProgress).toBe(100)
    expect(status.remainingClassCount).toBe(0)
  })

  it('cuts the timetable short instead of only moving the countdown', () => {
    const status = getScheduleStatus(at(THURSDAY_0910), settings)
    const labels = status.outline.slots.map((slot) => slot.label)

    // 점심시간(12:20~13:20) is clamped to the 13:00 stop, 5·6교시 disappear.
    expect(labels).toEqual(['1교시', '쉬는 시간', '2교시', '쉬는 시간', '3교시', '쉬는 시간', '4교시', '점심시간 및 급식'])
    expect(status.outline.slots.at(-1)?.endSeconds).toBe(13 * 3600)
    expect(status.totalClassCount).toBe(4)
  })

  it('keeps the weekly timetable untouched for other dates', () => {
    const friday = getScheduleStatus(at('2026-09-18T00:10:00Z'), settings)
    expect(friday.phase).toBe('in-slot')
    expect(friday.outline.dismissalSeconds).toBe(16 * 3600 + 30 * 60)

    const nextWeek = outlineForDate(settings, '2026-09-24')
    expect(nextWeek.dismissalSeconds).toBe(16 * 3600 + 30 * 60)
  })
})
