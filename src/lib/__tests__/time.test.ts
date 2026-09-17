import { describe, expect, it } from 'vitest'
import {
  DAY_IN_SECONDS,
  formatDateKeyShort,
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
  endsWithConsonant,
  withParticle,
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

  it('is the single HH:MM clock formatter for the whole app', () => {
    // `schedule.ts` (slot time labels, dismissal label) and `copy.ts` (hero
    // helper, bar labels) used to carry private copies of this. They now share
    // this one, so its edge behaviour is the whole app's contract.
    expect(formatHmFromSeconds(0)).toBe('00:00')
    expect(formatHmFromSeconds(59)).toBe('00:00')
    expect(formatHmFromSeconds(8 * 3600 + 40 * 60)).toBe('08:40')
    expect(formatHmFromSeconds(23 * 3600 + 59 * 60)).toBe('23:59')
    // Spans past midnight are printed as-is rather than wrapped, which is what
    // the duty-tail label relies on.
    expect(formatHmFromSeconds(25 * 3600)).toBe('25:00')
    expect(formatHmFromSeconds(-1)).toBe('00:00')
    expect(formatHmFromSeconds(900.9)).toBe('00:15')
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

  it('shortens a date key and echoes malformed input untouched', () => {
    expect(formatDateKeyShort('2026-09-17')).toBe('09.17')
    expect(formatDateKeyShort('2026-01-06')).toBe('01.06')
    // The removed `copy.ts` copy mangled anything it was handed; the shared
    // helper validates first, so a bad date never reaches the UI as `.date`.
    expect(formatDateKeyShort('not-a-date')).toBe('not-a-date')
    expect(formatDateKeyShort('2026-02-30')).toBe('2026-02-30')
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

describe('withParticle (조사)', () => {
  it('받침이 있는 낱말에는 자음용 조사를 붙인다', () => {
    expect(withParticle('추석', '으로', '로')).toBe('추석으로')
    expect(withParticle('신정', '으로', '로')).toBe('신정으로')
    expect(withParticle('삼일절', '으로', '로')).toBe('삼일절로')
  })

  it('ㄹ 받침은 으로가 아니라 로를 쓴다', () => {
    expect(withParticle('설날', '으로', '로')).toBe('설날로')
    expect(withParticle('개교기념일', '으로', '로')).toBe('개교기념일로')
    expect(withParticle('어린이날', '으로', '로')).toBe('어린이날로')
    // 다른 조사 짝에는 ㄹ 예외가 없다.
    expect(withParticle('설날', '은', '는')).toBe('설날은')
  })

  it('받침이 없는 낱말에는 모음용 조사를 붙인다', () => {
    expect(withParticle('연수', '으로', '로')).toBe('연수로')
    expect(withParticle('휴가', '으로', '로')).toBe('휴가로')
  })

  it('와/과도 올바르게 고른다', () => {
    expect(withParticle('점심', '과', '와')).toBe('점심과')
    expect(withParticle('체육', '과', '와')).toBe('체육과')
    expect(withParticle('국어', '과', '와')).toBe('국어와')
  })

  it('숫자로 끝나면 읽는 소리를 기준으로 고른다', () => {
    expect(withParticle('1교시', '과', '와')).toBe('1교시와')
    expect(withParticle('3', '으로', '로')).toBe('3으로')
    expect(withParticle('2', '으로', '로')).toBe('2로')
  })

  it('판단할 수 없으면 두 형태를 함께 보여 준다', () => {
    expect(withParticle('STEAM', '과', '와')).toBe('STEAM과(와)')
    expect(endsWithConsonant('')).toBeNull()
  })

  it('앞뒤 공백은 정리한다', () => {
    expect(withParticle('  추석  ', '으로', '로')).toBe('추석으로')
  })
})
