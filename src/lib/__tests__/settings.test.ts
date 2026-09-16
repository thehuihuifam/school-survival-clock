import { describe, expect, it } from 'vitest'
import {
  cloneSettings,
  createDefaultSettings,
  normaliseDayOverrides,
  normalizeSettings,
  parseSettingsJson,
  serializeSettings,
} from '../settings'
import { getAutoSemesterWindow } from '../semesterWindow'
import { sanitizePeriods } from '../schedule'
import { TEST_TODAY_KEY } from './helpers'

const TODAY = TEST_TODAY_KEY
const defaults = () => createDefaultSettings(TODAY)

describe('normalizeSettings', () => {
  it('falls back to defaults for garbage input', () => {
    expect(normalizeSettings(null, TODAY)).toEqual(defaults())
    expect(normalizeSettings('nope', TODAY)).toEqual(cloneSettings(defaults()))
    expect(normalizeSettings({ dismissalTime: '99:99', vacationDate: 'yesterday' }, TODAY).dismissalTime).toBe('16:30')
  })

  it('reports the current schema version', () => {
    expect(defaults().version).toBe(3)
  })

  it('upgrades a v1 payload (theme instead of themeMode, no timetable)', () => {
    const upgraded = normalizeSettings({
      displayName: '전주 OO초 김선생님',
      dismissalTime: '15:40',
      semesterStart: '2026-03-02',
      vacationDate: '2026-07-24',
      theme: 'light',
    }, TODAY)

    expect(upgraded.displayName).toBe('전주 OO초 김선생님')
    expect(upgraded.dismissalTime).toBe('15:40')
    expect(upgraded.themeMode).toBe('light')
    expect(upgraded.timetables['1'].periods).toHaveLength(7)
    expect(upgraded.version).toBe(defaults().version)
    // Hand-picked dates must survive the migration untouched.
    expect(upgraded.semesterStart).toBe('2026-03-02')
    expect(upgraded.vacationDate).toBe('2026-07-24')
    expect(upgraded.semesterAuto).toBe(false)
  })

  it('switches untouched v2 defaults over to the automatic semester window', () => {
    const migrated = normalizeSettings({
      version: 2,
      displayName: '김선생님',
      dismissalTime: '16:30',
      // The exact pair of dates older builds shipped as their defaults.
      semesterStart: '2026-08-25',
      vacationDate: '2026-12-31',
    }, '2027-03-10')

    const window = getAutoSemesterWindow('2027-03-10')
    expect(migrated.semesterAuto).toBe(true)
    expect(migrated.semesterStart).toBe(window.startDate)
    expect(migrated.vacationDate).toBe(window.vacationDate)
    expect(window.startDate).toBe('2027-03-02')
    expect(window.vacationDate).toBe('2027-07-20')
  })

  it('keeps an explicit automatic window in sync with the given day', () => {
    const window = getAutoSemesterWindow('2027-08-20')
    const refreshed = normalizeSettings({
      version: 3,
      semesterAuto: true,
      semesterStart: '2027-03-02',
      vacationDate: '2027-07-20',
    }, '2027-08-20')

    expect(refreshed.semesterStart).toBe(window.startDate)
    expect(refreshed.vacationDate).toBe(window.vacationDate)
    expect(refreshed.vacationDate).toBe('2028-01-06')
  })

  it('normalises 예비종 settings and clamps out-of-range minutes', () => {
    expect(defaults().preAlertEnabled).toBe(true)
    expect(defaults().preAlertMinutes).toBe(3)
    expect(normalizeSettings({ preAlertMinutes: 0 }, TODAY).preAlertMinutes).toBe(1)
    expect(normalizeSettings({ preAlertMinutes: 99 }, TODAY).preAlertMinutes).toBe(15)
    expect(normalizeSettings({ preAlertMinutes: 'soon' }, TODAY).preAlertMinutes).toBe(3)
    expect(normalizeSettings({ preAlertEnabled: false }, TODAY).preAlertEnabled).toBe(false)
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
    const fixed = normalizeSettings({ semesterStart: '2026-12-01', vacationDate: '2026-03-01' }, TODAY)
    expect(fixed.vacationDate).toBe(getAutoSemesterWindow(TODAY).vacationDate)
    expect(fixed.semesterStart).toBe(getAutoSemesterWindow(TODAY).startDate)
  })

  it('dedupes holidays and keeps them sorted', () => {
    const sorted = normalizeSettings({
      holidays: [
        { date: '2026-10-09', label: '한글날' },
        { date: '2026-03-01', label: '삼일절' },
        { date: '2026-03-01', label: '삼일절 복제' },
        { date: 'not-a-date', label: '버려짐' },
      ],
    }, TODAY)

    expect(sorted.holidays.map((holiday) => holiday.date)).toEqual(['2026-03-01', '2026-10-09'])
  })

  it('keeps only usable one-day exceptions around today', () => {
    const overrides = normaliseDayOverrides({
      '2026-09-17': { kind: 'off', label: '재량휴업' },
      '2026-09-18': { kind: 'short', label: '시험', dismissalTime: '13:00' },
      '2026-09-01': { kind: 'off', label: '지난달' }, // stale → pruned
      '2027-09-17': { kind: 'off', label: '내년' }, // too far → pruned
      '2026-09-19': { kind: 'holiday', label: '알 수 없음' }, // bad kind → pruned
      '2026-09-20': { kind: 'short', label: '시각 없음' }, // no time → pruned
      'not-a-date': { kind: 'off', label: '형식 오류' },
    }, TODAY)

    expect(Object.keys(overrides)).toEqual(['2026-09-17', '2026-09-18'])
    expect(overrides['2026-09-17']).toEqual({ kind: 'off', label: '재량휴업', dismissalTime: '' })
    expect(overrides['2026-09-18'].dismissalTime).toBe('13:00')
  })
})

describe('export / import round trip', () => {
  it('serialises and parses back without loss', () => {
    const original = normalizeSettings({
      displayName: '백업 선생님',
      holidays: [{ date: '2026-10-09', label: '한글날' }],
      dayOverrides: { [TODAY]: { kind: 'short', label: '단축 수업', dismissalTime: '13:00' } },
    }, TODAY)
    const parsed = parseSettingsJson(serializeSettings(original), TODAY)

    expect(parsed.warnings).toEqual([])
    expect(parsed.settings).toEqual(original)
  })

  it('reports warnings for unreadable payloads', () => {
    expect(parseSettingsJson('{ broken', TODAY).warnings.length).toBeGreaterThan(0)
    expect(parseSettingsJson('[]', TODAY).warnings.length).toBeGreaterThan(0)
  })

  it('warns when stale one-day exceptions are dropped on import', () => {
    const raw = JSON.stringify({
      dayOverrides: { '2026-09-17': { kind: 'off', label: '재량휴업' }, '2025-03-02': { kind: 'off', label: '작년' } },
    })
    expect(parseSettingsJson(raw, TODAY).warnings).toContain('오늘 하루 예외는 오늘 기준 최근 항목만 유지했어요.')
  })
})
