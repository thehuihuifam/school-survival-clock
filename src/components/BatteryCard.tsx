import type { CSSProperties } from 'react'
import { SolarIcon, type SolarIconName } from './Icon'
import { formatDateKeyShort, formatPercent } from '../lib/time'
import type { SemesterMetrics } from '../types'

interface BatteryCardProps {
  metrics: SemesterMetrics
  /** `true` when today itself is a teaching day. */
  isTodaySchoolDay: boolean
}

interface BatteryTone {
  name: 'red' | 'orange' | 'yellow' | 'green'
  label: string
  icon: SolarIconName
}

function getBatteryTone(progress: number): BatteryTone {
  if (progress <= 25) {
    return { name: 'red', label: '아직 갈 길이 멀어요', icon: 'danger-triangle-bold' }
  }
  if (progress <= 50) {
    return { name: 'orange', label: '조금씩 적응 중이에요', icon: 'graph-up-bold' }
  }
  if (progress <= 75) {
    return { name: 'yellow', label: '절반을 넘었습니다', icon: 'stars-bold' }
  }
  return { name: 'green', label: '방학이 보여요!', icon: 'check-circle-bold' }
}

const revealStyle = { '--index': 2 } as CSSProperties

export function BatteryCard({ metrics, isTodaySchoolDay }: BatteryCardProps) {
  const tone = metrics.phase === 'vacation'
    ? { name: 'green', label: '방학 모드 · 완전 충전', icon: 'confetti-bold' } as BatteryTone
    : getBatteryTone(metrics.progress)

  const progress = formatPercent(metrics.progress, 2)
  // `transform: scaleX()` instead of `width` so the gauge animates on the
  // compositor instead of triggering layout every second.
  const fillRatio = Math.min(1, Math.max(0.012, metrics.progress / 100))
  const fillStyle = { '--fill': fillRatio } as CSSProperties

  const phaseNote = metrics.phase === 'before-semester'
    ? `개학일 ${formatDateKeyShort(metrics.startDate)} 기준 0% · 지금부터 카운트됩니다`
    : metrics.phase === 'vacation'
      ? `${formatDateKeyShort(metrics.vacationDate)}부터 방학 · 배터리는 100%입니다`
      : isTodaySchoolDay
        ? `오늘은 ${metrics.elapsedSchoolDays + 1}번째 수업일입니다`
        : '오늘은 수업일이 아니라 충전율에 포함되지 않아요'

  return (
    <section className={`surface-card battery-card reveal battery-tone-${tone.name}`} style={revealStyle}>
      <div className="battery-card-topline">
        <div className="battery-title-lockup">
          <div className="section-icon battery-icon"><SolarIcon name="battery-charge-bold" size={19} /></div>
          <div>
            <p className="eyebrow">SEMESTER SURVIVAL</p>
            <h2>방학 D-Day 충전 게이지</h2>
          </div>
        </div>
        <div className="battery-status-mark">
          <SolarIcon name={tone.icon} size={17} label={tone.label} />
        </div>
      </div>

      <div className="battery-visual-wrap">
        <div className="battery-terminal" aria-hidden="true" />
        <div
          className="battery-shell"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Number(progress)}
          aria-valuetext={`생존 배터리 ${progress}퍼센트, 방학까지 ${metrics.schoolDaysRemaining}수업일`}
        >
          <div className="battery-fill" style={fillStyle}>
            <div className="battery-fill-shine" aria-hidden="true" />
          </div>
          <div className="battery-segments" aria-hidden="true">
            <span /><span /><span /><span /><span /><span /><span /><span />
          </div>
          <div className="battery-center-label" aria-hidden="true">
            <SolarIcon name="bolt-bold" size={13} /> SURVIVE
          </div>
        </div>
      </div>

      <div className="battery-reading">
        <div className="reading-block">
          <p className="reading-label">방학까지</p>
          <p className="dday-value">D-{metrics.calendarDaysRemaining}<span>일</span></p>
          <p className="reading-sub">남은 수업일 {metrics.schoolDaysRemaining}일</p>
        </div>
        <div className="reading-block charge-reading">
          <p className="reading-label">생존 배터리 충전율</p>
          <p className="charge-value">{progress}<span>%</span></p>
          <p className="reading-sub">수업일 {metrics.elapsedSchoolDays}/{Math.max(metrics.totalSchoolDays, 0)}일</p>
        </div>
      </div>

      <div className="battery-scale">
        <span><SolarIcon name="calendar-bold" size={13} /> {formatDateKeyShort(metrics.startDate)} 학기 시작</span>
        <SolarIcon name="arrow-right-linear" size={14} />
        <span>{formatDateKeyShort(metrics.vacationDate)} 방학 시작</span>
      </div>

      <p className="battery-footnote">
        <span className="tone-dot" aria-hidden="true" /> {tone.label} · {phaseNote}
      </p>

      {!metrics.isConfigured && (
        <p className="battery-warning">
          <SolarIcon name="danger-circle-bold" size={14} />
          학기 시작일과 방학 시작일을 설정하면 배터리가 채워집니다.
        </p>
      )}
    </section>
  )
}
