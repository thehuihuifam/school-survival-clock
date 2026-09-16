import type { CSSProperties } from 'react'
import { SolarIcon } from './Icon'
import { formatMinutes } from '../lib/time'

interface CelebrationToastProps {
  isVisible: boolean
  dismissalTime: string
  /** How long the toast stays up, mirrored by the progress bar. */
  durationMs: number
  totalClassCount: number
  totalClassSeconds: number
  onClose: () => void
}

export function CelebrationToast({
  isVisible,
  dismissalTime,
  durationMs,
  totalClassCount,
  totalClassSeconds,
  onClose,
}: CelebrationToastProps) {
  if (!isVisible) {
    return null
  }

  const timerStyle = { '--toast-duration': `${durationMs}ms` } as CSSProperties

  return (
    <div className="celebration-toast" role="status" aria-live="assertive" style={timerStyle}>
      <div className="celebration-icon" aria-hidden="true"><SolarIcon name="confetti-bold" size={23} /></div>
      <div className="celebration-copy">
        <p className="celebration-kicker">MISSION COMPLETE · {dismissalTime}</p>
        <strong>오늘도 아이들과 함께 무사히 생존하셨습니다. 칼퇴하세요!</strong>
        <span>
          {totalClassCount > 0
            ? `${totalClassCount}교시 · ${formatMinutes(totalClassSeconds)}의 수업을 모두 마쳤습니다`
            : '오늘 일정을 모두 마쳤습니다'}
        </span>
      </div>
      <button type="button" onClick={onClose} aria-label="축하 알림 닫기">
        <SolarIcon name="close-circle-bold" size={17} />
      </button>
      <span className="celebration-timer" aria-hidden="true" />
    </div>
  )
}
