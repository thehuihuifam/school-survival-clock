import { useMemo, useState } from 'react'
import { SolarIcon } from '../Icon'
import { formatDateKeyWithWeekday, isValidDateInput } from '../../lib/time'
import type { Holiday } from '../../types'

interface HolidayEditorProps {
  holidays: Holiday[]
  todayDateKey: string
  semesterStart: string
  vacationDate: string
  onChange: (next: Holiday[]) => void
}

/**
 * Korean holidays that always fall on the same solar date. Lunar holidays
 * (설날·추석·부처님오신날) and substitute holidays move every year, so they are
 * deliberately *not* guessed — the teacher adds those by hand.
 */
const FIXED_HOLIDAYS: Array<{ month: number; day: number; label: string }> = [
  { month: 1, day: 1, label: '신정' },
  { month: 3, day: 1, label: '삼일절' },
  { month: 5, day: 5, label: '어린이날' },
  { month: 6, day: 6, label: '현충일' },
  { month: 8, day: 15, label: '광복절' },
  { month: 10, day: 3, label: '개천절' },
  { month: 10, day: 9, label: '한글날' },
  { month: 12, day: 25, label: '성탄절' },
]

const pad = (value: number) => String(value).padStart(2, '0')

export function HolidayEditor({ holidays, todayDateKey, semesterStart, vacationDate, onChange }: HolidayEditorProps) {
  const [date, setDate] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sorted = useMemo(() => [...holidays].sort((left, right) => left.date.localeCompare(right.date)), [holidays])

  const semesterYears = useMemo(() => {
    const startYear = Number(semesterStart.slice(0, 4))
    const endYear = Number(vacationDate.slice(0, 4))
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) {
      return []
    }
    const years: number[] = []
    for (let year = startYear; year <= endYear && years.length < 3; year += 1) {
      years.push(year)
    }
    return years
  }, [semesterStart, vacationDate])

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
    const next = [...holidays, { date, label: label.trim().slice(0, 32) }]
      .sort((left, right) => left.date.localeCompare(right.date))
    // Keep the prop in sync through the parent's onChange (defined below).
    onChange(next)
    setDate('')
    setLabel('')
  }

  const removeHoliday = (target: string) => {
    onChange(holidays.filter((holiday) => holiday.date !== target))
  }

  const addFixedHolidays = () => {
    const existing = new Set(holidays.map((holiday) => holiday.date))
    const additions: Holiday[] = []

    for (const year of semesterYears) {
      for (const fixed of FIXED_HOLIDAYS) {
        const dateKey = `${year}-${pad(fixed.month)}-${pad(fixed.day)}`
        if (existing.has(dateKey)) {
          continue
        }
        existing.add(dateKey)
        additions.push({ date: dateKey, label: fixed.label })
      }
    }

    if (additions.length === 0) {
      setError('해당 기간의 고정 공휴일은 모두 등록되어 있습니다.')
      return
    }

    setError(null)
    onChange([...holidays, ...additions].sort((left, right) => left.date.localeCompare(right.date)))
  }

  return (
    <div className="holiday-editor">
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
            placeholder="예: 재량휴업일, 추석 연휴"
            onChange={(event) => { setLabel(event.target.value); setError(null) }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addHoliday() } }}
          />
        </div>
        <button type="button" className="ghost-button" onClick={addHoliday}>
          <SolarIcon name="calendar-add-bold" size={15} /> 휴일 추가
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={addFixedHolidays}
          disabled={semesterYears.length === 0}
          title="신정·삼일절·어린이날·현충일·광복절·개천절·한글날·성탄절을 학기 기간에 맞춰 한 번에 추가합니다"
        >
          <SolarIcon name="magic-wand-3-bold" size={15} /> 고정 공휴일 일괄 추가
        </button>
      </div>

      {error && (
        <p className="inline-warning" role="alert"><SolarIcon name="danger-circle-bold" size={14} /> {error}</p>
      )}

      {sorted.length === 0 ? (
        <p className="period-empty">
          <SolarIcon name="calendar-minimalistic-bold" size={16} />
          등록된 휴일이 없습니다. 재량휴업일, 체험학습일, 음력 명절 연휴를 추가하면 그날은 쉬는 날로 표시되고 배터리 계산에서도 빠집니다.
        </p>
      ) : (
        <ul className="holiday-list">
          {sorted.map((holiday) => {
            const isPast = holiday.date < todayDateKey
            return (
              <li className={`holiday-row ${isPast ? 'is-past' : ''}`} key={holiday.date}>
                <span className="holiday-date">
                  <SolarIcon name="calendar-mark-bold" size={14} />
                  {formatDateKeyWithWeekday(holiday.date)}
                </span>
                <span className="holiday-label">{holiday.label || '이름 없는 휴일'}</span>
                <span className="holiday-state">{isPast ? '지남' : holiday.date === todayDateKey ? '오늘' : '예정'}</span>
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
