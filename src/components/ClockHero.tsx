import { useMemo, type CSSProperties } from 'react'
import { formatFullKstDate, formatKstDate, pad } from '../lib/time'
import { DAY_TYPE_TONES, greetingForHour, heroHeadline } from '../lib/copy'
import { SolarIcon } from './Icon'
import type { KstTimeParts, NextSchoolDay, ScheduleStatus } from '../types'

interface ClockHeroProps {
  now: KstTimeParts
  displayName: string
  status: ScheduleStatus
  nextSchoolDay: NextSchoolDay | null
}

const revealStyle = { '--index': 1 } as CSSProperties

function avatarInitial(displayName: string) {
  const trimmed = displayName.trim()
  if (!trimmed) {
    return '쌤'
  }
  const firstCharacter = [...trimmed][0]
  return /[가-힣]/.test(firstCharacter) ? firstCharacter : firstCharacter.toUpperCase()
}

export function ClockHero({ now, displayName, status, nextSchoolDay }: ClockHeroProps) {
  const headline = useMemo(() => heroHeadline(status, nextSchoolDay), [status, nextSchoolDay])

  // Screen readers get one polite announcement per minute instead of a
  // per-second storm from the visual clock.
  const spokenTime = `${now.hour}시 ${now.minute}분`
  const barFill = Math.min(1, Math.max(0.008, headline.barProgress / 100))

  return (
    <section className={`surface-card clock-card reveal hero-tone-${headline.tone}`} style={revealStyle}>
      <div className="card-orb orb-accent" aria-hidden="true" />
      <div className="card-orb orb-deep" aria-hidden="true" />

      <div className="card-heading-row">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" /> LIVE CLOCK · ASIA/SEOUL</p>
          <p className="card-subtitle">{status.day.description}</p>
        </div>
        <p className={`day-badge ${DAY_TYPE_TONES[status.day.dayType]}`}>
          <SolarIcon name={headline.icon} size={14} />
          <span>{status.day.label}</span>
        </p>
      </div>

      <div className="clock-display" aria-hidden="true">
        <span className="clock-time">{pad(now.hour)}:{pad(now.minute)}</span>
        <span className="clock-seconds">{pad(now.second)}</span>
        <span className="clock-seconds-label">NOW</span>
      </div>
      <p className="sr-only" role="timer" aria-live="polite" aria-atomic="true">
        현재 시각 {spokenTime}, {headline.title}
      </p>

      <div className="date-line">
        <SolarIcon name="calendar-bold" size={15} />
        <span>{formatKstDate(now)}</span>
        <span className="date-line-sep" aria-hidden="true">·</span>
        <span className="date-line-full">{formatFullKstDate(now)}</span>
      </div>

      <div className={`countdown-panel countdown-${headline.tone}`}>
        <div className="countdown-copy">
          <div className="countdown-icon"><SolarIcon name={headline.icon} size={19} /></div>
          <div className="countdown-text">
            <p className="countdown-kicker">{headline.kicker}</p>
            <p className="countdown-label">{headline.title}</p>
            <p className="countdown-helper">{headline.helper}</p>
          </div>
        </div>

        <div className="countdown-readout">
          <strong className="countdown-value">{headline.value}</strong>
          <span className="countdown-note">{headline.valueNote}</span>
        </div>

        <div className="countdown-bar">
          <div
            className="countdown-bar-fill"
            style={{ '--fill': barFill } as CSSProperties}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(headline.barProgress)}
            aria-label="오늘 일정 진행률"
          />
          <span className="countdown-bar-label">{headline.barLabel}</span>
        </div>
      </div>

      <div className="clock-footer">
        <div className="teacher-greeting">
          <div className="avatar-chip" aria-hidden="true">{avatarInitial(displayName).trim()}</div>
          <div className="teacher-greeting-copy">
            <span className="muted-label">TODAY&apos;S CREW</span>
            <strong>{displayName || '오늘도 빛나는 선생님'}</strong>
          </div>
        </div>
        <p className="tiny-status"><SolarIcon name="stars-minimalistic-bold" size={14} /> {greetingForHour(now.hour)}</p>
      </div>
    </section>
  )
}
