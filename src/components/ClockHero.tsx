import { useMemo, useState, type CSSProperties } from 'react'
import { formatFullKstDate, formatKstDate, formatMinutes, pad, formatPercent } from '../lib/time'
import { DAY_TYPE_TONES, greetingForHour, heroHeadline } from '../lib/copy'
import { DayOverrideBar } from './DayOverrideBar'
import { SolarIcon } from './Icon'
import type { DayOverride, KstTimeParts, NextSchoolDay, ScheduleStatus } from '../types'

interface ClockHeroProps {
  now: KstTimeParts
  displayName: string
  status: ScheduleStatus
  nextSchoolDay: NextSchoolDay | null
  preAlertSeconds: number
  override: DayOverride | null
  dismissalTime: string
  onOverrideChange: (override: DayOverride | null) => void
}

const revealStyle = { '--index': 1 } as CSSProperties

function avatarInitial(displayName: string) {
  const trimmed = displayName.trim()
  if (!trimmed) return '쌤'
  const first = [...trimmed][0]
  return /[가-힣]/.test(first) ? first : first.toUpperCase()
}

type FocusMode = 'auto' | 'dismissal' | 'slot'

export function ClockHero({
  now,
  displayName,
  status,
  nextSchoolDay,
  preAlertSeconds,
  override,
  dismissalTime,
  onOverrideChange,
}: ClockHeroProps) {
  const [focus, setFocus] = useState<FocusMode>('auto')

  const headline = useMemo(
    () => heroHeadline(status, nextSchoolDay, preAlertSeconds),
    [status, nextSchoolDay, preAlertSeconds],
  )

  const spokenTime = `${now.hour}시 ${now.minute}분`
  const barFill = Math.min(1, Math.max(0.01, headline.barProgress / 100))

  // Focus toggle logic: tapping countdown cycles
  const handleToggleFocus = () => {
    setFocus((f) => {
      if (status.phase !== 'in-slot') return 'auto'
      if (f === 'auto') return 'slot'
      if (f === 'slot') return 'dismissal'
      return 'auto'
    })
  }

  // When focus is slot, show active slot remaining; when dismissal, show day remaining
  const displayValue = useMemo(() => {
    if (focus === 'slot' && status.activeSlot) {
      return {
        kicker: `NOW · ${status.activeSlot.label}`,
        title: `${status.activeSlot.label} 남은 시간`,
        value: `${pad(Math.floor(status.secondsRemaining / 3600))}:${pad(Math.floor((status.secondsRemaining % 3600) / 60))}:${pad(status.secondsRemaining % 60)}`,
        note: `${status.activeSlot.timeLabel} · ${Math.round(status.slotProgress)}% 진행`,
        bar: status.slotProgress,
      }
    }
    if (focus === 'dismissal' && status.phase !== 'off-day' && status.phase !== 'dismissed') {
      const remain = status.outline.dismissalSeconds - now.daySeconds
      const safe = Math.max(0, remain)
      return {
        kicker: 'TODAY LEFT · 하교까지',
        title: `하교까지 ${formatMinutes(safe)}`,
        value: `${pad(Math.floor(safe / 3600))}:${pad(Math.floor((safe % 3600) / 60))}:${pad(safe % 60)}`,
        note: `하교 ${formatFullKstDate(now).split(' ').slice(-1)} ${dismissalTime} · 오늘 ${status.totalClassCount}교시`,
        bar: status.dayProgress,
      }
    }
    return null
  }, [focus, status, now.daySeconds, dismissalTime, now])

  const isOff = status.phase === 'off-day'

  return (
    <section className={`surface-card clock-card reveal hero-tone-${headline.tone}`} style={revealStyle}>
      <div className="card-heading-row">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" /> LIVE CLOCK · ASIA/SEOUL</p>
          <p className="card-subtitle">{status.day.description}</p>
        </div>
        <p className={`day-badge ${DAY_TYPE_TONES[status.day.dayType]}`}>
          <SolarIcon name={headline.icon} size={13} />
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
        <SolarIcon name="calendar-bold" size={14} />
        <span>{formatKstDate(now)}</span>
        <span className="date-line-sep">·</span>
        <span>{formatFullKstDate(now)}</span>
      </div>

      <div
        className={`countdown-panel countdown-${displayValue ? (focus === 'slot' ? 'focus' : 'waiting') : headline.tone}`}
        onClick={handleToggleFocus}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggleFocus() } }}
        title={status.phase === 'in-slot' ? '클릭하면 하교까지 / 현재 교시 남은 시간 전환' : undefined}
      >
        <div className="countdown-copy">
          <div className="countdown-icon"><SolarIcon name={displayValue ? (focus === 'slot' ? 'notebook-bold' : 'flag-bold') : headline.icon} size={18} /></div>
          <div className="countdown-text">
            <p className="countdown-kicker">{displayValue ? displayValue.kicker : headline.kicker}</p>
            <p className="countdown-label">{displayValue ? displayValue.title : headline.title}</p>
            <p className="countdown-helper">{displayValue ? displayValue.note : headline.helper}</p>
          </div>
        </div>

        <div className="countdown-readout">
          <strong className="countdown-value">{displayValue ? displayValue.value : headline.value}</strong>
          <span className="countdown-note">{displayValue ? (focus === 'slot' ? `하교까지 ${formatPercent(status.dayProgress,0)}%` : headline.valueNote) : headline.valueNote}</span>
        </div>

        <div className="countdown-bar">
          <div
            className="countdown-bar-fill"
            style={{ '--fill': displayValue ? displayValue.bar / 100 : barFill } as CSSProperties}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(displayValue ? displayValue.bar : headline.barProgress)}
            aria-label="오늘 일정 진행률"
          />
          <span className="countdown-bar-label">{displayValue ? `${Math.round(displayValue.bar)}%` : headline.barLabel}</span>
        </div>
      </div>

      {!isOff && (
        <div className="today-meta" aria-label="오늘 요약">
          <span className="meta-chip"><SolarIcon name="notebook-bold" size={12} /> <b>{status.totalClassCount}교시</b> 중 {status.remainingClassCount} 남음</span>
          <span className="meta-chip"><SolarIcon name="stopwatch-bold" size={12} /> 남은 수업 <b>{formatMinutes(status.remainingClassSeconds)}</b></span>
          <span className="meta-chip"><SolarIcon name="flag-bold" size={12} /> 하교 <b>{dismissalTime}</b></span>
          <span className="meta-chip accent"><SolarIcon name="round-graph-bold" size={12} /> <b>{formatPercent(status.dayProgress,0)}%</b> 진행</span>
        </div>
      )}

      <div className="clock-footer">
        <div className="teacher-greeting">
          <div className="avatar-chip" aria-hidden="true">{avatarInitial(displayName).trim()}</div>
          <div className="teacher-greeting-copy">
            <span className="muted-label">TODAY'S CREW</span>
            <strong>{displayName || '오늘도 빛나는 선생님'}</strong>
          </div>
        </div>
        <p className="tiny-status"><SolarIcon name="stars-minimalistic-bold" size={13} /> {greetingForHour(now.hour)}</p>
      </div>

      <DayOverrideBar
        dateKey={now.dateKey}
        override={override}
        dismissalTime={dismissalTime}
        onChange={onOverrideChange}
      />
    </section>
  )
}
