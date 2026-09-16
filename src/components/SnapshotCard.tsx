import { CalendarCheck2, HardDrive, Target, TimerReset } from 'lucide-react'
import type { BatteryMetrics } from '../types'

interface SnapshotCardProps {
  dismissalTime: string
  metrics: BatteryMetrics
}

export function SnapshotCard({ dismissalTime, metrics }: SnapshotCardProps) {
  return (
    <section className="surface-card snapshot-card">
      <div className="snapshot-header">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot violet" /> LITTLE CHECKPOINTS</p>
          <h2>오늘의 생존 스냅샷</h2>
        </div>
        <div className="snapshot-check"><HardDrive size={16} /> 자동 저장됨</div>
      </div>

      <div className="snapshot-list">
        <div className="snapshot-row">
          <span className="snapshot-row-icon mint"><Target size={17} /></span>
          <div><span>퇴근 목표</span><strong>{dismissalTime} <small>KST</small></strong></div>
          <span className="snapshot-row-status">정시 도전</span>
        </div>
        <div className="snapshot-row">
          <span className="snapshot-row-icon peach"><CalendarCheck2 size={17} /></span>
          <div><span>다음 큰 이벤트</span><strong>방학까지 D-{metrics.daysRemaining}</strong></div>
          <span className="snapshot-row-status">충전 중</span>
        </div>
        <div className="snapshot-row">
          <span className="snapshot-row-icon lavender"><TimerReset size={17} /></span>
          <div><span>생존 루틴</span><strong>한 시간씩, 한 교시씩</strong></div>
          <span className="snapshot-row-status">잘하고 있어요</span>
        </div>
      </div>

      <p className="snapshot-note">이 화면을 책상 한 켠에 띄워두고, 오늘의 나에게 작은 박수를 보내주세요.</p>
    </section>
  )
}
