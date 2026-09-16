import { describe, expect, it } from 'vitest'
import {
  describeSemesterWindow,
  getAutoSemesterWindow,
  isValidSemesterRange,
  sameSemesterWindow,
} from '../semesterWindow'
import { getDayContext, getNextSchoolDay } from '../schedule'
import { getSemesterMetrics } from '../semester'
import { at, settingsWith } from './helpers'

describe('getAutoSemesterWindow', () => {
  it('anchors the spring semester to 3월 2일 – 7월 20일', () => {
    const window = getAutoSemesterWindow('2026-04-14')
    expect(window.id).toBe('spring')
    expect(window.label).toBe('1학기')
    expect(window.startDate).toBe('2026-03-02')
    expect(window.vacationDate).toBe('2026-07-20')
    expect(window.vacationLabel).toBe('여름방학')
  })

  it('anchors the fall semester to 8월 18일 – next 1월 6일', () => {
    const window = getAutoSemesterWindow('2026-09-17')
    expect(window.id).toBe('fall')
    expect(window.label).toBe('2학기')
    expect(window.startDate).toBe('2026-08-18')
    expect(window.vacationDate).toBe('2027-01-06')
    expect(window.vacationLabel).toBe('겨울방학')
  })

  it('moves the window at the summer boundary', () => {
    expect(getAutoSemesterWindow('2026-08-17')).toMatchObject({
      id: 'spring',
      startDate: '2026-03-02',
      vacationDate: '2026-07-20',
    })
    expect(getAutoSemesterWindow('2026-08-18')).toMatchObject({
      id: 'fall',
      startDate: '2026-08-18',
      vacationDate: '2027-01-06',
    })
  })

  it('keeps January and February inside the previous school year', () => {
    const january = getAutoSemesterWindow('2027-01-10')
    expect(january.id).toBe('fall')
    expect(january.startDate).toBe('2026-08-18')
    expect(january.vacationDate).toBe('2027-01-06')

    const february = getAutoSemesterWindow('2027-02-28')
    expect(february).toEqual(january)
  })

  it('opens the new school year on 3월 1일', () => {
    const window = getAutoSemesterWindow('2027-03-01')
    expect(window.id).toBe('spring')
    // 3월 1일 is 삼일절, so the semester itself starts the next day.
    expect(window.startDate).toBe('2027-03-02')
    expect(window.vacationDate).toBe('2027-07-20')
  })

  it('survives a broken date key instead of throwing', () => {
    const window = getAutoSemesterWindow('not-a-date')
    expect(isValidSemesterRange(window.startDate, window.vacationDate)).toBe(true)
  })
})

describe('semester window helpers', () => {
  it('describes a window in Korean', () => {
    expect(describeSemesterWindow(getAutoSemesterWindow('2026-09-17')))
      .toBe('2학기 · 08.18 개학 → 01.06 겨울방학')
  })

  it('compares windows by their dates', () => {
    expect(sameSemesterWindow(getAutoSemesterWindow('2026-09-17'), getAutoSemesterWindow('2026-12-31'))).toBe(true)
    expect(sameSemesterWindow(getAutoSemesterWindow('2026-09-17'), getAutoSemesterWindow('2027-03-10'))).toBe(false)
  })
})

describe('automatic window integration', () => {
  it('never classifies a fresh install as a permanent vacation', () => {
    // Regression: the defaults used to be frozen at 2026-08-25 → 2026-12-31, so
    // every day after that read as 방학 with the battery pinned at 100%.
    for (const dateKey of ['2027-03-10', '2027-09-17', '2031-05-04', '2040-11-01']) {
      const settings = settingsWith()
      const window = getAutoSemesterWindow(dateKey)
      const inWindow = settingsWith({ semesterStart: window.startDate, vacationDate: window.vacationDate })

      // A weekday inside the window is an ordinary school day…
      expect(getDayContext(at(`${window.startDate.slice(0, 4)}-08-25T01:00:00Z`), settings).label)
        .not.toBe('')
      // …and the configured dates really do come from today.
      expect(getSemesterMetrics(at(`${dateKey}T01:00:00Z`), inWindow).isConfigured).toBe(true)
    }
  })

  it('reports in-semester metrics for the automatic window of a fall day', () => {
    const window = getAutoSemesterWindow('2026-09-17')
    const metrics = getSemesterMetrics(
      at('2026-09-17T01:00:00Z'),
      settingsWith({ semesterStart: window.startDate, vacationDate: window.vacationDate }),
    )

    expect(metrics.phase).toBe('in-semester')
    expect(metrics.progress).toBeGreaterThan(0)
    expect(metrics.progress).toBeLessThan(100)
    expect(metrics.schoolDaysRemaining).toBeGreaterThan(0)
  })

  it('sees the next semester past the current vacation', () => {
    // 여름방학 7/25: the spring window is on vacation until 8/17, and the next
    // school day is the 8/18 개학일 of the fall window.
    const summer = settingsWith()
    expect(getDayContext(at('2026-07-25T04:00:00Z'), summer).dayType).toBe('vacation')

    const nextSchoolDay = getNextSchoolDay(at('2026-07-25T04:00:00Z'), summer)
    expect(nextSchoolDay?.dateKey).toBe('2026-08-18')
    expect(nextSchoolDay?.daysUntil).toBe(24)
    expect(nextSchoolDay?.firstPeriodSeconds).toBe(9 * 3600)

    // …and the day after 개학 is an ordinary school day again.
    expect(getDayContext(at('2026-08-18T04:00:00Z'), summer).dayType).toBe('school')
  })

  it('keeps the winter vacation connected to the new school year', () => {
    const winter = settingsWith()
    expect(getDayContext(at('2027-02-20T04:00:00Z'), winter).dayType).toBe('vacation')

    const nextSchoolDay = getNextSchoolDay(at('2027-02-20T04:00:00Z'), winter)
    expect(nextSchoolDay?.dateKey).toBe('2027-03-02')

    // 3월 1일 is still "개학 전", never a school day.
    expect(getDayContext(at('2027-03-01T04:00:00Z'), winter).dayType).toBe('before-semester')
  })

  it('reads a January day inside the winter vacation of that window', () => {
    const window = getAutoSemesterWindow('2027-01-10')
    const metrics = getSemesterMetrics(
      at('2027-01-10T01:00:00Z'),
      settingsWith({ semesterStart: window.startDate, vacationDate: window.vacationDate }),
    )

    expect(metrics.phase).toBe('vacation')
    expect(metrics.progress).toBe(100)
  })
})
