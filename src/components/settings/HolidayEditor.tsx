import { useMemo, useState } from 'react'
import { SolarIcon } from '../Icon'
import {
  BUILTIN_HOLIDAY_FIRST_YEAR,
  BUILTIN_HOLIDAY_LAST_YEAR,
  builtinHolidayLabel,
  builtinHolidaysBetween,
  isCoveredByBuiltinCalendar,
  isYearCoveredByBuiltinCalendar,
} from '../../lib/holidays'
import { formatDateKeyWithWeekday, isValidDateInput } from '../../lib/time'
import type { Holiday } from '../../types'

interface HolidayEditorProps {
  holidays: Holiday[]
  todayDateKey: string
  semesterStart: string
  vacationDate: string
  autoHolidays: boolean
  onChange: (next: Holiday[]) => void
  onAutoHolidaysChange: (next: boolean) => void
}

export function HolidayEditor({
  holidays,
  todayDateKey,
  semesterStart,
  vacationDate,
  autoHolidays,
  onChange,
  onAutoHolidaysChange,
}: HolidayEditorProps) {
  const [date, setDate] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...holidays].sort((left, right) => left.date.localeCompare(right.date)),
    [holidays],
  )

  /** 이번 학기에 걸쳐 있는, 내장 달력이 아는 공휴일. */
  const builtinInSemester = useMemo(
    () => (autoHolidays ? builtinHolidaysBetween(semesterStart, vacationDate) : []),
    [autoHolidays, semesterStart, vacationDate],
  )

  const semesterOutOfRange = useMemo(
    () => !isYearCoveredByBuiltinCalendar(Number(semesterStart.slice(0, 4))),
    [semesterStart],
  )

  const addHoliday = () => {
    if (!isValidDateInput(date)) {
      setError('날짜를 선택해 주세요.')
      return
    }
    if (holidays.some((holiday) => holiday.date === date)) {
      setError('이미 등록된 날짜입니다.')
      return
    }

    setError(null)
    const trimmed = label.trim().slice(0, 32)
    // 이름을 비워 두고 내장 달력이 아는 날짜라면 공식 명칭을 채워 준다.
    const resolved = trimmed || builtinHolidayLabel(date) || ''
    onChange(
      [...holidays, { date, label: resolved }].sort((left, right) => left.date.localeCompare(right.date)),
    )
    setDate('')
    setLabel('')
  }

  const removeHoliday = (target: string) => {
    onChange(holidays.filter((holiday) => holiday.date !== target))
  }

  return (
    <div className="holiday-editor">
      <div className="holiday-auto-row">
        <label className="holiday-auto-toggle" htmlFor="auto-holidays">
          <input
            id="auto-holidays"
            type="checkbox"
            checked={autoHolidays}
            onChange={(event) => onAutoHolidaysChange(event.target.checked)}
          />
          <span className="holiday-auto-copy">
            <strong>법정 공휴일 자동 적용</strong>
            <span>
              설날·추석·대체공휴일까지 {BUILTIN_HOLIDAY_FIRST_YEAR}~{BUILTIN_HOLIDAY_LAST_YEAR}년 달력이 들어 있어요.
              직접 등록한 날짜가 항상 우선합니다.
            </span>
          </span>
        </label>
        {autoHolidays && !semesterOutOfRange && (
          <span className="holiday-auto-count">이번 학기 {builtinInSemester.length}일</span>
        )}
      </div>

      {autoHolidays && semesterOutOfRange && (
        <p className="inline-warning" role="status">
          <SolarIcon name="danger-circle-bold" size={14} />
          내장 달력은 {BUILTIN_HOLIDAY_FIRST_YEAR}~{BUILTIN_HOLIDAY_LAST_YEAR}년만 담고 있어요. 그 밖의 해는 직접 등록해 주세요.
        </p>
      )}

      {autoHolidays && builtinInSemester.length > 0 && (
        <ul className="holiday-auto-list">
          {builtinInSemester.map((holiday) => (
            <li key={holiday.date} className={holiday.date < todayDateKey ? 'is-past' : undefined}>
              <span className="holiday-auto-date">{formatDateKeyWithWeekday(holiday.date)}</span>
              <span className="holiday-auto-label">{holiday.label}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="holiday-add-row">
        <div className="holiday-field holiday-field-date">
          <label htmlFor="holiday-date" className="sr-only">휴일 날짜</label>
          <input
            id="holiday-date"
            type="date"
            value={date}
            onChange={(event) => { setDate(event.target.value); setError(null) }}
          />
        </div>
        <div className="holiday-field holiday-field-label">
          <label htmlFor="holiday-label" className="sr-only">휴일 이름</label>
          <input
            id="holiday-label"
            type="text"
            value={label}
            maxLength={32}
            placeholder="예: 재량휴업일, 체험학습"
            onChange={(event) => { setLabel(event.target.value); setError(null) }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addHoliday() } }}
          />
        </div>
        <button type="button" className="ghost-button" onClick={addHoliday}>
          <SolarIcon name="calendar-add-bold" size={15} /> 휴일 추가
        </button>
      </div>

      {error && (
        <p className="inline-warning" role="alert"><SolarIcon name="danger-circle-bold" size={14} /> {error}</p>
      )}

      {sorted.length === 0 ? (
        <p className="period-empty">
          <SolarIcon name="calendar-minimalistic-bold" size={16} />
          우리 학교만의 재량휴업일·체험학습일을 추가해 보세요. 그날은 쉬는 날로 표시되고 배터리 계산에서도 빠집니다.
        </p>
      ) : (
        <ul className="holiday-list">
          {sorted.map((holiday) => {
            const isPast = holiday.date < todayDateKey
            const overridesBuiltin = autoHolidays && isCoveredByBuiltinCalendar(holiday.date)
            return (
              <li className={`holiday-row ${isPast ? 'is-past' : ''}`} key={holiday.date}>
                <span className="holiday-date">
                  <SolarIcon name="calendar-mark-bold" size={14} />
                  {formatDateKeyWithWeekday(holiday.date)}
                </span>
                <span className="holiday-label">
                  {holiday.label || '이름 없는 휴일'}
                  {overridesBuiltin && <em className="holiday-note">내장 달력 대체</em>}
                </span>
                <span className="holiday-state">
                  {isPast ? '지남' : holiday.date === todayDateKey ? '오늘' : '예정'}
                </span>
                <button
                  type="button"
                  className="icon-button is-danger"
                  onClick={() => removeHoliday(holiday.date)}
                  aria-label={`${holiday.label || holiday.date} 삭제`}
                  title="휴일 삭제"
                >
                  <SolarIcon name="trash-bin-trash-bold" size={15} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
