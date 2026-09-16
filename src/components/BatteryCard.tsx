import type { CSSProperties } from 'react'
import { SolarIcon, type SolarIconName } from './Icon'
import type { BatteryMetrics } from '../types'

interface BatteryCardProps {
  metrics: BatteryMetrics
}

interface BatteryTone {
  name: string
  label: string
  icon: SolarIconName
}

function getBatteryTone(progress: number): BatteryTone {
  if (progress <= 25) {
    return { name: 'red', label: '충전이 필요해요', icon: 'danger-triangle-bold' }
  }
  if (progress <= 50) {
    return { name: 'orange', label: '아직 괜찮아요', icon: 'graph-up-bold' }
  }
  if (progress <= 75) {
    return { name: 'yellow', label: '절반 이상 통과', icon: 'stars-bold' }
  }
  return { name: 'green', label: '방학이 보인다!', icon: 'check-circle-bold' }
}

function formatShortDate(date: string) {
  const [, month, day] = date.split('-')
  return `${month}.${day}`
}

const revealStyle = { '--index': 3 } as CSSProperties

export function BatteryCard({ metrics }: BatteryCardProps) {
  const tone = getBatteryTone(metrics.progress)
  const progress = metrics.progress.toFixed(2)
  // width 대신 transform: scaleX()로 애니메이션 (합성 레이어에서만 동작)
  const fillRatio = Math.min(1, Math.max(0.012, metrics.progress / 100))
  const fillStyle = { '--fill': fillRatio } as CSSProperties

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
        <div className="battery-status-mark" aria-label={tone.label}>
          <SolarIcon name={tone.icon} size={17} label={tone.label} />
        </div>
      </div>

      <div className="battery-visual-wrap">
        <div className="battery-terminal" />
        <div className="battery-shell" aria-label={`생존 배터리 ${progress}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={metrics.progress}>
          <div className="battery-fill" style={fillStyle}>
            <div className="battery-fill-shine" />
          </div>
          <div className="battery-segments" aria-hidden="true">
            <span /><span /><span /><span /><span /><span /><span /><span />
          </div>
          <div className="battery-center-label"><SolarIcon name="bolt-bold" size={14} /> SURVIVE</div>
        </div>
      </div>

      <div className="battery-reading">
        <div>
          <p className="reading-label">방학까지</p>
          <p className="dday-value">D-{metrics.daysRemaining}<span>일</span></p>
        </div>
        <div className="charge-reading">
          <p className="reading-label">생존 배터리 충전율</p>
          <p className="charge-value">{progress}<span>%</span></p>
        </div>
      </div>

      <div className="battery-scale">
        <span><SolarIcon name="calendar-bold" size={13} /> {formatShortDate(metrics.startDate)} 학기 시작</span>
        <SolarIcon name="arrow-right-linear" size={14} />
        <span>{formatShortDate(metrics.vacationDate)} 방학 시작</span>
      </div>
      <div className="battery-footnote">
        <span className="tone-dot" /> {tone.label} · 하루씩 차곡차곡 충전 중
      </div>
    </section>
  )
}
