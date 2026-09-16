import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from '../../App'

/**
 * Server-render smoke tests.
 *
 * Rendering the whole tree with `renderToString` executes every component's
 * render path (effects are skipped, exactly like a first paint) without needing
 * a browser, so the conditional branches — school day, pre-school, day off,
 * dismissed, vacation — are all proven crash-free.
 */
function renderAt(isoUtc: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(isoUtc))
  try {
    return renderToString(<App />)
  } finally {
    vi.useRealTimers()
  }
}

describe('App render', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a full school day dashboard', () => {
    const html = renderAt('2026-09-17T00:10:00Z') // 목요일 09:10 KST

    expect(html).toContain('LIVE CLOCK')
    expect(html).toContain('방학 D-Day 충전 게이지')
    expect(html).toContain('오늘의 시간표 레이더')
    expect(html).toContain('1교시 진행 중')
    expect(html).toContain('선생님 공감 비타민')
    expect(html).toContain('오늘의 생존 스냅샷')
  })

  it('renders the pre-school countdown before the first bell', () => {
    const html = renderAt('2026-09-16T23:30:00Z') // 목요일 08:30 KST
    expect(html).toContain('1교시까지')
    expect(html).toContain('BEFORE THE BELL')
  })

  it('renders the recovery state on a weekend', () => {
    const html = renderAt('2026-09-19T04:00:00Z') // 토요일 13:00 KST
    expect(html).toContain('RECOVERY MODE')
    expect(html).toContain('다음 등교')
    expect(html).toContain('주말')
  })

  it('renders the dismissed state after the dismissal bell', () => {
    const html = renderAt('2026-09-17T08:00:00Z') // 목요일 17:00 KST
    expect(html).toContain('MISSION COMPLETE')
    expect(html).toContain('오늘 일정 완료')
  })

  it('renders during vacation without breaking the battery', () => {
    const html = renderAt('2027-01-05T02:00:00Z') // 방학 중
    expect(html).toContain('방학')
    expect(html).toContain('D-0')
  })
})
