import { describe, expect, it } from 'vitest'
import { countSchoolDays, getSemesterMetrics } from '../semester'
import { at, settingsWith } from './helpers'

describe('countSchoolDays', () => {
  const settings = settingsWith({
    semesterStart: '2026-08-31',
    vacationDate: '2026-09-07',
    holidays: [{ date: '2026-09-03', label: '재량휴업일' }],
  })

  it('counts only teaching weekdays, skipping weekends and holidays', () => {
    // Mon 8/31 … Sun 9/6 = 5 weekdays, minus the registered holiday
    expect(countSchoolDays(settings, '2026-08-31', '2026-09-07')).toBe(4)
  })

  it('is half-open so elapsed + remaining equals the total', () => {
    const total = countSchoolDays(settings, '2026-08-31', '2026-09-07')
    const elapsed = countSchoolDays(settings, '2026-08-31', '2026-09-03')
    const remaining = countSchoolDays(settings, '2026-09-03', '2026-09-07')
    expect(elapsed + remaining).toBe(total)
  })

  it('returns zero for inverted or broken ranges', () => {
    expect(countSchoolDays(settings, '2026-09-07', '2026-08-31')).toBe(0)
    expect(countSchoolDays(settings, 'oops', '2026-09-07')).toBe(0)
  })
})

describe('getSemesterMetrics', () => {
  const settings = settingsWith({
    semesterStart: '2026-08-31',
    vacationDate: '2026-09-11',
    holidays: [],
  })

  it('charges the battery per school day', () => {
    // Week of 8/31..9/4 (5) + week of 9/7..9/10 (4, vacation on 9/11) = 9 days.
    const wednesday = getSemesterMetrics(at('2026-09-02T01:00:00Z'), settings)
    expect(wednesday.totalSchoolDays).toBe(9)
    expect(wednesday.elapsedSchoolDays).toBe(2) // Mon, Tue survived
    expect(wednesday.schoolDaysRemaining).toBe(7)
    expect(wednesday.progress).toBeCloseTo((2 / 9) * 100, 6)
    expect(wednesday.phase).toBe('in-semester')
  })

  it('pins to 0 before the semester and 100 during vacation', () => {
    const before = getSemesterMetrics(at('2026-08-20T01:00:00Z'), settings)
    expect(before.progress).toBe(0)
    expect(before.phase).toBe('before-semester')

    const vacation = getSemesterMetrics(at('2026-09-15T01:00:00Z'), settings)
    expect(vacation.progress).toBe(100)
    expect(vacation.phase).toBe('vacation')
    expect(vacation.calendarDaysRemaining).toBe(0)
  })

  it('survives unusable date configuration', () => {
    const broken = getSemesterMetrics(
      at('2026-09-02T01:00:00Z'),
      settingsWith({ semesterStart: '2026-12-31', vacationDate: '2026-08-31' }),
    )
    expect(broken.isConfigured).toBe(false)
    expect(broken.progress).toBe(0)
  })
})
