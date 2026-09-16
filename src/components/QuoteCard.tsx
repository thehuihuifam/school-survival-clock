import { MessageCircleHeart, RefreshCcw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

const TEACHER_QUOTES = [
  '선생님, 4교시만 끝나면 급식입니다. 힘내세요!',
  '오늘의 생기부 작업은 내일의 나에게 양보하세요.',
  '퇴근 시간 10분 전에는 절대 메신저와 교무실 전화를 보지 마세요.',
  '방학은 반드시 옵니다. 지구는 자전하고 있으니까요.',
  '아이들의 질문은 무한하지만, 선생님의 커피도 리필할 수 있습니다.',
  '오늘도 출근했다는 사실만으로 이미 충분히 잘하고 있습니다.',
  '회의는 언젠가 끝나고, 선생님은 결국 집에 도착합니다.',
  '수업 자료가 완벽하지 않아도 선생님의 진심은 이미 만점입니다.',
]

function getInitialQuoteIndex() {
  const halfHourBucket = Math.floor(Date.now() / (30 * 60 * 1000))
  return halfHourBucket % TEACHER_QUOTES.length
}

export function QuoteCard() {
  const [quoteIndex, setQuoteIndex] = useState(getInitialQuoteIndex)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshQuote = () => {
    setIsRefreshing(true)
    setQuoteIndex((current) => {
      let nextIndex = current
      while (nextIndex === current) {
        nextIndex = Math.floor(Math.random() * TEACHER_QUOTES.length)
      }
      return nextIndex
    })
    window.setTimeout(() => setIsRefreshing(false), 450)
  }

  useEffect(() => {
    const interval = window.setInterval(refreshQuote, 30 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="surface-card quote-card">
      <div className="quote-card-header">
        <div className="quote-title-lockup">
          <div className="section-icon quote-icon"><MessageCircleHeart size={19} /></div>
          <div>
            <p className="eyebrow">TEACHER EMPATHY VITAMIN</p>
            <h2>선생님 공감 비타민</h2>
          </div>
        </div>
        <Sparkles className="quote-sparkle" size={21} />
      </div>

      <div className="quote-body">
        <span className="quote-mark">“</span>
        <blockquote key={quoteIndex}>{TEACHER_QUOTES[quoteIndex]}</blockquote>
        <span className="quote-mark quote-mark-end">”</span>
      </div>

      <div className="quote-footer">
        <span><span className="quote-live-dot" /> 30분마다 새로운 응원</span>
        <button className="refresh-button" type="button" onClick={refreshQuote}>
          <RefreshCcw size={15} className={isRefreshing ? 'spin-once' : ''} />
          공감 한마디 새로고침
        </button>
      </div>
    </section>
  )
}
