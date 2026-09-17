/**
 * 내장 대한민국 공휴일 달력 (2025 ~ 2029).
 *
 * 설날·추석·부처님오신날은 음력이라 해마다 양력 날짜가 바뀌고, 대체공휴일은
 * 요일에 따라 생기거나 사라진다. 계산식으로 추정하면 틀리기 쉬우므로 관공서
 * 공휴일 기준으로 확정된 날짜를 그대로 싣는다.
 *
 * 수록 기준
 * - 학교가 실제로 쉬는 날만 넣는다. 근로자의 날(5/1)처럼 교사가 정상 근무하는
 *   날은 넣지 않는다.
 * - 전국 단위 선거일은 대부분의 학교가 투표소로 쓰여 휴업하므로 포함한다.
 * - 학교별 재량휴업일·체험학습일은 설정 → 쉬는 날에서 직접 등록한다.
 */

export interface BuiltinHoliday {
  /** `YYYY-MM-DD`, KST. */
  date: string
  label: string
}

/** 내장 데이터가 존재하는 첫 해. */
export const BUILTIN_HOLIDAY_FIRST_YEAR = 2025
/** 내장 데이터가 존재하는 마지막 해. */
export const BUILTIN_HOLIDAY_LAST_YEAR = 2029

const BUILTIN_HOLIDAYS_BY_YEAR: Record<number, BuiltinHoliday[]> = {
  2025: [
    { date: '2025-01-01', label: '신정' },
    { date: '2025-01-27', label: '설 연휴' },
    { date: '2025-01-28', label: '설 연휴' },
    { date: '2025-01-29', label: '설날' },
    { date: '2025-01-30', label: '설 연휴' },
    { date: '2025-03-01', label: '삼일절' },
    { date: '2025-03-03', label: '삼일절 대체공휴일' },
    { date: '2025-05-05', label: '어린이날 · 부처님오신날' },
    { date: '2025-05-06', label: '부처님오신날 대체공휴일' },
    { date: '2025-06-03', label: '대통령 선거일' },
    { date: '2025-06-06', label: '현충일' },
    { date: '2025-08-15', label: '광복절' },
    { date: '2025-10-03', label: '개천절' },
    { date: '2025-10-05', label: '추석 연휴' },
    { date: '2025-10-06', label: '추석' },
    { date: '2025-10-07', label: '추석 연휴' },
    { date: '2025-10-08', label: '추석 대체공휴일' },
    { date: '2025-10-09', label: '한글날' },
    { date: '2025-12-25', label: '성탄절' },
  ],
  2026: [
    { date: '2026-01-01', label: '신정' },
    { date: '2026-02-16', label: '설 연휴' },
    { date: '2026-02-17', label: '설날' },
    { date: '2026-02-18', label: '설 연휴' },
    { date: '2026-03-01', label: '삼일절' },
    { date: '2026-03-02', label: '삼일절 대체공휴일' },
    { date: '2026-05-05', label: '어린이날' },
    { date: '2026-05-24', label: '부처님오신날' },
    { date: '2026-05-25', label: '부처님오신날 대체공휴일' },
    { date: '2026-06-03', label: '지방선거일' },
    { date: '2026-06-06', label: '현충일' },
    { date: '2026-08-15', label: '광복절' },
    { date: '2026-08-17', label: '광복절 대체공휴일' },
    { date: '2026-09-24', label: '추석 연휴' },
    { date: '2026-09-25', label: '추석' },
    { date: '2026-09-26', label: '추석 연휴' },
    { date: '2026-10-03', label: '개천절' },
    { date: '2026-10-05', label: '개천절 대체공휴일' },
    { date: '2026-10-09', label: '한글날' },
    { date: '2026-12-25', label: '성탄절' },
  ],
  2027: [
    { date: '2027-01-01', label: '신정' },
    { date: '2027-02-06', label: '설 연휴' },
    { date: '2027-02-07', label: '설날' },
    { date: '2027-02-08', label: '설 연휴' },
    { date: '2027-02-09', label: '설날 대체공휴일' },
    { date: '2027-03-01', label: '삼일절' },
    { date: '2027-05-05', label: '어린이날' },
    { date: '2027-05-13', label: '부처님오신날' },
    { date: '2027-06-06', label: '현충일' },
    { date: '2027-08-15', label: '광복절' },
    { date: '2027-08-16', label: '광복절 대체공휴일' },
    { date: '2027-09-14', label: '추석 연휴' },
    { date: '2027-09-15', label: '추석' },
    { date: '2027-09-16', label: '추석 연휴' },
    { date: '2027-10-03', label: '개천절' },
    { date: '2027-10-04', label: '개천절 대체공휴일' },
    { date: '2027-10-09', label: '한글날' },
    { date: '2027-10-11', label: '한글날 대체공휴일' },
    { date: '2027-12-25', label: '성탄절' },
    { date: '2027-12-27', label: '성탄절 대체공휴일' },
  ],
  2028: [
    { date: '2028-01-01', label: '신정' },
    { date: '2028-01-26', label: '설 연휴' },
    { date: '2028-01-27', label: '설날' },
    { date: '2028-01-28', label: '설 연휴' },
    { date: '2028-03-01', label: '삼일절' },
    { date: '2028-04-12', label: '국회의원 선거일' },
    { date: '2028-05-02', label: '부처님오신날' },
    { date: '2028-05-05', label: '어린이날' },
    { date: '2028-06-06', label: '현충일' },
    { date: '2028-08-15', label: '광복절' },
    { date: '2028-10-02', label: '추석 연휴' },
    { date: '2028-10-03', label: '추석 · 개천절' },
    { date: '2028-10-04', label: '추석 연휴' },
    { date: '2028-10-05', label: '추석 대체공휴일' },
    { date: '2028-10-09', label: '한글날' },
    { date: '2028-12-25', label: '성탄절' },
  ],
  2029: [
    { date: '2029-01-01', label: '신정' },
    { date: '2029-02-12', label: '설 연휴' },
    { date: '2029-02-13', label: '설날' },
    { date: '2029-02-14', label: '설 연휴' },
    { date: '2029-03-01', label: '삼일절' },
    { date: '2029-05-05', label: '어린이날' },
    { date: '2029-05-07', label: '어린이날 대체공휴일' },
    { date: '2029-05-20', label: '부처님오신날' },
    { date: '2029-05-21', label: '부처님오신날 대체공휴일' },
    { date: '2029-06-06', label: '현충일' },
    { date: '2029-08-15', label: '광복절' },
    { date: '2029-09-21', label: '추석 연휴' },
    { date: '2029-09-22', label: '추석' },
    { date: '2029-09-23', label: '추석 연휴' },
    { date: '2029-09-24', label: '추석 대체공휴일' },
    { date: '2029-10-03', label: '개천절' },
    { date: '2029-10-09', label: '한글날' },
    { date: '2029-12-25', label: '성탄절' },
  ],
}

/** `YYYY-MM-DD` → 공휴일 이름. 한 번만 만들어 두고 계속 재사용한다. */
const BUILTIN_HOLIDAY_INDEX: Map<string, string> = new Map(
  Object.values(BUILTIN_HOLIDAYS_BY_YEAR)
    .flat()
    .map((holiday) => [holiday.date, holiday.label]),
)

/** 내장 달력에 등록된 공휴일이면 이름을, 아니면 `null`을 돌려준다. */
export function builtinHolidayLabel(dateKey: string): string | null {
  return BUILTIN_HOLIDAY_INDEX.get(dateKey) ?? null
}

/** 해당 연도의 내장 공휴일 목록(없는 해는 빈 배열). */
export function builtinHolidaysForYear(year: number): BuiltinHoliday[] {
  return BUILTIN_HOLIDAYS_BY_YEAR[year] ?? []
}

/** `[fromDateKey, toDateKey]` 구간의 내장 공휴일을 날짜순으로 반환한다. */
export function builtinHolidaysBetween(fromDateKey: string, toDateKey: string): BuiltinHoliday[] {
  if (fromDateKey > toDateKey) {
    return []
  }
  const startYear = Number(fromDateKey.slice(0, 4))
  const endYear = Number(toDateKey.slice(0, 4))
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    return []
  }

  const collected: BuiltinHoliday[] = []
  for (let year = startYear; year <= endYear; year += 1) {
    for (const holiday of builtinHolidaysForYear(year)) {
      if (holiday.date >= fromDateKey && holiday.date <= toDateKey) {
        collected.push(holiday)
      }
    }
  }
  return collected.sort((left, right) => left.date.localeCompare(right.date))
}

/** 이 날짜가 내장 달력에 공휴일로 들어 있는가? */
export function isCoveredByBuiltinCalendar(dateKey: string) {
  return builtinHolidayLabel(dateKey) !== null
}

/** 내장 달력이 이 연도를 담고 있는가(범위 밖이면 직접 등록해야 한다). */
export function isYearCoveredByBuiltinCalendar(year: number) {
  return (
    Number.isInteger(year) && year >= BUILTIN_HOLIDAY_FIRST_YEAR && year <= BUILTIN_HOLIDAY_LAST_YEAR
  )
}
