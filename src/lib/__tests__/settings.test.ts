import { describe, expect, it } from 'vitest'
import { cloneSettings, normalizeSettings, parseSettingsJson, serializeSettings } from '../settings'
import { sanitizePeriods } from '../schedule'
import { DEFAULT_SETTINGS } from '../../types'

describe('normalizeSettings', () => {
  it('falls back to defaults for garbage input', () => {
    expect(normalizeSettings(null)).toEqual(cloneSettings(DEFAULT_SETTINGS))
    expect(normalizeSettings('nope')).toEqual(cloneSettings(DEFAULT_SETTINGS))
    expect(normalizeSettings({ dismissalTime: '99:99', vacationDate: 'yesterday' }).dismissalTime).toBe('16:30')
  })

  it('upgrades a v1 payload (theme instead of themeMode, no timetable)', () => {
    const upgraded = normalizeSettings({
      displayName: '전주 OO초 김선생님',
      dismissalTime: '15:40',
      semesterStart: '2026-03-02',
      vacationDate: '2026-07-24',
      theme: 'light',
    })

    expect(upgraded.displayName).toBe('전주 OO초 김선생님')
    expect(upgraded.dismissalTime).toBe('15:40')
    expect(upgraded.themeMode).toBe('light')
    expect(upgraded.timetables['1'].periods).toHaveLength(7)
    expect(upgraded.version).toBe(DEFAULT_SETTINGS.version)
  })

  it('repairs broken timetable rows instead of crashing', () => {
    const repaired = normalizeSettings({
      timetables: {
        1: {
          enabled: true,
          periods: [
            { id: 'a', label: '1교시', kind: 'class', start: '09:00', end: '09:40' },
            { id: 'b', label: '', kind: 'weird', start: '10:00', end: '09:00' },
            { id: 'c', label: '점심', kind: 'lunch', start: '12:20', end: '13:20' },
          ],
        },
      },
    })

    const monday = repaired.timetables['1']
    // Rows survive (no silent data loss) but get repaired labels/kinds…
    expect(monday.periods).toHaveLength(3)
    expect(monday.periods[1].label).toBe('2교시')
    expect(monday.periods[1].kind).toBe('class')
    // …while the schedule engine refuses to render the inverted row.
    expect(sanitizePeriods(monday.periods).map((period) => period.id)).toEqual(['a', 'c'])
    // Other weekdays keep the default timetable.
    expect(repaired.timetables['2'].periods.length).toBeGreaterThan(0)
  })

  it('rejects an inverted semester range', () => {
    const fixed = normalizeSettings({ semesterStart: '2026-12-01', vacationDate: '2026-03-01' })
    expect(fixed.vacationDate).toBe(DEFAULT_SETTINGS.vacationDate)
  })

  it('dedupes holidays and keeps them sorted', () => {
    const sorted = normalizeSettings({
      holidays: [
        { date: '2026-10-09', label: '한글날' },
        { date: '2026-03-01', label: '삼일절' },
        { date: '2026-03-01', label: '삼일절 복제' },
        { date: 'not-a-date', label: '버려짐' },
      ],
    })

    expect(sorted.holidays.map((holiday) => holiday.date)).toEqual(['2026-03-01', '2026-10-09'])
  })
})

describe('export / import round trip', () => {
  it('serialises and parses back without loss', () => {
    const original = normalizeSettings({ displayName: '백업 선생님', holidays: [{ date: '2026-10-09', label: '한글날' }] })
    const parsed = parseSettingsJson(serializeSettings(original))

    expect(parsed.warnings).toEqual([])
    expect(parsed.settings).toEqual(original)
  })

  it('reports warnings for unreadable payloads', () => {
    expect(parseSettingsJson('{ broken').warnings.length).toBeGreaterThan(0)
    expect(parseSettingsJson('[]').warnings.length).toBeGreaterThan(0)
  })
})
