import { useMemo, type CSSProperties } from 'react'
import { SolarIcon, type SolarIconName } from './Icon'
import { formatDuration, formatHumanDuration, formatMinutes } from '../lib/time'
import { PHASE_LABELS, clockFromSeconds } from '../lib/copy'
import { layoutTimeline } from '../lib/timeline'
import type { UpcomingEvent } from '../lib/timeline'
import type { KstTimeParts, ScheduleStatus, SlotKind } from '../types'

interface PeriodTrackerProps {
  now: KstTimeParts
  status: ScheduleStatus
  upcoming: UpcomingEvent[]
}

const revealStyle = { '--index': 0 } as CSSProperties

const SLOT_ICONS: Record<SlotKind, SolarIconName> = {
  class: 'notebook-bold',
  lunch: 'plate-bold',
  club: 'smile-circle-bold',
  duty: 'clipboard-list-bold',
  break: 'cup-hot-bold',
}

const SLOT_STATE_LABELS = {
  done: '완료',
  active: '진행 중',
  upcoming: '예정',
} as const

function slotHeadline(status: ScheduleStatus) {
  const { phase, activeSlot, nextSlot, day } = status

  if (phase === 'off-day') {
    return { title: day.label, detail: day.description }
  }
  if (phase === 'dismissed') {
    return {
      title: '오늘의 교실 미션 완료',
      detail: `${clockFromSeconds(status.outline.dismissalSeconds)} 하교 · ${status.totalClassCount}교시 모두 마쳤습니다`,
    }
  }
  if (phase === 'before-first-slot' && nextSlot) {
    return {
      title: '수업 시작 전, 커피와 마음을 충전하세요',
      detail: `${nextSlot.label} ${nextSlot.timeLabel} 시작까지 ${formatHumanDuration(status.secondsRemaining, 2)}`,
    }
  }
  if (phase === 'in-slot' && activeSlot) {
    return {
      title: `${activeSlot.label} 진행 중`,
      detail: `${activeSlot.timeLabel} · 종료까지 ${formatDuration(status.secondsRemaining)} (${Math.round(status.slotProgress)}%)`,
    }
  }
  return {
    title: '잠깐의 공백',
    detail: nextSlot
      ? `${nextSlot.label}까지 ${formatDuration(status.secondsRemaining)} · 남은 수업 ${formatMinutes(status.remainingClassSeconds)}`
      : `하교까지 ${formatDuration(status.secondsRemaining)}`,
  }
}

function countdownFor(event: UpcomingEvent) {
  if (event.isActive) {
    return `${formatDuration(event.secondsUntilEnd)} 남음`
  }
  if (event.secondsFromNow < 3600) {
    return `${formatDuration(event.secondsFromNow)} 후`
  }
  return `${formatHumanDuration(event.secondsFromNow, 2)} 후`
}

export function PeriodTracker({ now, status, upcoming }: PeriodTrackerProps) {
  const layout = useMemo(() => layoutTimeline(status.outline, now.daySeconds), [status.outline, now.daySeconds])
  const headline = slotHeadline(status)
  const isEmpty = layout.items.length === 0

  return (
    <section className="surface-card period-card reveal reveal-on-scroll" style={revealStyle}>
      <div className="period-header">
        <div className="period-heading">
          <p className="eyebrow"><span className="eyebrow-dot soft" aria-hidden="true" /> CLASSROOM RADAR</p>
          <h2>오늘의 시간표 레이더</h2>
          <p className="card-subtitle">설정한 시간표 기준 · 모든 시각은 KST입니다</p>
        </div>
        <div className={`period-now-badge ${status.isBreak ? 'is-break' : ''} ${status.phase === 'dismissed' ? 'is-done' : ''}`}>
          <span className="period-now-pulse" aria-hidden="true" />
          <span>{PHASE_LABELS[status.phase]}</span>
          <strong>
            {status.phase === 'off-day'
              ? '재충전'
              : status.phase === 'dismissed'
                ? '수고하셨어요'
                : status.phase === 'before-first-slot'
                  ? `${formatHumanDuration(status.secondsRemaining, 2)} 남음`
                  : `${Math.round(status.dayProgress)}% 진행`}
          </strong>
        </div>
      </div>

      <div className="period-body">
        <div className="period-main">
          <div className="period-current-note">
            <div className="period-note-icon">
              <SolarIcon
                name={status.activeSlot ? SLOT_ICONS[status.activeSlot.kind] : status.phase === 'dismissed' ? 'check-circle-bold' : status.phase === 'off-day' ? 'moon-stars-bold' : 'sunrise-bold'}
                size={18}
              />
            </div>
            <div className="period-note-copy">
              <p className="period-note-title">{headline.title}</p>
              <p className="period-note-detail">{headline.detail}</p>
            </div>
            <div className="period-clock-mini" aria-hidden="true">
              <span>NOW</span>
              {clockFromSeconds(now.daySeconds)}
            </div>
          </div>

          {isEmpty ? (
            <div className="timeline-empty">
              <SolarIcon name="calendar-add-bold" size={20} />
              <div>
                <p>표시할 시간표가 없습니다</p>
                <span>설정 → 시간표에서 이 요일의 교시를 추가하거나 프리셋을 적용해 보세요.</span>
              </div>
            </div>
          ) : (
            <div className="timeline-scroll" tabIndex={0} role="group" aria-label="오늘의 시간표 타임라인">
              <div className="timeline-track">
                {layout.items.map((item) => (
                  <div
                    className={`timeline-slot kind-${item.slot.kind} is-${item.state} ${item.isCompact ? 'is-compact' : ''}`}
                    key={item.slot.id}
                    style={{ left: `${item.startPercent}%`, width: `${item.widthPercent}%` }}
                    title={`${item.slot.label} · ${item.slot.timeLabel} · ${SLOT_STATE_LABELS[item.state]}`}
                    aria-current={item.state === 'active' ? 'true' : undefined}
                  >
                    <span
                      className="timeline-slot-fill"
                      style={{ '--progress': item.progress / 100 } as CSSProperties}
                      aria-hidden="true"
                    />
                    <span className="timeline-slot-top">
                      {item.slot.kind === 'class'
                        ? <span className="period-number">{item.slot.shortLabel}</span>
                        : <SolarIcon name={SLOT_ICONS[item.slot.kind]} size={13} />}
                      {!item.isCompact && <span className="timeline-slot-label">{item.slot.label}</span>}
                    </span>
                    {!item.isCompact && <span className="timeline-time">{item.slot.timeLabel}</span>}
                    {item.state === 'active' && <span className="active-pill">NOW</span>}
                  </div>
                ))}
                {layout.needlePercent !== null && (
                  <span className="timeline-needle" style={{ left: `${layout.needlePercent}%` }} aria-hidden="true" />
                )}
              </div>
              <div className="timeline-scale" aria-hidden="true">
                <span>{clockFromSeconds(layout.firstStartSeconds ?? 0)} 시작</span>
                <span className="timeline-scale-mid">수업 {formatMinutes(status.outline.totalClassSeconds)} · 쉬는 시간 {formatMinutes(status.outline.totalBreakSeconds)}</span>
                <span>{clockFromSeconds(layout.dismissalSeconds)} 하교</span>
              </div>
            </div>
          )}

          {!isEmpty && (
            <ul className="slot-list">
              {layout.items
                .filter((item) => item.slot.kind !== 'break')
                .map((item) => (
                  <li className={`slot-row kind-${item.slot.kind} is-${item.state}`} key={`row-${item.slot.id}`}>
                    <span className="slot-index" aria-hidden="true">
                      {item.slot.kind === 'class'
                        ? item.slot.shortLabel
                        : <SolarIcon name={SLOT_ICONS[item.slot.kind]} size={13} />}
                    </span>
                    <span className="slot-name">{item.slot.label}</span>
                    <span className="slot-time">{item.slot.timeLabel}</span>
                    <span className="slot-state">{SLOT_STATE_LABELS[item.state]}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <aside className="next-up-rail" aria-label="다음 일정">
          <p className="rail-title"><SolarIcon name="hourglass-bold" size={14} /> NEXT UP</p>
          {upcoming.length === 0 ? (
            <p className="rail-empty">등록된 다음 일정이 없습니다.</p>
          ) : (
            <ol className="rail-list">
              {upcoming.map((event) => (
                <li className={`rail-item kind-${event.kind} ${event.isActive ? 'is-active' : ''}`} key={event.id}>
                  <span className="rail-icon" aria-hidden="true"><SolarIcon name={SLOT_ICONS[event.kind]} size={14} /></span>
                  <div className="rail-copy">
                    <strong>{event.label}</strong>
                    <span>{event.isToday ? event.timeLabel : `${event.dayLabel} · ${event.timeLabel}`}</span>
                  </div>
                  <span className="rail-countdown">{countdownFor(event)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="rail-note">
            <SolarIcon name="bell-ring-bold" size={13} />
            교시 시작·쉬는 시간·하교 순간에 소리와 브라우저 알림을 받을 수 있어요.
          </p>
        </aside>
      </div>

      <p className="period-legend">
        <SolarIcon name="info-circle-linear" size={14} />
        쉬는 시간은 교시 사이 5분 이상의 간격에서 자동으로 만들어지고, 마지막 교시와 퇴근 시각 사이는 방과후·업무 시간으로 표시됩니다.
      </p>
    </section>
  )
}
