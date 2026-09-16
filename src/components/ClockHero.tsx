import type { CSSProperties } from 'react'
import { formatDuration, formatKstDate, formatKstTime } from '../lib/time'
import { SolarIcon } from './Icon'
import type { KstTimeParts } from '../types'

interface ClockHeroProps {
  now: KstTimeParts
  displayName: string
  dismissalTime: string
  countdownSeconds: number
}

const revealStyle = { '--index': 2 } as CSSProperties

export function ClockHero({
  now,
  displayName,
  dismissalTime,
  countdownSeconds,
}: ClockHeroProps) {
  const hasDismissed = countdownSeconds === 0 &&
    (now.hour * 60 + now.minute >= Number(dismissalTime.split(':')[0]) * 60 + Number(dismissalTime.split(':')[1]))

  return (
    <section className="surface-card clock-card reveal" style={revealStyle}>
      <div className="card-orb orb-accent" />
      <div className="card-orb orb-deep" />
      <div className="card-heading-row">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> LIVE CLOCK · ASIA/SEOUL</p>
          <p className="card-subtitle">오늘의 교실 레이더</p>
        </div>
        <div className="timezone-badge"><SolarIcon name="point-on-map-bold" size={13} /> KST</div>
      </div>

      <div className="clock-display" aria-label={`현재 시각 ${formatKstTime(now)}`}>
        <span className="clock-time">{formatKstTime(now)}</span>
        <span className="clock-seconds-label">NOW</span>
      </div>
      <div className="date-line">
        <SolarIcon name="calendar-bold" size={16} />
        <span>{formatKstDate(now)}</span>
      </div>

      <div className={`countdown-panel ${hasDismissed ? 'countdown-complete' : ''}`}>
        <div className="countdown-copy">
          <div className="countdown-icon">
            {hasDismissed
              ? <SolarIcon name="check-circle-bold" size={18} />
              : <SolarIcon name="alarm-bold" size={18} />}
          </div>
          <div>
            <p className="countdown-label">오늘 퇴근(하교)까지 남은 시간</p>
            <p className="countdown-helper">
              {hasDismissed ? '오늘도 무사히 미션 클리어!' : `정시 퇴근 목표 · ${dismissalTime}`}
            </p>
          </div>
        </div>
        <strong className="countdown-value">{formatDuration(countdownSeconds)}</strong>
      </div>

      <div className="clock-footer">
        <div className="teacher-greeting">
          <div className="avatar-chip" aria-hidden="true">김</div>
          <div>
            <span className="muted-label">TODAY&apos;S CREW</span>
            <strong>{displayName || '오늘도 빛나는 선생님'}</strong>
          </div>
        </div>
        <div className="tiny-status"><SolarIcon name="stars-minimalistic-bold" size={14} /> 무사 생존 모드</div>
      </div>
    </section>
  )
}
