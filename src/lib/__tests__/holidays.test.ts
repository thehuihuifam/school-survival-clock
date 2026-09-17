import { describe, expect, it } from 'vitest'
import {
  BUILTIN_HOLIDAY_FIRST_YEAR,
  BUILTIN_HOLIDAY_LAST_YEAR,
  builtinHolidayLabel,
  builtinHolidaysBetween,
  builtinHolidaysForYear,
  isCoveredByBuiltinCalendar,
} from '../holidays'
import { isHolidayDate } from '../schedule'
import { settingsWith } from './helpers'

describe('내장 공휴일 달력', () => {
  it('해마다 같은 날인 국경일을 알고 있다', () => {
    expect(builtinHolidayLabel('2026-01-01')).toBe('신정')
    expect(builtinHolidayLabel('2026-03-01')).toBe('삼일절')
    expect(builtinHolidayLabel('2026-06-06')).toBe('현충일')
    expect(builtinHolidayLabel('2026-08-15')).toBe('광복절')
    expect(builtinHolidayLabel('2026-12-25')).toBe('성탄절')
  })

  it('해마다 날짜가 바뀌는 음력 명절을 담고 있다', () => {
    // 설날 연휴 3일.
    expect(builtinHolidayLabel('2026-02-16')).toMatch(/설/)
    expect(builtinHolidayLabel('2026-02-17')).toBe('설날')
    expect(builtinHolidayLabel('2026-02-18')).toMatch(/설/)
    // 추석 연휴 3일.
    expect(builtinHolidayLabel('2026-09-24')).toContain('추석')
    expect(builtinHolidayLabel('2026-09-25')).toBe('추석')
    expect(builtinHolidayLabel('2026-09-26')).toContain('추석')
    // 부처님오신날도 음력이라 매년 옮겨 다닌다.
    expect(builtinHolidayLabel('2026-05-24')).toBe('부처님오신날')
    expect(builtinHolidayLabel('2027-05-13')).toBe('부처님오신날')
  })

  it('대체공휴일을 별도 항목으로 담고 있다', () => {
    // 2026-10-03 개천절이 토요일 → 10-05 월요일이 대체공휴일.
    expect(builtinHolidayLabel('2026-10-05')).toContain('대체')
    // 2026-05-24 부처님오신날이 일요일 → 05-25 대체.
    expect(builtinHolidayLabel('2026-05-25')).toContain('대체')
    // 2027-12-25 성탄절이 토요일 → 12-27 대체.
    expect(builtinHolidayLabel('2027-12-27')).toContain('대체')
  })

  it('교사가 출근하는 날은 공휴일로 넣지 않는다', () => {
    // 근로자의 날과 제헌절은 공무원·교사에게 정상 근무일이다.
    expect(builtinHolidayLabel('2026-05-01')).toBeNull()
    expect(builtinHolidayLabel('2026-07-17')).toBeNull()
  })

  it('평범한 평일에는 아무것도 반환하지 않는다', () => {
    expect(builtinHolidayLabel('2026-09-17')).toBeNull()
    expect(isCoveredByBuiltinCalendar('2026-09-17')).toBe(false)
    expect(isCoveredByBuiltinCalendar('2026-09-25')).toBe(true)
  })

  it('달력에 없는 연도는 빈 값을 돌려준다', () => {
    expect(builtinHolidayLabel('2015-01-01')).toBeNull()
    expect(builtinHolidaysForYear(BUILTIN_HOLIDAY_FIRST_YEAR - 1)).toEqual([])
    expect(builtinHolidaysForYear(BUILTIN_HOLIDAY_LAST_YEAR + 1)).toEqual([])
  })

  it('모든 수록 연도가 날짜순으로 정렬된 목록을 갖는다', () => {
    for (let year = BUILTIN_HOLIDAY_FIRST_YEAR; year <= BUILTIN_HOLIDAY_LAST_YEAR; year += 1) {
      const holidays = builtinHolidaysForYear(year)
      expect(holidays.length).toBeGreaterThan(10)

      const dates = holidays.map((holiday) => holiday.date)
      expect(dates).toEqual([...dates].sort((left, right) => left.localeCompare(right)))
      // 같은 날짜가 두 번 들어가면 안 된다.
      expect(new Set(dates).size).toBe(dates.length)
      // 모든 항목이 그 해에 속하고 라벨이 비어 있지 않다.
      for (const holiday of holidays) {
        expect(holiday.date.startsWith(`${year}-`)).toBe(true)
        expect(holiday.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('기간으로 잘라 올 수 있다', () => {
    const range = builtinHolidaysBetween('2026-09-01', '2026-10-31')
    const dates = range.map((holiday) => holiday.date)

    expect(dates).toContain('2026-09-24')
    expect(dates).toContain('2026-10-03')
    expect(dates).toContain('2026-10-09')
    expect(dates).not.toContain('2026-08-15')
    expect(dates).not.toContain('2026-12-25')
  })

  it('연도 경계를 넘는 기간도 처리한다', () => {
    // 2학기는 해를 넘긴다 (8월 → 이듬해 1월).
    const range = builtinHolidaysBetween('2026-08-18', '2027-01-06')
    const dates = range.map((holiday) => holiday.date)

    expect(dates).toContain('2026-12-25')
    expect(dates).toContain('2027-01-01')
    expect(dates).not.toContain('2027-03-01')
  })

  it('시작일이 종료일보다 늦으면 빈 배열이다', () => {
    expect(builtinHolidaysBetween('2026-10-01', '2026-09-01')).toEqual([])
  })
})

describe('isHolidayDate 와의 연결', () => {
  it('autoHolidays가 켜져 있으면 내장 공휴일을 쉬는 날로 본다', () => {
    const settings = settingsWith({ autoHolidays: true })
    expect(isHolidayDate(settings, '2026-09-25')?.label).toContain('추석')
  })

  it('autoHolidays를 끄면 직접 등록한 날만 남는다', () => {
    const settings = settingsWith({ autoHolidays: false })
    expect(isHolidayDate(settings, '2026-09-25')).toBeNull()
  })

  it('직접 등록한 휴일이 내장 달력보다 우선한다', () => {
    const settings = settingsWith({
      autoHolidays: true,
      holidays: [{ date: '2026-09-25', label: '우리 학교 재량휴업' }],
    })
    expect(isHolidayDate(settings, '2026-09-25')?.label).toBe('우리 학교 재량휴업')
  })
})
