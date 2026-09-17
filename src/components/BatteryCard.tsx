import type { CSSProperties } from 'react'
import { SolarIcon, type SolarIconName } from './Icon'
import { formatDateKeyShort, formatPercent } from '../lib/time'
import type { SemesterMetrics } from '../types'

interface BatteryCardProps {
  metrics: SemesterMetrics
  isTodaySchoolDay: boolean
}

interface Tone {
  name: 'red' | 'orange' | 'yellow' | 'green'
  label: string
  icon: SolarIconName
  color: string
}

/**
 * 애플 시스템 상태색을 그대로 쓴다.
 * 진행률은 색이 아니라 숫자와 막대로 읽히게 하고, 색은 의미(위험/주의/충분)만 전달한다.
 */
function getTone(progress: number): Tone {
  if (progress <= 25) return { name: 'red', label: '아직 갈 길이 멀어요', icon: 'danger-triangle-bold', color: 'var(--danger)' }
  if (progress <= 50) return { name: 'orange', label: '조금씩 적응 중이에요', icon: 'graph-up-bold', color: 'var(--warning)' }
  if (progress <= 75) return { name: 'yellow', label: '절반을 넘었습니다', icon: 'stars-bold', color: 'var(--warning)' }
  return { name: 'green', label: '방학이 보여요!', icon: 'check-circle-bold', color: 'var(--success)' }
}

export function BatteryCard({ metrics, isTodaySchoolDay }: BatteryCardProps) {
  const tone: Tone = metrics.phase === 'vacation'
    ? { name: 'green', label: '방학 모드 · 완전 충전', icon: 'confetti-bold', color: 'var(--success)' }
    : getTone(metrics.progress)

  const progress = formatPercent(metrics.progress, 1)
  const fillRatio = Math.min(1, Math.max(0.01, metrics.progress / 100))

  const note = metrics.phase === 'before-semester'
    ? `개학 ${formatDateKeyShort(metrics.startDate)}부터 시작`
    : metrics.phase === 'vacation'
      ? `${formatDateKeyShort(metrics.vacationDate)}부터 방학 · 100%`
      : isTodaySchoolDay
        ? `오늘은 ${metrics.elapsedSchoolDays + 1}번째 수업일`
        : '오늘은 수업일이 아니라 계산에서 제외'

  return (
    <section className="surface-card battery-card reveal">
      <div className="battery-head">
        <div className="battery-title">
          <div className="battery-icon"><SolarIcon name="battery-charge-bold" size={18} /></div>
          <div>
            <h2>방학 D-Day 게이지</h2>
            <p className="card-subtitle">수업일 기준으로 학기 진행률을 계산합니다</p>
          </div>
        </div>
        <div className="battery-status" title={tone.label}>
          <SolarIcon name={tone.icon} size={18} />
        </div>
      </div>

      {/* 좌: 큰 D-Day — 우: 잔여 %와 잔여 수업일. 두 축이 같은 무게로 읽히게 맞춘다. */}
      <div className="battery-main">
        <div className="battery-top-row">
          <div className="battery-dday">
            <span className="battery-dday-label">{metrics.phase === 'vacation' ? '방학 진행 중' : '방학까지'}</span>
            {metrics.phase === 'vacation'
              ? <span className="battery-dday-value is-vacation">방학 중</span>
              : <span className="battery-dday-value">D-{metrics.calendarDaysRemaining}<span>일</span></span>}
          </div>
          <div className="battery-charge">
            <span className="battery-charge-label">생존 배터리</span>
            <span className="battery-charge-value">{progress}<span>%</span></span>
            <span className="battery-charge-sub">잔여 수업일 {metrics.schoolDaysRemaining}일</span>
          </div>
        </div>

        <div
          className="battery-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Number(progress)}
          aria-valuetext={`생존 배터리 ${progress}퍼센트, 방학까지 ${metrics.schoolDaysRemaining}수업일`}
        >
          <div className="battery-fill" style={{ '--fill': fillRatio } as CSSProperties} />
        </div>

        <div className="battery-scale">
          <span><SolarIcon name="calendar-bold" size={14} /> {formatDateKeyShort(metrics.startDate)} 시작</span>
          <span>{formatDateKeyShort(metrics.vacationDate)} 방학 →</span>
        </div>

        <div className="battery-foot">
          <span className="tone-dot" style={{ color: tone.color }} aria-hidden="true" />
          <span>{tone.label} · {note}</span>
        </div>

        {!metrics.isConfigured && (
          <div className="battery-warning">
            <SolarIcon name="danger-circle-bold" size={16} />
            학기 시작일과 방학일을 설정하면 배터리가 채워집니다.
          </div>
        )}
      </div>
    </section>
  )
}
