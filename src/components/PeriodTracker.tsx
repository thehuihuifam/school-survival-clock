import { useMemo, type CSSProperties } from 'react'
import { SolarIcon, type SolarIconName } from './Icon'
import { formatDuration, formatHmFromSeconds, formatHumanDuration, formatMinutes } from '../lib/time'
import { PHASE_LABELS } from '../lib/copy'
import { layoutTimeline } from '../lib/timeline'
import type { UpcomingEvent } from '../lib/timeline'
import type { KstTimeParts, ScheduleStatus, SlotKind } from '../types'

interface PeriodTrackerProps {
  now: KstTimeParts
  status: ScheduleStatus
  upcoming: UpcomingEvent[]
  preAlertSeconds: number
}

const SLOT_ICONS: Record<SlotKind, SolarIconName> = {
  class: 'notebook-bold',
  lunch: 'plate-bold',
  club: 'smile-circle-bold',
  duty: 'clipboard-list-bold',
  break: 'cup-hot-bold',
}

const STATE_LABEL = { done: '완료', active: '진행 중', upcoming: '예정' } as const

/** 사이드 레일에 보여 줄 다음 일정 개수. */
const NEXT_UP_LIMIT = 3

function slotHeadline(status: ScheduleStatus) {
  const { phase, activeSlot, nextSlot, day } = status
  if (phase === 'off-day') return { title: day.label, detail: day.description }
  if (phase === 'dismissed') return {
    title: '오늘 교실 미션 완료',
    detail: `${formatHmFromSeconds(status.outline.dismissalSeconds)} 하교 · ${status.totalClassCount}교시 완료`,
  }
  if (phase === 'before-first-slot' && nextSlot) return {
    title: `${nextSlot.label} 시작 전`,
    detail: `${nextSlot.timeLabel} · ${formatHumanDuration(status.secondsRemaining, 2)} 남음`,
  }
  if (phase === 'in-slot' && activeSlot) return {
    title: `${activeSlot.label} 진행 중`,
    detail: `${activeSlot.timeLabel} · 종료까지 ${formatDuration(status.secondsRemaining)} (${Math.round(status.slotProgress)}%)`,
  }
  return {
    title: '잠깐의 공백',
    detail: nextSlot ? `${nextSlot.label}까지 ${formatDuration(status.secondsRemaining)}` : `하교까지 ${formatDuration(status.secondsRemaining)}`,
  }
}

function countdownFor(event: UpcomingEvent) {
  if (event.isActive) return `${formatDuration(event.secondsUntilEnd)} 남음`
  if (event.secondsFromNow < 3600) return `${formatDuration(event.secondsFromNow)} 후`
  return `${formatHumanDuration(event.secondsFromNow, 1)} 후`
}

export function PeriodTracker({ now, status, upcoming, preAlertSeconds }: PeriodTrackerProps) {
  const layout = useMemo(() => layoutTimeline(status.outline, now.daySeconds), [status.outline, now.daySeconds])
  const headline = slotHeadline(status)
  const isEmpty = layout.items.length === 0
  const isOffDay = status.phase === 'off-day'

  // 자동 생성된 쉬는 시간은 빼고, 같은 라벨+시간대가 중복으로 들어오는 것도 막는다.
  const filteredUpcoming = useMemo(() => {
    const seen = new Set<string>()
    const result: UpcomingEvent[] = []
    for (const ev of upcoming) {
      if (ev.kind === 'break') continue
      const key = `${ev.label}-${ev.timeLabel}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push(ev)
      if (result.length >= NEXT_UP_LIMIT) break
    }
    return result
  }, [upcoming])

  return (
    <section className="surface-card period-card reveal">
      <div className="period-header">
        <div className="period-heading">
          <h2>오늘의 시간표</h2>
        </div>
        <div className={`period-now-badge ${status.isBreak ? 'is-break' : ''} ${status.phase === 'dismissed' ? 'is-done' : ''}`}>
          <span className="period-now-pulse" aria-hidden="true" />
          <span>{PHASE_LABELS[status.phase]}</span>
          <strong>
            {status.phase === 'off-day' ? '재충전'
              : status.phase === 'dismissed' ? '수고하셨어요'
              : status.phase === 'before-first-slot' ? `${formatHumanDuration(status.secondsRemaining, 1)} 남음`
                : `${Math.round(status.dayProgress)}%`}
          </strong>
        </div>
      </div>

      <div className="period-body">
        <div className="period-main">
          <div className="period-current-note">
            <div className="period-note-icon">
              <SolarIcon
                name={status.activeSlot ? SLOT_ICONS[status.activeSlot.kind] : status.phase === 'dismissed' ? 'check-circle-bold' : status.phase === 'off-day' ? 'moon-stars-bold' : 'sunrise-bold'}
                size={17}
              />
            </div>
            <div className="period-note-copy">
              <p className="period-note-title">{headline.title}</p>
              <p className="period-note-detail">{headline.detail}</p>
            </div>
            <div className="period-clock-mini" aria-hidden="true">
              {formatHmFromSeconds(now.daySeconds)}
            </div>
          </div>

          {isEmpty ? (
            <div className="timeline-empty is-rest">
              <SolarIcon name={isOffDay ? 'moon-stars-bold' : 'calendar-add-bold'} size={18} />
              <div>
                <p>{isOffDay ? '오늘은 수업이 없어요' : '표시할 시간표가 없습니다'}</p>
                <span>{isOffDay ? `${status.day.label} · ${status.day.description}` : '설정 → 시간표에서 이 요일의 교시를 추가해 보세요.'}</span>
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
                    title={`${item.slot.label} · ${item.slot.timeLabel} · ${STATE_LABEL[item.state]}`}
                    aria-current={item.state === 'active' ? 'true' : undefined}
                  >
                    <span className="timeline-slot-fill" style={{ '--progress': item.progress / 100 } as CSSProperties} aria-hidden="true" />
                    <span className="timeline-slot-top">
                      {item.slot.kind === 'class'
                        ? <span className="period-number">{item.slot.shortLabel}</span>
                        : <SolarIcon name={SLOT_ICONS[item.slot.kind]} size={12} />}
                      {!item.isCompact && <span className="timeline-slot-label">{item.slot.label}</span>}
                    </span>
                    {!item.isCompact && <span className="timeline-time">{item.slot.timeLabel}</span>}
                    {item.state === 'active' && <span className="active-pill">지금</span>}
                  </div>
                ))}
                {layout.needlePercent !== null && (
                  <span className="timeline-needle" style={{ left: `${layout.needlePercent}%` }} aria-hidden="true" />
                )}
              </div>
              <div className="timeline-scale" aria-hidden="true">
                <span>{formatHmFromSeconds(layout.firstStartSeconds ?? 0)} 시작</span>
                <span>수업 {formatMinutes(status.outline.totalClassSeconds)} · 휴식 {formatMinutes(status.outline.totalBreakSeconds)}</span>
                <span>{formatHmFromSeconds(layout.dismissalSeconds)} 하교</span>
              </div>
            </div>
          )}

          {!isEmpty && (
            <ul className="slot-list">
              {layout.items.filter((i) => i.slot.kind !== 'break').map((item) => (
                <li className={`slot-row kind-${item.slot.kind} is-${item.state}`} key={`row-${item.slot.id}`}>
                  <span className="slot-index" aria-hidden="true">
                    {item.slot.kind === 'class' ? item.slot.shortLabel : <SolarIcon name={SLOT_ICONS[item.slot.kind]} size={12} />}
                  </span>
                  <span className="slot-name">{item.slot.label}</span>
                  <span className="slot-time">{item.slot.timeLabel}</span>
                  <span className="slot-state">{STATE_LABEL[item.state]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="next-up-rail" aria-label="다음 일정">
          <p className="rail-title">
            <SolarIcon name="hourglass-bold" size={13} /> 다음 일정
            {filteredUpcoming.length > 0 && <span className="rail-count">{filteredUpcoming.length}</span>}
          </p>
          {filteredUpcoming.length === 0 ? (
            <p className="rail-empty">다음 일정이 없습니다. 설정에서 시간표를 확인하세요.</p>
          ) : (
            <ol className="rail-list">
              {filteredUpcoming.map((event) => {
                const isImminent = !event.isActive && preAlertSeconds > 0 && event.secondsFromNow > 0 && event.secondsFromNow <= preAlertSeconds
                return (
                  <li className={`rail-item kind-${event.kind} ${event.isActive ? 'is-active' : ''} ${isImminent ? 'is-imminent' : ''}`} key={event.id}>
                    <span className="rail-icon" aria-hidden="true"><SolarIcon name={SLOT_ICONS[event.kind]} size={13} /></span>
                    <div className="rail-copy">
                      <strong>{event.label}</strong>
                      <span>{event.isToday ? event.timeLabel : `${event.dayLabel} · ${event.timeLabel}`}</span>
                      {isImminent && <span className="rail-imminent-chip"><SolarIcon name="bell-ring-bold" size={10} /> 예비종</span>}
                    </div>
                    <span className="rail-countdown">{countdownFor(event)}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </aside>
      </div>
    </section>
  )
}
