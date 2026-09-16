import { Coffee, GraduationCap, Info, Utensils } from 'lucide-react'
import { getTimelineSlots } from '../lib/time'
import type { KstTimeParts, PeriodStatus } from '../types'

interface PeriodTrackerProps {
  now: KstTimeParts
  dismissalTime: string
  status: PeriodStatus
}

export function PeriodTracker({ now, dismissalTime, status }: PeriodTrackerProps) {
  const slots = getTimelineSlots(dismissalTime)
  const clockMinutes = now.hour * 60 + now.minute

  return (
    <section className="surface-card period-card">
      <div className="period-header">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot blue" /> CLASSROOM RADAR</p>
          <h2>현재 교시 안내 바</h2>
          <p className="card-subtitle">시간표 위에 마우스를 올리면 오늘의 리듬이 보여요.</p>
        </div>
        <div className={`period-now-badge ${status.isBreak ? 'is-break' : ''}`}>
          <span className="period-now-pulse" />
          <span>{status.label}</span>
          <strong>{status.isBeforeSchool ? '곧 시작' : status.isAfterSchool ? '수고하셨어요' : `${status.minutesRemaining}분 남음`}</strong>
        </div>
      </div>

      <div className="period-current-note">
        <div className="period-note-icon">
          {status.isBreak ? <Coffee size={18} /> : status.slotId === 'lunch' ? <Utensils size={18} /> : <GraduationCap size={18} />}
        </div>
        <div>
          <p className="period-note-title">
            {status.isBeforeSchool ? '수업 시작 전, 커피와 마음을 충전하세요.' : status.isAfterSchool ? '오늘의 교실 미션을 완료했습니다.' : status.isBreak ? '잠깐의 숨 고르기, 다음 라운드를 준비해요.' : `${status.label} 진행 중`}
          </p>
          <p className="period-note-detail">
            {status.isAfterSchool ? status.timeLabel : `${status.timeLabel} · ${status.isBreak ? '다음 일정' : status.slotId === 'lunch' ? '점심시간 종료' : '다음 쉬는 시간'}까지 ${status.minutesRemaining}분`}
          </p>
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
                  {slot.kind === 'break' ? <Coffee size={13} /> : slot.id === 'lunch' ? <Utensils size={13} /> : <span className="period-number">{slot.shortLabel}</span>}
                  <span>{slot.label}</span>
                </div>
                <span className="timeline-time">{slot.timeLabel}</span>
                {isActive && <span className="active-pill">NOW</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="period-legend"><Info size={14} /> 시간표 기준은 한국 표준시(KST)이며, 방과후/업무 시간은 설정한 퇴근 시각까지 표시됩니다.</div>
    </section>
  )
}
