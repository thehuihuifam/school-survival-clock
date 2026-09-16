import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { SolarIcon } from './Icon'

const TEACHER_QUOTES = [
  '선생님, 4교시만 끝나면 급식입니다. 힘내세요!',
  '오늘의 생기부 작업은 내일의 나에게 양보하세요.',
  '퇴근 10분 전에는 메신저와 교무실 전화를 보지 않는 것이 국룰입니다.',
  '방학은 반드시 옵니다. 지구는 지금도 자전하고 있으니까요.',
  '아이들의 질문은 무한하지만, 선생님의 커피도 리필할 수 있습니다.',
  '오늘도 출근했다는 사실만으로 이미 충분히 잘하고 있습니다.',
  '회의는 언젠가 끝나고, 선생님은 결국 집에 도착합니다.',
  '수업 자료가 완벽하지 않아도 선생님의 진심은 이미 만점입니다.',
  '쉬는 시간 10분은 아이들 것이기도 하지만 선생님 것이기도 합니다.',
  '복도 소음이 잦아들면 그날의 절반은 이미 지나간 것입니다.',
  '답답한 하루에도 하교 벨은 정확히 울립니다. 그것이 오늘의 희망입니다.',
  '잘 안 되는 수업이 있어도 괜찮습니다. 내일 1교시는 다시 시작입니다.',
  '선생님의 컨디션이 곧 교실의 날씨입니다. 오늘 하루 따뜻하게 챙기세요.',
  '남은 교시 수보다 남은 체력을 먼저 확인해도 됩니다.',
  '아이들이 시끄러운 날은 선생님이 잘 이끌어 주고 있다는 증거이기도 합니다.',
  '오늘의 마무리는 완벽함이 아니라 퇴근입니다. 그것으로 충분합니다.',
]

const ROTATION_MS = 30 * 60 * 1000

function initialQuoteIndex() {
  return Math.floor(Date.now() / ROTATION_MS) % TEACHER_QUOTES.length
}

/** ms until the next clean 30-minute boundary. */
function msUntilNextRotation(from = Date.now()) {
  return ROTATION_MS - (from % ROTATION_MS)
}

const revealStyle = { '--index': 1 } as CSSProperties

export function QuoteCard() {
  const [quoteIndex, setQuoteIndex] = useState(initialQuoteIndex)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshQuote = useCallback(() => {
    setIsRefreshing(true)
    setQuoteIndex((current) => {
      if (TEACHER_QUOTES.length <= 1) {
        return current
      }
      let nextIndex = current
      while (nextIndex === current) {
        nextIndex = Math.floor(Math.random() * TEACHER_QUOTES.length)
      }
      return nextIndex
    })
    window.setTimeout(() => setIsRefreshing(false), 450)
  }, [])

  // Rotate on the wall-clock 30-minute boundary rather than 30 minutes after
  // mount, so two tabs opened at different times still agree — and re-arm the
  // timer after a hidden tab was throttled.
  useEffect(() => {
    let timeout = 0
    const indexFromClock = () => Math.floor(Date.now() / ROTATION_MS) % TEACHER_QUOTES.length

    const schedule = () => {
      timeout = window.setTimeout(() => {
        setQuoteIndex(indexFromClock())
        schedule()
      }, msUntilNextRotation())
    }

    const resync = () => {
      window.clearTimeout(timeout)
      setQuoteIndex(indexFromClock())
      schedule()
    }

    schedule()
    document.addEventListener('visibilitychange', resync)
    return () => {
      window.clearTimeout(timeout)
      document.removeEventListener('visibilitychange', resync)
    }
  }, [])

  return (
    <section className="surface-card quote-card reveal reveal-on-scroll" style={revealStyle}>
      <div className="quote-card-header">
        <div className="quote-title-lockup">
          <div className="section-icon quote-icon"><SolarIcon name="chat-round-like-bold" size={19} /></div>
          <div>
            <p className="eyebrow">TEACHER EMPATHY VITAMIN</p>
            <h2>선생님 공감 비타민</h2>
          </div>
        </div>
        <SolarIcon name="stars-minimalistic-bold" size={21} className="quote-sparkle" />
      </div>

      <div className="quote-body">
        <span className="quote-mark" aria-hidden="true">“</span>
        <blockquote key={quoteIndex}>{TEACHER_QUOTES[quoteIndex]}</blockquote>
        <span className="quote-mark quote-mark-end" aria-hidden="true">”</span>
      </div>

      <div className="quote-footer">
        <span><span className="quote-live-dot" aria-hidden="true" /> 30분마다 자동으로 새로운 응원</span>
        <button className="refresh-button" type="button" onClick={refreshQuote}>
          <SolarIcon name="refresh-bold" size={15} className={isRefreshing ? 'spin-once' : ''} />
          공감 한마디 새로고침
        </button>
      </div>
    </section>
  )
}
