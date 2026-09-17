import { useMemo, type CSSProperties } from 'react'
import { SolarIcon, type SolarIconName } from './Icon'
import { getWeekOverview, type WeekDayState } from '../lib/weekOverview'
import { formatMinutes } from '../lib/time'
import type { KstTimeParts, UserSettings } from '../types'

interface WeekOverviewProps {
  now: KstTimeParts
  settings: UserSettings
}

const STATE_ICON: Record<WeekDayState, SolarIconName> = {
  school: 'notebook-bold',
  today: 'notebook-bold',
  holiday: 'confetti-bold',
  weekend: 'moon-stars-bold',
  vacation: 'moon-stars-bold',
  override: 'cup-hot-bold',
  empty: 'calendar-add-bold',
}

/**
 * 이번 주 월~일 요약.
 *
 * 하루 타임라인만 보면 "이번 주 언제가 제일 힘든지", "금요일까지 며칠 남았는지"를
 * 알 수 없다. 주 단위 막대 하나로 남은 수업일과 최대 부하 요일을 한 번에 보여 준다.
 */
export function WeekOverview({ now, settings }: WeekOverviewProps) {
  const overview = useMemo(() => getWeekOverview(now, settings), [now.dateKey, settings])

  // 막대 높이는 그 주에서 가장 긴 수업일을 100%로 삼는다.
  const peakSeconds = useMemo(
    () => overview.days.reduce((max, day) => Math.max(max, day.classSeconds), 0),
    [overview],
  )

  const summary =
    overview.schoolDayCount === 0
      ? '이번 주는 수업이 없어요'
      : overview.remainingSchoolDayCount === 0
        ? `이번 주 ${overview.schoolDayCount}일 수업 완주`
        : `남은 수업일 ${overview.remainingSchoolDayCount}일 · 주간 수업 ${formatMinutes(overview.totalClassSeconds)}`

  return (
    <section className="surface-card week-card reveal" aria-label="이번 주 한눈에 보기">
      <div className="card-heading-row">
        <div>
          <h2>이번 주</h2>
          <p className="card-subtitle">{summary}</p>
        </div>
        <p className="week-total">
          <SolarIcon name="graph-up-bold" size={13} />
          <span>{overview.schoolDayCount}일 수업</span>
        </p>
      </div>

      <ol className="week-grid">
        {overview.days.map((day) => {
          const heightRatio =
            peakSeconds > 0 && day.classSeconds > 0
              ? Math.max(0.18, day.classSeconds / peakSeconds)
              : 0
          const isHeaviest = day.dateKey === overview.heaviestDateKey && overview.schoolDayCount > 1

          return (
            <li
              className={`week-day is-${day.state}${day.isToday ? ' is-current' : ''}${day.isPast ? ' is-past' : ''}${
                isHeaviest ? ' is-peak' : ''
              }`}
              key={day.dateKey}
              aria-current={day.isToday ? 'date' : undefined}
              title={`${day.weekdayLabel}요일 · ${
                day.classCount > 0 ? `${day.classCount}교시 ${day.spanLabel ?? ''}`.trim() : (day.note ?? '일정 없음')
              }`}
            >
              <span className="week-day-label">{day.weekdayLabel}</span>
              <div className="week-day-bar" aria-hidden="true">
                {heightRatio > 0 ? (
                  <span className="week-day-fill" style={{ '--height': heightRatio } as CSSProperties} />
                ) : (
                  <span className="week-day-icon">
                    <SolarIcon name={STATE_ICON[day.state]} size={12} />
                  </span>
                )}
              </div>
              <span className="week-day-value">
                {day.classCount > 0 ? `${day.classCount}교시` : (day.note ?? '—')}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
