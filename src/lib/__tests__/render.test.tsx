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

    expect(html).toContain('방학 D-Day 게이지')
    expect(html).toContain('오늘의 시간표')
    expect(html).toContain('1교시 진행 중')
    expect(html).toContain('이번 주')
    // 장식용 영어 카피는 화면에서 완전히 사라져야 한다.
    expect(html).not.toContain('LIVE CLOCK')
    expect(html).not.toContain('CLASSROOM RADAR')
    expect(html).not.toContain('NEXT UP')
    expect(html).not.toContain("TODAY'S CREW")
    expect(html).not.toContain('SEMESTER SURVIVAL')
    expect(html).not.toContain('SCHOOL SURVIVAL CLOCK')
  })

  it('greets the teacher without repeating the honorific', () => {
    const html = renderAt('2026-09-16T23:30:00Z') // 목요일 08:30 KST

    expect(html).toContain('좋은 아침이에요, 김선생님.')
    expect(html).not.toContain('선생님, 김선생님')
  })

  it('renders the pre-school countdown before the first bell', () => {
    const html = renderAt('2026-09-16T23:30:00Z') // 목요일 08:30 KST
    expect(html).toContain('1교시까지')
    expect(html).toContain('등교 전')
  })

  it('turns on the pre-bell state inside the warning window', () => {
    const html = renderAt('2026-09-16T23:58:00Z') // 목요일 08:58 KST, 2분 전
    expect(html).toContain('예비종')
    expect(html).toContain('1교시 곧 시작')
    // 히어로 카운트다운은 '등교 전'이 아니라 '예비종'으로 바뀐다
    // (레이더 배지의 단계 라벨은 그대로 '등교 전'이다).
    expect(html).toContain('countdown-kicker">예비종<')
    expect(html).not.toContain('countdown-kicker">등교 전<')
  })

  it('renders the recovery state on a weekend', () => {
    const html = renderAt('2026-09-19T04:00:00Z') // 토요일 13:00 KST
    expect(html).toContain('쉬는 날')
    expect(html).toContain('다음 등교')
    expect(html).toContain('주말')
  })

  it('renders the dismissed state after the dismissal bell', () => {
    const html = renderAt('2026-09-17T08:00:00Z') // 목요일 17:00 KST
    expect(html).toContain('하루 완료')
    expect(html).toContain('오늘 일정 끝')
  })

  it('goes straight into the vacation state during winter break', () => {
    const html = renderAt('2027-01-10T02:00:00Z') // 겨울방학 중
    expect(html).toContain('방학 중')
    expect(html).toContain('쉬는 날')
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
    expect(html).toContain('쉬는 날')
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
    // 오늘 타임라인은 4교시에서 끝난다 (주간 카드의 다른 요일은 그대로 6교시).
    expect(html).not.toContain('slot-name">6교시<')
    expect(html).toContain('slot-name">4교시<')
  })

  /* -------------------------------------------------------------- *
   * Boundary states the dashboard must never fall out of.
   * -------------------------------------------------------------- */

  it('stays in the dismissed state at 23:59 KST', () => {
    const html = renderAt('2026-09-17T14:59:00Z') // 목요일 23:59 KST

    expect(html).toContain('하루 완료')
    expect(html).toContain('23:59')
    expect(html).toContain('26.09.17 목요일')
    // The shared HH:MM formatter renders the dismissal label here.
    expect(html).toContain('16:30 하교 · 수고하셨어요')
  })

  it('rolls over to the next school day exactly at KST midnight', () => {
    const html = renderAt('2026-09-17T15:00:00Z') // 금요일 00:00 KST

    // Date, weekday, D-Day counter and battery position all advance together.
    expect(html).toContain('26.09.18 금요일')
    expect(html).toContain('2026년 9월 18일')
    expect(html).toContain('D-110')
    expect(html).not.toContain('26.09.17')
    // The new day starts in the pre-bell state, not still dismissed.
    expect(html).toContain('등교 전')
    expect(html).toContain('1교시까지')
    expect(html).not.toContain('하루 완료')
  })

  it('counts down correctly in the pre-dawn hours of a school day', () => {
    const html = renderAt('2026-09-17T17:30:00Z') // 금요일 02:30 KST

    expect(html).toContain('등교 전')
    expect(html).toContain('6시간 30분 남음')
    expect(html).toContain('06:30:00')
    expect(html).toContain('새벽까지 고생 많으셨어요')
  })

  it('shows recovery mode when opened in the pre-dawn hours of a weekend', () => {
    const html = renderAt('2026-09-18T17:30:00Z') // 토요일 02:30 KST

    expect(html).toContain('쉬는 날')
    expect(html).toContain('주말')
    expect(html).not.toContain('하루 완료')
    // The next-school-day date comes from the shared short-date formatter.
    expect(html).toContain('다음 등교 월요일 09.21')
    expect(html).toContain('첫 일정 09:00')
  })

  it('renders the week overview with every weekday', () => {
    const html = renderAt('2026-09-17T00:10:00Z') // 목요일 09:10 KST

    expect(html).toContain('이번 주')
    for (const weekday of ['월', '화', '수', '목', '금', '토', '일']) {
      expect(html).toContain(`week-day-label">${weekday}<`)
    }
    // 목요일이 오늘로 표시된다.
    expect(html).toContain('aria-current="date"')
  })

  it('treats a built-in public holiday as a day off', () => {
    // 2026-09-25 (금) 추석. 내장 공휴일 달력이 기본으로 켜져 있어야 한다.
    const html = renderAt('2026-09-25T00:10:00Z')

    expect(html).toContain('추석')
    expect(html).toContain('쉬는 날')
    expect(html).not.toContain('1교시 진행 중')
  })

  it('never prints the same sentence twice on one screen', () => {
    const html = renderAt('2026-09-17T01:50:00Z') // 목요일 10:50 KST, 3교시
    const text = html.replace(/<[^>]*>/g, ' ')

    // 인사말은 인트로에서 한 번만. (예전에는 히어로 카드 하단에도 찍혔다.)
    const greeting = '오전 수업 화이팅이에요'
    expect(text.split(greeting).length - 1).toBe(1)

    // 교사 이름도 한 번만.
    expect(text.split('김선생님').length - 1).toBe(1)

    // '남은 수업 2시간'은 카운트다운에서 한 번만.
    // (주간 카드의 '남은 수업일 N일'은 다른 문구라 세지 않는다.)
    expect((text.match(/남은 수업 \d/g) ?? []).length).toBe(1)
    expect((text.match(/남은 수업일 \d/g) ?? []).length).toBe(1)

    // 하교 시각은 카드 부제와 타임라인 눈금에만 (히어로 칩에서 제거됨).
    expect(text.split('하교 16:30').length - 1).toBeLessThanOrEqual(1)
  })

  it('keeps the documented keyboard shortcuts in the footer', () => {
    const html = renderAt('2026-09-17T00:10:00Z')

    expect(html).toContain('S 설정')
    expect(html).toContain('T 화면 모드')
    expect(html).toContain('F 전체 화면')
    expect(html).toContain('M 소리')
    expect(html).toContain('N 알림')
  })
})
