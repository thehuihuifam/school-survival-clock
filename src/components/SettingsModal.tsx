import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { SolarIcon } from './Icon'
import { isScheduleConfigurationValid, isValidDateInput, isValidTimeInput } from '../lib/time'
import type { SchedulePeriod, UserSettings } from '../types'

interface SettingsModalProps {
  isOpen: boolean
  settings: UserSettings
  onClose: () => void
  onSave: (settings: UserSettings) => void
}

function splitHolidayDates(value: string) {
  return [...new Set(value.split(/[\s,]+/).map((date) => date.trim()).filter(Boolean))]
}

export function SettingsModal({ isOpen, settings, onClose, onSave }: SettingsModalProps) {
  const [draft, setDraft] = useState(settings)
  const [holidayText, setHolidayText] = useState(settings.holidayDates.join(', '))
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setDraft(settings)
      setHolidayText(settings.holidayDates.join(', '))
      setError('')
    }
  }, [isOpen, settings])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const updatePeriod = (index: number, key: 'start' | 'end', value: string) => {
    setDraft((current) => ({
      ...current,
      schedule: current.schedule.map((period, periodIndex) => periodIndex === index ? { ...period, [key]: value } : period),
    }))
    setError('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const holidayDates = splitHolidayDates(holidayText)

    if (!draft.semesterStart || !draft.vacationDate || draft.semesterStart >= draft.vacationDate) {
      setError('학기 시작일은 방학 시작일보다 앞선 날짜여야 합니다.')
      return
    }
    if (!isValidDateInput(draft.semesterStart) || !isValidDateInput(draft.vacationDate)) {
      setError('학기 날짜를 올바른 날짜로 입력해 주세요.')
      return
    }
    if (!isScheduleConfigurationValid(draft.schedule, draft.lunchStart, draft.lunchEnd, draft.dismissalTime)) {
      setError('시간표의 시작·종료 시간이 겹치지 않고, 퇴근 시각이 마지막 일정 뒤에 오도록 설정해 주세요.')
      return
    }
    if (holidayDates.some((date) => !isValidDateInput(date))) {
      setError('휴일은 YYYY-MM-DD 형식으로 입력해 주세요. 여러 날짜는 쉼표나 줄바꿈으로 구분합니다.')
      return
    }
    if (!isValidTimeInput(draft.dismissalTime)) {
      setError('퇴근 시각을 올바르게 입력해 주세요.')
      return
    }

    onSave({
      ...draft,
      displayName: draft.displayName.trim(),
      holidayDates,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={handleBackdropClick}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" aria-describedby="settings-description">
        <div className="modal-header">
          <div className="modal-title-lockup">
            <div className="section-icon settings-icon"><SolarIcon name="settings-bold" size={19} /></div>
            <div>
              <p className="eyebrow">PERSONAL CONTROL ROOM</p>
              <h2 id="settings-title">나의 교실 세팅</h2>
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="설정 닫기">
            <SolarIcon name="close-circle-bold" size={20} />
          </button>
        </div>

        <p className="modal-intro" id="settings-description">선생님에게 맞는 시간표와 이름을 설정해 보세요. 바뀐 내용은 이 브라우저에 안전하게 저장됩니다.</p>

        <form onSubmit={handleSubmit}>
          <div className="settings-field">
            <label htmlFor="teacher-name"><SolarIcon name="user-rounded-bold" size={16} /> 선생님 / 학교 이름</label>
            <input
              id="teacher-name"
              type="text"
              value={draft.displayName}
              onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
              placeholder="예: 전주 OO초등학교 김선생님"
              maxLength={42}
              autoFocus
            />
            <span className="field-hint">대시보드 첫 화면에 표시되는 이름입니다.</span>
          </div>

          <div className="settings-form-grid">
            <div className="settings-field">
              <label htmlFor="dismissal-time"><SolarIcon name="clock-circle-bold" size={16} /> 오늘 퇴근 시각</label>
              <input
                id="dismissal-time"
                type="time"
                value={draft.dismissalTime}
                onChange={(event) => setDraft({ ...draft, dismissalTime: event.target.value })}
                required
              />
              <span className="field-hint">퇴근 카운트다운과 방과후 시간에 반영됩니다.</span>
            </div>
            <div className="settings-field">
              <label htmlFor="semester-start"><SolarIcon name="calendar-date-bold" size={16} /> 학기 시작일</label>
              <input
                id="semester-start"
                type="date"
                value={draft.semesterStart}
                onChange={(event) => setDraft({ ...draft, semesterStart: event.target.value })}
                required
              />
              <span className="field-hint">생존 배터리의 0% 기준일입니다.</span>
            </div>
          </div>

          <div className="settings-field">
            <label htmlFor="vacation-date"><SolarIcon name="calendar-date-bold" size={16} /> 방학 시작일</label>
            <input
              id="vacation-date"
              type="date"
              value={draft.vacationDate}
              onChange={(event) => setDraft({ ...draft, vacationDate: event.target.value })}
              required
            />
            <span className="field-hint">방학 D-Day와 수업일 기준 충전율의 100% 기준일입니다.</span>
          </div>

          <div className="settings-section-heading">
            <div><SolarIcon name="notebook-bold" size={16} /><strong>나의 시간표</strong></div>
            <span>교시 사이의 쉬는 시간은 자동 계산돼요.</span>
          </div>
          <div className="schedule-editor" aria-label="교시별 시간 설정">
            {draft.schedule.map((period: SchedulePeriod, index: number) => (
              <div className="schedule-row" key={period.id}>
                <span className="schedule-row-label">{period.label}</span>
                <label>
                  <span className="sr-only">{period.label} 시작</span>
                  <input
                    type="time"
                    value={period.start}
                    onChange={(event) => updatePeriod(index, 'start', event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span className="sr-only">{period.label} 종료</span>
                  <input
                    type="time"
                    value={period.end}
                    onChange={(event) => updatePeriod(index, 'end', event.target.value)}
                    required
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="settings-form-grid schedule-special-times">
            <div className="settings-field">
              <label htmlFor="lunch-start"><SolarIcon name="plate-bold" size={16} /> 점심 시작</label>
              <input
                id="lunch-start"
                type="time"
                value={draft.lunchStart}
                onChange={(event) => setDraft({ ...draft, lunchStart: event.target.value })}
                required
              />
            </div>
            <div className="settings-field">
              <label htmlFor="lunch-end"><SolarIcon name="plate-bold" size={16} /> 점심 종료</label>
              <input
                id="lunch-end"
                type="time"
                value={draft.lunchEnd}
                onChange={(event) => setDraft({ ...draft, lunchEnd: event.target.value })}
                required
              />
            </div>
          </div>

          <div className="settings-field">
            <label htmlFor="holiday-dates"><SolarIcon name="calendar-mark-bold" size={16} /> 학교가 쉬는 날</label>
            <textarea
              id="holiday-dates"
              value={holidayText}
              onChange={(event) => setHolidayText(event.target.value)}
              placeholder="예: 2026-10-03, 2026-10-09"
              rows={2}
            />
            <span className="field-hint">주말 외 휴일을 YYYY-MM-DD로 입력하면 배터리와 교시 레이더에서 제외됩니다.</span>
          </div>

          {error && <p className="settings-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <button className="modal-secondary-button" type="button" onClick={onClose}>취소</button>
            <button className="modal-primary-button" type="submit">
              <SolarIcon name="diskette-bold" size={16} /> 변경사항 저장
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
