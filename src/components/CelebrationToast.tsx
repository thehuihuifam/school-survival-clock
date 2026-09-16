import { SolarIcon } from './Icon'

interface CelebrationToastProps {
  isVisible: boolean
  dismissalTime: string
  onClose: () => void
}

export function CelebrationToast({ isVisible, dismissalTime, onClose }: CelebrationToastProps) {
  if (!isVisible) {
    return null
  }

  return (
    <div className="celebration-toast" role="status" aria-live="assertive">
      <div className="celebration-icon"><SolarIcon name="confetti-bold" size={23} /></div>
      <div>
        <p className="celebration-kicker">MISSION COMPLETE · {dismissalTime}</p>
        <strong>오늘도 아이들과 함께 무사히 생존하셨습니다! 칼퇴하세요!</strong>
        <span>오늘의 선생님도 최고예요.</span>
      </div>
      <button type="button" onClick={onClose} aria-label="축하 알림 닫기">
        <SolarIcon name="close-circle-bold" size={17} />
      </button>
    </div>
  )
}
