import type { CSSProperties } from 'react'
import { formatDuration, formatKstDate, formatKstTime } from '../lib/time'
import { SolarIcon } from './Icon'
import type { KstTimeParts, PeriodStatus } from '../types'

interface ClockHeroProps {
  now: KstTimeParts
  displayName: string
  dismissalTime: string
  countdownSeconds: number
  status: PeriodStatus
}

const revealStyle = { '--index': 2 } as CSSProperties

function getAvatarLabel(displayName: string) {
  const lastWord = displayName.trim().split(/\s+/).at(-1) ?? ''
  const name = lastWord.replace(/선생님$|교사$/, '')
  return name.charAt(0) || '선'
}

export function ClockHero({
  now,
  displayName,
  dismissalTime,
  countdownSeconds,
  status,
}: ClockHeroProps) {
  const hasDismissed = status.isAfterSchool
  const isOffDay = status.isOffDay

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

      <div className={`countdown-panel ${hasDismissed ? 'countdown-complete' : ''} ${isOffDay ? 'countdown-rest' : ''}`}>
        <div className="countdown-copy">
          <div className="countdown-icon">
            {isOffDay
              ? <SolarIcon name="cup-hot-bold" size={18} />
              : hasDismissed
                ? <SolarIcon name="check-circle-bold" size={18} />
                : <SolarIcon name="alarm-bold" size={18} />}
          </div>
          <div>
            <p className="countdown-label">{isOffDay ? '오늘의 학교 모드' : '오늘 퇴근(하교)까지 남은 시간'}</p>
            <p className="countdown-helper">
              {isOffDay ? status.timeLabel : hasDismissed ? '오늘도 무사히 미션 클리어!' : `정시 퇴근 목표 · ${dismissalTime}`}
            </p>
          </div>
        </div>
        <strong className="countdown-value">{isOffDay ? '휴식 DAY' : formatDuration(countdownSeconds)}</strong>
      </div>

      <div className="clock-footer">
        <div className="teacher-greeting">
          <div className="avatar-chip" aria-hidden="true">{getAvatarLabel(displayName)}</div>
          <div>
            <span className="muted-label">TODAY&apos;S CREW</span>
            <strong>{displayName || '오늘도 빛나는 선생님'}</strong>
          </div>
        </div>
        <div className="tiny-status">
          <SolarIcon name="stars-minimalistic-bold" size={14} />
          {isOffDay ? '회복 모드' : '무사 생존 모드'}
        </div>
      </div>
    </section>
  )
}
