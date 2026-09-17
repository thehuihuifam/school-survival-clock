import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { formatDuration, formatFullKstDate, formatMinutes, formatPercent, pad } from '../lib/time'
import { DAY_TYPE_TONES, heroHeadline } from '../lib/copy'
import { DayOverrideBar } from './DayOverrideBar'
import { SolarIcon } from './Icon'
import type { DayOverride, KstTimeParts, NextSchoolDay, ScheduleStatus } from '../types'

interface ClockHeroProps {
  now: KstTimeParts
  status: ScheduleStatus
  nextSchoolDay: NextSchoolDay | null
  preAlertSeconds: number
  override: DayOverride | null
  /** 오늘 실제 적용되는 하교 시각(단축 수업일이면 앞당겨진 값). */
  dismissalTime: string
  /** 설정에 저장된 기본 하교 시각 — 단축 하교 입력의 시작값. */
  overrideDismissalTime: string
  onOverrideChange: (override: DayOverride | null) => void
}

/**
 * 카운트다운이 무엇을 세고 있는지.
 * `auto` = 상태에 맞춰 자동, `slot` = 지금 교시, `dismissal` = 하교까지.
 */
type FocusMode = 'auto' | 'slot' | 'dismissal'

const FOCUS_ORDER: FocusMode[] = ['auto', 'slot', 'dismissal']

export function ClockHero({
  now,
  status,
  nextSchoolDay,
  preAlertSeconds,
  override,
  dismissalTime,
  overrideDismissalTime,
  onOverrideChange,
}: ClockHeroProps) {
  const [focus, setFocus] = useState<FocusMode>('auto')

  const headline = useMemo(
    () => heroHeadline(status, nextSchoolDay, preAlertSeconds),
    [status, nextSchoolDay, preAlertSeconds],
  )

  const isOff = status.phase === 'off-day'
  // 쉬는 날·하교 후에는 전환할 대상이 없다. 이때는 버튼 시맨틱도 주지 않는다.
  const canToggleFocus = !isOff && status.phase !== 'dismissed'

  // 하교 후나 휴일로 넘어가면 선택해 둔 초점을 자동으로 되돌린다.
  // (그렇지 않으면 다음 날 아침에 엉뚱한 카운트다운이 남아 있다.)
  useEffect(() => {
    if (!canToggleFocus) {
      setFocus('auto')
    }
  }, [canToggleFocus])

  const handleToggleFocus = () => {
    if (!canToggleFocus) return
    setFocus((current) => {
      const next = FOCUS_ORDER[(FOCUS_ORDER.indexOf(current) + 1) % FOCUS_ORDER.length]
      // 진행 중인 블록이 없으면 `slot`은 건너뛴다.
      if (next === 'slot' && !status.activeSlot) {
        return 'dismissal'
      }
      return next
    })
  }

  const focused = useMemo(() => {
    if (focus === 'slot' && status.activeSlot) {
      return {
        kicker: '현재 블록',
        title: `${status.activeSlot.label} 남은 시간`,
        value: formatDuration(status.secondsRemaining),
        note: status.activeSlot.timeLabel,
        valueNote: `하교까지 ${formatMinutes(Math.max(0, status.outline.dismissalSeconds - now.daySeconds))}`,
        bar: status.slotProgress,
        icon: 'notebook-bold' as const,
      }
    }
    if (focus === 'dismissal' && canToggleFocus) {
      const remain = Math.max(0, status.outline.dismissalSeconds - now.daySeconds)
      return {
        kicker: '하교까지',
        title: `하교까지 ${formatMinutes(remain)}`,
        value: formatDuration(remain),
        note: `${dismissalTime} 하교 · 오늘 ${status.totalClassCount}교시`,
        valueNote: `남은 수업 ${status.remainingClassCount}교시`,
        bar: status.dayProgress,
        icon: 'flag-bold' as const,
      }
    }
    return null
  }, [focus, status, now.daySeconds, dismissalTime, canToggleFocus])

  const barValue = focused ? focused.bar : headline.barProgress
  const barFill = Math.min(1, Math.max(0.01, barValue / 100))
  const barCaption = focused ? `${formatPercent(focused.bar, 0)}%` : headline.barLabel
  const kicker = focused ? focused.kicker : headline.kicker
  const title = focused ? focused.title : headline.title
  const helper = focused ? focused.note : headline.helper

  const focusHint = canToggleFocus
    ? focus === 'auto'
      ? '누르면 현재 블록 / 하교까지로 전환'
      : focus === 'slot'
        ? '누르면 하교까지 남은 시간'
        : '누르면 자동 표시로 돌아가기'
    : undefined

  return (
    <section className="surface-card clock-card reveal">
      <div className="card-heading-row">
        <div>
          <p className="card-title">오늘</p>
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
      </div>
      <p className="sr-only" role="timer" aria-live="polite" aria-atomic="true">
        현재 시각 {now.hour}시 {now.minute}분, {headline.title}
      </p>

      {/* 날짜는 한 줄로만 표기한다(짧은 날짜와 긴 날짜를 겹쳐 쓰지 않는다). */}
      <div className="date-line">
        <SolarIcon name="calendar-bold" size={15} />
        <span>{formatFullKstDate(now)} {now.weekday}</span>
      </div>

      <div
        className={`countdown-panel countdown-${focused ? (focus === 'slot' ? 'focus' : 'waiting') : headline.tone}${
          canToggleFocus ? ' is-interactive' : ''
        }`}
        onClick={canToggleFocus ? handleToggleFocus : undefined}
        role={canToggleFocus ? 'button' : undefined}
        tabIndex={canToggleFocus ? 0 : undefined}
        onKeyDown={
          canToggleFocus
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleToggleFocus()
                }
              }
            : undefined
        }
        title={focusHint}
        aria-label={focusHint ? `${title} · ${focusHint}` : undefined}
      >
        <div className="countdown-copy">
          <div className="countdown-icon">
            <SolarIcon name={focused ? focused.icon : headline.icon} size={19} />
          </div>
          <div className="countdown-text">
            <p className="countdown-kicker">{kicker}</p>
            <p className="countdown-label">{title}</p>
            {helper && <p className="countdown-helper">{helper}</p>}
          </div>
        </div>

        <div className="countdown-readout">
          <strong className="countdown-value">{focused ? focused.value : headline.value}</strong>
          <span className="countdown-note">{focused ? focused.valueNote : headline.valueNote}</span>
          <span className="countdown-percent">{barCaption}</span>
        </div>

        <div className="countdown-bar">
          <div
            className="countdown-bar-fill"
            style={{ '--fill': barFill } as CSSProperties}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(barValue)}
            aria-label="오늘 일정 진행률"
          />
        </div>
      </div>

      <DayOverrideBar
        dateKey={now.dateKey}
        override={override}
        dismissalTime={overrideDismissalTime}
        onChange={onOverrideChange}
      />
    </section>
  )
}
