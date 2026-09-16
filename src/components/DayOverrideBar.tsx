import { useEffect, useState } from 'react'
import { SolarIcon } from './Icon'
import { isValidTimeInput } from '../lib/time'
import type { DayOverride } from '../types'

interface DayOverrideBarProps {
  /** Today's KST date key — the exception is stored per date. */
  dateKey: string
  /** The exception currently registered for today, if any. */
  override: DayOverride | null
  /** The teacher's regular dismissal time, used as the starting point. */
  dismissalTime: string
  onChange: (override: DayOverride | null) => void
}

const OFF_OVERRIDE: DayOverride = { kind: 'off', label: '오늘 휴업', dismissalTime: '' }

/**
 * "오늘 하루만" quick control.
 *
 * Real school days are not always the ones in the timetable: a surprise 재량휴업
 * day, a field trip, an exam-day short schedule. This bar rewrites *today only*
 * — the weekly timetable and every other date stay untouched, and the exception
 * stops applying by itself once the KST date advances.
 */
export function DayOverrideBar({ dateKey, override, dismissalTime, onChange }: DayOverrideBarProps) {
  const [shortTime, setShortTime] = useState(() => override?.kind === 'short' ? override.dismissalTime : dismissalTime)

  // Follow the source of truth: a new day, a settings edit or a synced change
  // from another tab all reset the picker to the effective dismissal time.
  useEffect(() => {
    if (override?.kind === 'short') {
      setShortTime(override.dismissalTime)
      return
    }
    setShortTime(dismissalTime)
  }, [dateKey, dismissalTime, override?.kind, override?.dismissalTime])

  const isOff = override?.kind === 'off'
  const isShort = override?.kind === 'short'

  const activateShort = (value: string) => {
    if (!isValidTimeInput(value)) {
      return
    }
    const next: DayOverride = { kind: 'short', label: '단축 수업', dismissalTime: value }
    if (override?.kind === 'short' && override.dismissalTime === value) {
      return
    }
    onChange(next)
  }

  return (
    <div className="override-bar">
      <p className="override-label">
        <SolarIcon name="tuning-2-bold" size={14} />
        <span>오늘 하루만</span>
      </p>

      <div className="override-chips" role="group" aria-label="오늘 하루 예외 설정">
        <button
          type="button"
          className={`override-chip ${override === null ? 'is-active' : ''}`}
          aria-pressed={override === null}
          onClick={() => onChange(null)}
        >
          기본 시간표
        </button>

        <button
          type="button"
          className={`override-chip ${isOff ? 'is-active' : ''}`}
          aria-pressed={isOff}
          onClick={() => onChange(isOff ? null : OFF_OVERRIDE)}
        >
          <SolarIcon name="moon-sleep-bold" size={13} />
          오늘 휴업
        </button>

        <span className={`override-chip override-time ${isShort ? 'is-active' : ''}`}>
          <button
            type="button"
            className="override-time-button"
            aria-pressed={isShort}
            onClick={() => activateShort(shortTime)}
          >
            <SolarIcon name="stopwatch-bold" size={13} />
            단축 하교
          </button>
          <input
            type="time"
            value={shortTime}
            aria-label="오늘 단축 하교 시각"
            onChange={(event) => {
              setShortTime(event.target.value)
              activateShort(event.target.value)
            }}
          />
        </span>
      </div>

      <p className="override-note">
        {override
          ? '오늘만 적용됩니다 · 내일은 원래 시간표로 돌아가요'
          : '휴업·단축 수업이 있는 날, 한 번만 눌러 주세요'}
      </p>
    </div>
  )
}
