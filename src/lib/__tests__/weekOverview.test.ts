import { describe, expect, it } from 'vitest'
import { getWeekOverview } from '../weekOverview'
import { at, settingsWith } from './helpers'

/** 2026-09-17 목요일 10:00 KST. */
const THURSDAY = at('2026-09-17T01:00:00Z')

function overviewAt(iso: string, settings = settingsWith({})) {
  return getWeekOverview(at(iso), settings)
}

describe('getWeekOverview', () => {
  it('월요일부터 일요일까지 7일을 돌려준다', () => {
    const overview = getWeekOverview(THURSDAY, settingsWith({}))

    expect(overview.days).toHaveLength(7)
    expect(overview.days.map((day) => day.weekdayLabel)).toEqual(['월', '화', '수', '목', '금', '토', '일'])
    expect(overview.days[0].dateKey).toBe('2026-09-14')
    expect(overview.days[6].dateKey).toBe('2026-09-20')
  })

  it('일요일에 열어도 같은 주(직전 월요일 시작)를 보여 준다', () => {
    // 2026-09-20 일요일. 주가 9/14 월요일에서 시작해야 한다.
    const overview = overviewAt('2026-09-20T01:00:00Z')

    expect(overview.days[0].dateKey).toBe('2026-09-14')
    expect(overview.days[6].dateKey).toBe('2026-09-20')
    expect(overview.days[6].isToday).toBe(true)
  })

  it('월요일에 열면 그날이 첫 칸이다', () => {
    const overview = overviewAt('2026-09-14T01:00:00Z')

    expect(overview.days[0].dateKey).toBe('2026-09-14')
    expect(overview.days[0].isToday).toBe(true)
    expect(overview.days[0].isPast).toBe(false)
  })

  it('오늘과 지난 날을 구분한다', () => {
    const overview = getWeekOverview(THURSDAY, settingsWith({}))

    expect(overview.days.filter((day) => day.isToday)).toHaveLength(1)
    expect(overview.days.find((day) => day.isToday)?.dateKey).toBe('2026-09-17')
    expect(overview.days.filter((day) => day.isPast).map((day) => day.weekdayLabel)).toEqual([
      '월',
      '화',
      '수',
    ])
  })

  it('수업일과 주말을 나눠 센다', () => {
    const overview = getWeekOverview(THURSDAY, settingsWith({}))

    expect(overview.schoolDayCount).toBe(5)
    // 오늘(목)과 금요일이 남았다.
    expect(overview.remainingSchoolDayCount).toBe(2)
    expect(overview.days[5].state).toBe('weekend')
    expect(overview.days[6].state).toBe('weekend')
    expect(overview.days[5].classCount).toBe(0)
  })

  it('수업 시간이 가장 긴 날을 찾아 준다', () => {
    const overview = getWeekOverview(THURSDAY, settingsWith({}))

    // 월~목은 6교시, 금요일은 단축 시간표이므로 월요일이 최다(동률 중 첫 날).
    expect(overview.heaviestDateKey).toBe('2026-09-14')
    expect(overview.totalClassSeconds).toBeGreaterThan(0)
  })

  it('내장 공휴일이 낀 주는 그날을 쉬는 날로 표시한다', () => {
    // 2026-09-24~26 추석 연휴.
    const overview = overviewAt('2026-09-24T01:00:00Z')
    const thursday = overview.days[3]
    const friday = overview.days[4]

    expect(thursday.state).toBe('holiday')
    expect(thursday.note).toContain('추석')
    expect(thursday.classCount).toBe(0)
    expect(friday.state).toBe('holiday')
    // 월~수만 수업일로 남는다.
    expect(overview.schoolDayCount).toBe(3)
  })

  it('하루 예외(휴업)를 반영한다', () => {
    const settings = settingsWith({
      dayOverrides: { '2026-09-18': { kind: 'off', label: '재량휴업일', dismissalTime: '' } },
    })
    const overview = getWeekOverview(THURSDAY, settings)

    const friday = overview.days[4]
    expect(friday.state).toBe('override')
    expect(friday.note).toBe('재량휴업일')
    expect(overview.schoolDayCount).toBe(4)
    expect(overview.remainingSchoolDayCount).toBe(1)
  })

  it('단축 수업일에는 하교 시각을 알려 준다', () => {
    const settings = settingsWith({
      dayOverrides: { '2026-09-18': { kind: 'short', label: '단축', dismissalTime: '13:00' } },
    })
    const overview = getWeekOverview(THURSDAY, settings)

    const friday = overview.days[4]
    expect(friday.state).toBe('school')
    expect(friday.note).toBe('단축 13:00')
    expect(friday.spanLabel).toContain('~13:00')
  })

  it('방학 중에는 모든 날이 방학으로 표시된다', () => {
    const overview = overviewAt('2027-01-13T01:00:00Z') // 겨울방학

    expect(overview.schoolDayCount).toBe(0)
    expect(overview.remainingSchoolDayCount).toBe(0)
    expect(overview.heaviestDateKey).toBeNull()
    expect(overview.days.filter((day) => day.state === 'vacation').length).toBeGreaterThan(0)
  })

  it('수업일에는 하루 범위 라벨을 채운다', () => {
    const overview = getWeekOverview(THURSDAY, settingsWith({}))

    expect(overview.days[0].spanLabel).toBe('09:00~16:30')
    expect(overview.days[5].spanLabel).toBeNull()
  })
})
