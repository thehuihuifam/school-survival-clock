import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { SolarIcon } from './Icon'
import type { UserSettings } from '../types'

interface SettingsModalProps {
  isOpen: boolean
  settings: UserSettings
  onClose: () => void
  onSave: (settings: UserSettings) => void
}

export function SettingsModal({ isOpen, settings, onClose, onSave }: SettingsModalProps) {
  const [draft, setDraft] = useState(settings)

  useEffect(() => {
    if (isOpen) {
      setDraft(settings)
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave(draft)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={handleBackdropClick}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
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

        <p className="modal-intro">선생님에게 맞는 시간표와 이름을 설정해 보세요. 바뀐 내용은 이 브라우저에 안전하게 저장됩니다.</p>

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
            <span className="field-hint">방학 D-Day와 충전율의 100% 기준일입니다.</span>
          </div>

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
