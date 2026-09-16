import type { CSSProperties } from 'react'
import { getTimelineSlots } from '../lib/time'
import { SolarIcon } from './Icon'
import type { KstTimeParts, PeriodStatus, SchedulePeriod } from '../types'

interface PeriodTrackerProps {
  now: KstTimeParts
  dismissalTime: string
  status: PeriodStatus
  schedule: SchedulePeriod[]
  lunchStart: string
  lunchEnd: string
}

const revealStyle = { '--index': 0 } as CSSProperties

export function PeriodTracker({ now, dismissalTime, status, schedule, lunchStart, lunchEnd }: PeriodTrackerProps) {
  const slots = getTimelineSlots(dismissalTime, schedule, lunchStart, lunchEnd)
  const clockMinutes = now.hour * 60 + now.minute
  const noteDetail = status.isOffDay || status.isAfterSchool || status.isBeforeSchool
    ? status.timeLabel
    : status.isBreak
      ? `${status.timeLabel} · 다음 일정`
      : `${status.timeLabel} · ${status.slotId === 'lunch' ? '점심시간 종료' : '다음 쉬는 시간'}까지 ${status.minutesRemaining}분`

  return (
    <section className={`surface-card period-card reveal reveal-on-scroll ${status.isOffDay ? 'period-card-off-day' : ''}`} style={revealStyle}>
      <div className="period-header">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot soft" /> CLASSROOM RADAR</p>
          <h2>현재 교시 안내 바</h2>
          <p className="card-subtitle">설정한 시간표를 기준으로 지금의 리듬을 보여줘요.</p>
        </div>
        <div className={`period-now-badge ${status.isBreak ? 'is-break' : ''} ${status.isOffDay ? 'is-off-day' : ''}`}>
          <span className="period-now-pulse" />
          <span>{status.label}</span>
          <strong>{status.isOffDay ? '회복 모드' : status.isBeforeSchool ? '곧 시작' : status.isAfterSchool ? '수고하셨어요' : `${status.minutesRemaining}분 남음`}</strong>
        </div>
      </div>

      <div className="period-current-note">
        <div className="period-note-icon">
          {status.isOffDay || status.isBreak
            ? <SolarIcon name="cup-hot-bold" size={18} />
            : status.slotId === 'lunch'
              ? <SolarIcon name="plate-bold" size={18} />
              : <SolarIcon name="notebook-bold" size={18} />}
        </div>
        <div>
          <p className="period-note-title">
            {status.isOffDay
              ? '오늘은 학교가 쉬는 날입니다. 마음껏 회복하세요.'
              : status.isBeforeSchool
                ? '수업 시작 전, 커피와 마음을 충전하세요.'
                : status.isAfterSchool
                  ? '오늘의 교실 미션을 완료했습니다.'
                  : status.isBreak
                    ? '잠깐의 숨 고르기, 다음 라운드를 준비해요.'
                    : `${status.label} 진행 중`}
          </p>
          <p className="period-note-detail">{noteDetail}</p>
        </div>
        <div className="period-clock-mini"><span>NOW</span>{String(Math.floor(clockMinutes / 60)).padStart(2, '0')}:{String(clockMinutes % 60).padStart(2, '0')}</div>
      </div>

      <div className="timeline-scroll" aria-label="오늘의 교시 시간표">
        <div className="timeline-track">
          {slots.map((slot) => {
            const isActive = status.slotId === slot.id
            const duration = Math.max(1, slot.endSeconds - slot.startSeconds)
            return (
              <div
                className={`timeline-slot ${slot.kind === 'break' ? 'timeline-break' : ''} ${isActive ? 'is-active' : ''}`}
                key={slot.id}
                style={{ flexGrow: duration }}
                title={`${slot.label} · ${slot.timeLabel}`}
              >
                <div className="timeline-slot-top">
                  {slot.kind === 'break'
                    ? <SolarIcon name="cup-hot-linear" size={13} />
                    : slot.id === 'lunch'
                      ? <SolarIcon name="plate-linear" size={13} />
                      : <span className="period-number">{slot.shortLabel}</span>}
                  <span>{slot.label}</span>
                </div>
                <span className="timeline-time">{slot.timeLabel}</span>
                {isActive && <span className="active-pill">NOW</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="period-legend">
        <SolarIcon name="info-circle-linear" size={14} />
        {status.isOffDay ? '주말과 등록한 휴일에는 카운트다운과 교시 알림이 잠시 쉬어갑니다.' : '시간표 기준은 한국 표준시(KST)이며, 방과후/업무 시간은 설정한 퇴근 시각까지 표시됩니다.'}
      </div>
    </section>
  )
}
