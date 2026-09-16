import { describe, expect, it } from 'vitest'
import {
  DAY_IN_SECONDS,
  formatDuration,
  formatHmFromSeconds,
  formatHumanDuration,
  formatMinutes,
  getKstTimeParts,
  isValidDateInput,
  isValidTimeInput,
  kstInstant,
  parseDateInput,
  parseTimeToSeconds,
  secondsUntilDateKey,
  shiftDateKey,
  weekdayIndexFromDateKey,
} from '../time'

describe('getKstTimeParts', () => {
  it('converts UTC instants to Korean wall-clock time', () => {
    const parts = getKstTimeParts(new Date('2026-09-17T00:30:15Z'))
    expect(parts.hour).toBe(9)
    expect(parts.minute).toBe(30)
    expect(parts.second).toBe(15)
    expect(parts.dateKey).toBe('2026-09-17')
    expect(parts.weekday).toBe('목요일')
    expect(parts.weekdayIndex).toBe(4)
  })

  it('rolls the date forward across the KST midnight boundary', () => {
    const justBefore = getKstTimeParts(new Date('2026-09-16T14:59:59Z'))
    const justAfter = getKstTimeParts(new Date('2026-09-16T15:00:00Z'))

    expect(justBefore.dateKey).toBe('2026-09-16')
    expect(justBefore.hour).toBe(23)
    expect(justAfter.dateKey).toBe('2026-09-17')
    expect(justAfter.hour).toBe(0)
    expect(justAfter.daySeconds).toBe(0)
  })

  it('exposes a consistent offset and round-trips the instant', () => {
    const parts = getKstTimeParts(new Date('2026-03-02T05:04:03Z'))
    expect(parts.offsetMs).toBe(9 * 60 * 60 * 1000)
    expect(kstInstant(parts, parts.dateKey, parts.daySeconds)).toBe(
      Math.floor(new Date('2026-03-02T05:04:03Z').getTime() / 1000) * 1000,
    )
  })
})

describe('time input validation', () => {
  it('accepts well-formed HH:MM values and normalises single digits', () => {
    expect(isValidTimeInput('09:05')).toBe(true)
    expect(isValidTimeInput('9:05')).toBe(true)
    expect(parseTimeToSeconds('9:05')).toBe(9 * 3600 + 5 * 60)
  })

  it('rejects impossible or malformed values with a safe fallback', () => {
    expect(isValidTimeInput('24:00')).toBe(false)
    expect(isValidTimeInput('12:60')).toBe(false)
    expect(isValidTimeInput('oops')).toBe(false)
    expect(parseTimeToSeconds('oops')).toBe(16 * 3600 + 30 * 60)
    expect(parseTimeToSeconds('')).toBe(16 * 3600 + 30 * 60)
  })

  it('validates calendar dates including impossible ones', () => {
    expect(isValidDateInput('2026-02-28')).toBe(true)
    expect(isValidDateInput('2026-02-30')).toBe(false)
    expect(isValidDateInput('2026-13-01')).toBe(false)
    expect(Number.isNaN(parseDateInput('2026-02-30'))).toBe(true)
  })
})

describe('formatting', () => {
  it('formats countdowns with padded units', () => {
    expect(formatDuration(0)).toBe('00:00:00')
    expect(formatDuration(3725)).toBe('01:02:05')
    expect(formatDuration(-5)).toBe('00:00:00')
    expect(formatHmFromSeconds(16 * 3600 + 30 * 60)).toBe('16:30')
  })

  it('produces conversational durations', () => {
    expect(formatHumanDuration(45)).toBe('45초')
    expect(formatHumanDuration(12 * 60)).toBe('12분')
    expect(formatHumanDuration(2 * 3600 + 5 * 60)).toBe('2시간 5분')
    expect(formatHumanDuration(3 * DAY_IN_SECONDS + 4 * 3600, 2)).toBe('3일 4시간')
    expect(formatMinutes(90 * 60)).toBe('1시간 30분')
  })
})

describe('date key helpers', () => {
  it('shifts date keys across month boundaries', () => {
    expect(shiftDateKey('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDateKey('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('knows the weekday of a date key', () => {
    expect(weekdayIndexFromDateKey('2026-09-17')).toBe(4) // 목요일
    expect(weekdayIndexFromDateKey('2026-09-19')).toBe(6) // 토요일
  })

  it('counts whole seconds until a KST midnight (negative when past)', () => {
    const parts = getKstTimeParts(new Date('2026-09-16T15:30:00Z')) // 00:30 KST
    expect(secondsUntilDateKey(parts, '2026-09-17')).toBe(-30 * 60)
    expect(secondsUntilDateKey(parts, '2026-09-18')).toBe(DAY_IN_SECONDS - 30 * 60)
  })
})
