import { PartyPopper, X } from 'lucide-react'

interface CelebrationToastProps {
  isVisible: boolean
  onClose: () => void
}

export function CelebrationToast({ isVisible, onClose }: CelebrationToastProps) {
  if (!isVisible) {
    return null
  }

  return (
    <div className="celebration-toast" role="status" aria-live="assertive">
      <div className="celebration-icon"><PartyPopper size={23} /></div>
      <div>
        <p className="celebration-kicker">MISSION COMPLETE · 16:30</p>
        <strong>오늘도 아이들과 함께 무사히 생존하셨습니다! 칼퇴하세요!</strong>
        <span>오늘의 선생님도 최고예요.</span>
      </div>
      <button type="button" onClick={onClose} aria-label="축하 알림 닫기"><X size={17} /></button>
    </div>
  )
}
