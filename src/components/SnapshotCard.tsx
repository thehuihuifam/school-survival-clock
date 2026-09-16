import type { CSSProperties } from 'react'
import { SolarIcon, type SolarIconName } from './Icon'
import { formatDuration, formatHumanDuration } from '../lib/time'
import { PHASE_LABELS, clockFromSeconds } from '../lib/copy'
import type { UpcomingEvent } from '../lib/timeline'
import type { NextDayOff, ScheduleStatus, SemesterMetrics } from '../types'

interface SnapshotCardProps {
  status: ScheduleStatus
  metrics: SemesterMetrics
  dismissalTime: string
  nextDayOff: NextDayOff | null
  nextEvent: UpcomingEvent | null
  isOffline: boolean
}

interface SnapshotRow {
  id: string
  icon: SolarIconName
  tone: 'accent' | 'warn' | 'pale'
  label: string
  value: string
  unit?: string
  status: string
}

const revealStyle = { '--index': 2 } as CSSProperties

export function SnapshotCard({
  status,
  metrics,
  dismissalTime,
  nextDayOff,
  nextEvent,
  isOffline,
}: SnapshotCardProps) {
  const isDismissed = status.phase === 'dismissed'
  const isOffDay = status.phase === 'off-day'
  const dismissalLabel = status.outline.dismissalSeconds > 0
    ? clockFromSeconds(status.outline.dismissalSeconds)
    : dismissalTime

  const rows: SnapshotRow[] = [
    {
      id: 'mode',
      icon: isOffDay ? 'moon-stars-bold' : isDismissed ? 'check-circle-bold' : 'target-bold',
      tone: 'accent',
      label: '오늘의 모드',
      value: status.day.label,
      status: PHASE_LABELS[status.phase],
    },
    {
      id: 'next-event',
      icon: 'hourglass-bold',
      tone: 'warn',
      label: '다음 이벤트',
      value: nextEvent ? nextEvent.label : '등록된 일정 없음',
      status: nextEvent
        ? nextEvent.isActive
          ? `${formatDuration(nextEvent.secondsUntilEnd)} 후 종료`
          : `${formatHumanDuration(nextEvent.secondsFromNow, 2)} 후`
        : '설정에서 시간표를 확인하세요',
    },
    {
      id: 'next-rest',
      icon: 'cup-hot-bold',
      tone: 'pale',
      label: '다음 쉼표',
      value: nextDayOff ? `${nextDayOff.label} D-${nextDayOff.daysUntil}` : '등록된 휴일 없음',
      status: nextDayOff ? `${formatHumanDuration(nextDayOff.secondsUntil, 2)} 남음` : '학기 일정을 확인하세요',
    },
    {
      id: 'dismissal',
      icon: 'flag-bold',
      tone: 'accent',
      label: '하교(퇴근) 목표',
      value: dismissalLabel,
      unit: 'KST',
      status: isOffDay
        ? '오늘은 일정이 없어요'
        : isDismissed
          ? `${formatHumanDuration(status.secondsSinceDismissal, 2)} 전에 완료`
          : `${formatDuration(status.secondsRemaining)} 남음`,
    },
    {
      id: 'vacation',
      icon: 'calendar-mark-bold',
      tone: 'warn',
      label: '방학까지',
      value: `D-${metrics.calendarDaysRemaining}`,
      status: metrics.phase === 'vacation'
        ? '방학 진행 중입니다'
        : `남은 수업일 ${metrics.schoolDaysRemaining}일 · 충전 ${metrics.progress.toFixed(0)}%`,
    },
  ]

  return (
    <section className="surface-card snapshot-card reveal reveal-on-scroll" style={revealStyle}>
      <div className="snapshot-header">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot soft" aria-hidden="true" /> LITTLE CHECKPOINTS</p>
          <h2>오늘의 생존 스냅샷</h2>
        </div>
        <p className="snapshot-check">
          <SolarIcon name={isOffline ? 'cloud-download-bold' : 'flash-drive-bold'} size={15} />
          {isOffline ? '오프라인 · 캐시 사용' : '자동 저장됨'}
        </p>
      </div>

      <ul className="snapshot-list">
        {rows.map((row) => (
          <li className="snapshot-row" key={row.id}>
            <span className={`snapshot-row-icon ${row.tone}`} aria-hidden="true"><SolarIcon name={row.icon} size={16} /></span>
            <div className="snapshot-row-copy">
              <span>{row.label}</span>
              <strong>
                {row.value}
                {row.unit && <small> {row.unit}</small>}
              </strong>
            </div>
            <span className="snapshot-row-status">{row.status}</span>
          </li>
        ))}
      </ul>

      <p className="snapshot-note">
        <SolarIcon name="hand-heart-bold" size={14} />
        이 화면을 책상 한 켠에 띄워두고, 오늘의 나에게 작은 박수를 보내주세요.
      </p>
    </section>
  )
}
