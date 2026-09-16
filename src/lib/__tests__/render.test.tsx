import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from '../../App'
import { STORAGE_KEY, createDefaultSettings } from '../settings'
import { TEST_TODAY_KEY } from './helpers'
import type { DayOverride, UserSettings } from '../../types'

/**
 * Server-render smoke tests.
 *
 * Rendering the whole tree with `renderToString` executes every component's
 * render path (effects are skipped, exactly like a first paint) without needing
 * a browser, so the conditional branches — school day, pre-school, day off,
 * dismissed, vacation, one-day exception — are all proven crash-free.
 */
function renderAt(isoUtc: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(isoUtc))
  try {
    // React SSR separates adjacent text nodes with `<!-- -->`; strip them so
    // the assertions can look for the sentence the teacher actually reads.
    return renderToString(<App />).replace(/<!-- -->/g, '')
  } finally {
    vi.useRealTimers()
  }
}

/** Render the app as if a teacher had these settings stored in this browser. */
function renderWithStoredSettings(isoUtc: string, overrides: Partial<UserSettings> & { dayOverride?: DayOverride }) {
  const { dayOverride, ...rest } = overrides
  const stored = {
    ...createDefaultSettings(TEST_TODAY_KEY),
    ...rest,
    ...(dayOverride ? { dayOverrides: { [TEST_TODAY_KEY]: dayOverride } } : {}),
  }

  const store = new Map<string, string>([[STORAGE_KEY, JSON.stringify(stored)]])
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
    },
  })

  vi.useFakeTimers()
  vi.setSystemTime(new Date(isoUtc))
  try {
    return renderToString(<App />).replace(/<!-- -->/g, '')
  } finally {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
}

describe('App render', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders a full school day dashboard', () => {
    const html = renderAt('2026-09-17T00:10:00Z') // 목요일 09:10 KST

    expect(html).toContain('LIVE CLOCK')
    expect(html).toContain('방학 D-Day 게이지')
    expect(html).toContain('오늘의 시간표 레이더')
    expect(html).toContain('1교시 진행 중')
    // Quote and Snapshot cards removed to reduce duplication
    expect(html).not.toContain('선생님 공감 비타민')
    expect(html).not.toContain('오늘의 생존 스냅샷')
  })

  it('greets the teacher without repeating the honorific', () => {
    const html = renderAt('2026-09-16T23:30:00Z') // 목요일 08:30 KST

    expect(html).toContain('좋은 아침이에요, 김선생님.')
    expect(html).not.toContain('선생님, 김선생님')
  })

  it('renders the pre-school countdown before the first bell', () => {
    const html = renderAt('2026-09-16T23:30:00Z') // 목요일 08:30 KST
    expect(html).toContain('1교시까지')
    expect(html).toContain('BEFORE THE BELL')
  })

  it('turns on the pre-bell state inside the warning window', () => {
    const html = renderAt('2026-09-16T23:58:00Z') // 목요일 08:58 KST, 2분 전
    expect(html).toContain('GET READY · 예비종')
    expect(html).toContain('1교시 곧 시작')
    expect(html).not.toContain('BEFORE THE BELL')
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

  it('goes straight into the vacation state during winter break', () => {
    const html = renderAt('2027-01-10T02:00:00Z') // 겨울방학 중
    expect(html).toContain('방학 중')
    expect(html).toContain('RECOVERY MODE')
    expect(html).not.toContain('D-0')
  })

  it('never strands a fresh install in a hard-coded vacation', () => {
    // The v2 defaults froze the semester at 2026-08-25 → 2026-12-31, so every
    // later date read as 방학 with the battery pinned at 100%.
    const html = renderAt('2031-05-05T02:00:00Z') // 월요일 11:00 KST

    expect(html).not.toContain('방학 중')
    expect(html).toContain('학교 가는 날')
    expect(html).toContain('5교시') // 2031-05-05 is a Monday with the default timetable
  })

  it('marks a one-day 휴업 exception as an off day', () => {
    const html = renderWithStoredSettings('2026-09-17T00:10:00Z', {
      dayOverride: { kind: 'off', label: '재량휴업', dismissalTime: '' },
    })

    expect(html).toContain('재량휴업')
    expect(html).toContain('RECOVERY MODE')
    expect(html).not.toContain('학교 가는 날')
    // The weekday timetable must not leak into the exception day.
    expect(html).toContain('오늘은 수업이 없어요')
    expect(html).not.toContain('1교시 09:00 ~ 09:40')
  })

  it('cuts a 단축 day short for that date only', () => {
    const html = renderWithStoredSettings('2026-09-17T00:10:00Z', {
      dayOverride: { kind: 'short', label: '단축 수업', dismissalTime: '13:00' },
    })

    expect(html).toContain('단축 하교 13:00')
    expect(html).toContain('오늘 하루만')
    expect(html).not.toContain('6교시')
  })

  /* -------------------------------------------------------------- *
   * Boundary states the dashboard must never fall out of.
   * -------------------------------------------------------------- */

  it('stays in the dismissed state at 23:59 KST', () => {
    const html = renderAt('2026-09-17T14:59:00Z') // 목요일 23:59 KST

    expect(html).toContain('MISSION COMPLETE')
    expect(html).toContain('23:59')
    expect(html).toContain('26.09.17 목요일')
    // The shared HH:MM formatter renders the dismissal label here.
    expect(html).toContain('16:30 하교 · 수고하셨습니다')
  })

  it('rolls over to the next school day exactly at KST midnight', () => {
    const html = renderAt('2026-09-17T15:00:00Z') // 금요일 00:00 KST

    // Date, weekday, D-Day counter and battery position all advance together.
    expect(html).toContain('26.09.18 금요일')
    expect(html).toContain('2026년 9월 18일')
    expect(html).toContain('D-110')
    expect(html).not.toContain('26.09.17')
    // The new day starts in the pre-bell state, not still dismissed.
    expect(html).toContain('BEFORE THE BELL')
    expect(html).toContain('1교시까지')
    expect(html).not.toContain('MISSION COMPLETE')
  })

  it('counts down correctly in the pre-dawn hours of a school day', () => {
    const html = renderAt('2026-09-17T17:30:00Z') // 금요일 02:30 KST

    expect(html).toContain('BEFORE THE BELL')
    expect(html).toContain('6시간 30분 남음')
    expect(html).toContain('06:30:00')
    expect(html).toContain('새벽까지 고생 많으셨어요')
  })

  it('shows recovery mode when opened in the pre-dawn hours of a weekend', () => {
    const html = renderAt('2026-09-18T17:30:00Z') // 토요일 02:30 KST

    expect(html).toContain('RECOVERY MODE')
    expect(html).toContain('주말')
    expect(html).not.toContain('MISSION COMPLETE')
    // The next-school-day date comes from the shared short-date formatter.
    expect(html).toContain('다음 등교 월요일 09.21')
    expect(html).toContain('첫 일정 09:00')
  })
})
