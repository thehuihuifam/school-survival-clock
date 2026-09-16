import type { CSSProperties } from 'react'
import { SolarIcon, type SolarIconName } from './Icon'
import { formatHumanDuration, formatMinutes, formatPercent } from '../lib/time'
import { clockFromSeconds } from '../lib/copy'
import type { ScheduleStatus, SemesterMetrics } from '../types'
import type { WeekContext } from '../lib/schedule'

interface StatsStripProps {
  status: ScheduleStatus
  metrics: SemesterMetrics
  week: WeekContext
}

interface StatTile {
  id: string
  icon: SolarIconName
  label: string
  value: string
  note: string
  /** Optional 0..100 micro bar under the value. */
  progress?: number
  tone?: 'accent' | 'warn' | 'soft'
}

const revealStyle = { '--index': 0 } as CSSProperties

export function StatsStrip({ status, metrics, week }: StatsStripProps) {
  const isOffDay = status.phase === 'off-day'
  const dismissalLabel = status.outline.dismissalSeconds > 0
    ? clockFromSeconds(status.outline.dismissalSeconds)
    : '--:--'

  const tiles: StatTile[] = [
    {
      id: 'periods-left',
      icon: 'notebook-bold',
      label: '남은 교시',
      value: isOffDay ? '—' : `${status.remainingClassCount}교시`,
      note: isOffDay ? '오늘은 수업이 없어요' : `오늘 총 ${status.totalClassCount}교시`,
      tone: 'accent',
    },
    {
      id: 'teaching-left',
      icon: 'stopwatch-bold',
      label: '남은 수업 시간',
      value: isOffDay ? '—' : formatMinutes(status.remainingClassSeconds),
      note: isOffDay ? '완전한 휴식입니다' : `수업 총 ${formatMinutes(status.totalClassSeconds)}`,
      progress: status.classLoadProgress,
    },
    {
      id: 'day-progress',
      icon: 'round-graph-bold',
      label: '오늘 일정 진행률',
      value: isOffDay ? '0%' : `${formatPercent(status.dayProgress, 0)}%`,
      note: isOffDay ? '다음 등교일을 기다리는 중' : `하교 ${dismissalLabel}`,
      progress: status.dayProgress,
      tone: 'soft',
    },
    {
      id: 'week-rhythm',
      icon: 'calendar-mark-bold',
      label: '이번 주 리듬',
      value: week.schoolDaysThisWeek === 0
        ? '수업 없음'
        : week.schoolDayPosition > 0
          ? `${week.schoolDayPosition}/${week.schoolDaysThisWeek}일차`
          : `주 ${week.schoolDaysThisWeek}일 수업`,
      note: week.secondsUntilWeekend !== null
        ? `쉼까지 ${formatHumanDuration(week.secondsUntilWeekend, 2)}`
        : week.remainingSchoolDaysThisWeek > 0
          ? `이번 주 ${week.remainingSchoolDaysThisWeek}일 남음`
          : '오늘은 쉬는 날이에요',
      tone: 'warn',
    },
    {
      id: 'vacation-dday',
      icon: 'battery-charge-bold',
      label: metrics.phase === 'vacation' ? '방학 진행 중' : '방학까지',
      value: metrics.phase === 'vacation' ? '방학 중' : `D-${metrics.calendarDaysRemaining}`,
      note: metrics.phase === 'vacation'
        ? `개학하면 다시 세어요 · 배터리 100%`
        : `남은 수업일 ${metrics.schoolDaysRemaining}일`,
      progress: metrics.progress,
    },
  ]

  return (
    <section className="surface-card stats-strip reveal" style={revealStyle} aria-label="오늘의 핵심 지표">
      <ul className="stats-list">
        {tiles.map((tile) => (
          <li className={`stat-tile ${tile.tone ? `stat-${tile.tone}` : ''}`} key={tile.id}>
            <span className="stat-icon"><SolarIcon name={tile.icon} size={16} /></span>
            <div className="stat-copy">
              <span className="stat-label">{tile.label}</span>
              <strong className="stat-value">{tile.value}</strong>
              <span className="stat-note">{tile.note}</span>
            </div>
            {typeof tile.progress === 'number' && (
              <span className="stat-bar" aria-hidden="true">
                <span
                  className="stat-bar-fill"
                  style={{ '--fill': Math.min(1, Math.max(0.02, tile.progress / 100)) } as CSSProperties}
                />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
