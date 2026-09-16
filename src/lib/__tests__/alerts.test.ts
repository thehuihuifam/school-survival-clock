import { describe, expect, it } from 'vitest'
import {
  STALE_EVENT_SECONDS,
  alertCopy,
  detectPreAlert,
  detectScheduleEvent,
  eventKindForStatus,
  preAlertCopy,
} from '../alerts'
import { getScheduleStatus } from '../schedule'
import { at, settingsWith } from './helpers'
import type { TimetablePeriod } from '../../types'

describe('detectScheduleEvent', () => {
  const settings = settingsWith()

  it('returns null while the phase is unchanged', () => {
    const status = getScheduleStatus(at('2026-09-17T00:10:00Z'), settings)
    expect(detectScheduleEvent(status.phaseKey, status, at('2026-09-17T00:10:00Z').daySeconds)).toBeNull()
  })

  it('detects a fresh class start', () => {
    const now = at('2026-09-17T00:41:00Z') // 09:41 KST → 쉬는 시간
    const status = getScheduleStatus(now, settings)
    const event = detectScheduleEvent('2026-09-17:in-slot:p1', status, now.daySeconds)

    expect(event?.kind).toBe('break-started')
    expect(event?.ageSeconds).toBeLessThanOrEqual(STALE_EVENT_SECONDS)
  })

  it('suppresses transitions that happened long ago', () => {
    const now = at('2026-09-17T02:00:00Z') // 11:00 KST, 3교시 started 10 minutes ago
    const status = getScheduleStatus(now, settings)
    const staleNow = { ...now, daySeconds: status.phaseStartSeconds + STALE_EVENT_SECONDS + 30 }
    expect(detectScheduleEvent('2026-09-17:in-slot:p2', status, staleNow.daySeconds)).toBeNull()
  })

  it('never rings a bell for the pre-school phase', () => {
    const status = getScheduleStatus(at('2026-09-16T23:00:00Z'), settings)
    expect(eventKindForStatus(status)).toBe('before-first-slot')
    expect(detectScheduleEvent('other-key', status, at('2026-09-16T23:00:00Z').daySeconds)).toBeNull()
  })

  it('produces human copy for every ringing event', () => {
    const status = getScheduleStatus(at('2026-09-17T07:30:00Z'), settings) // 16:30 dismissal
    const event = detectScheduleEvent('2026-09-17:in-slot:after-school', status, status.phaseStartSeconds)
    expect(event?.kind).toBe('dismissed')
    const copy = alertCopy(event!, status)
    expect(copy.title).toContain('퇴근')
    expect(copy.body.length).toBeGreaterThan(0)
  })
})

describe('detectPreAlert', () => {
  const settings = settingsWith()
  const THREE_MINUTES = 3 * 60

  it('rings once when the next class enters the window', () => {
    const status = getScheduleStatus(at('2026-09-16T23:58:00Z'), settings) // 목 08:58 KST
    const event = detectPreAlert(status, THREE_MINUTES, 'already-played')

    expect(event?.slot.label).toBe('1교시')
    expect(event?.secondsRemaining).toBe(2 * 60)
    // A second tick inside the same phase stays silent.
    expect(detectPreAlert(status, THREE_MINUTES, event!.key)).toBeNull()
  })

  it('rings during the break that precedes the class', () => {
    // 09:47 KST: the 09:40~09:50 break is running, so 2교시 starts in 3 minutes.
    const status = getScheduleStatus(at('2026-09-17T00:47:00Z'), settings)
    expect(status.activeSlot?.kind).toBe('break')

    const event = detectPreAlert(status, THREE_MINUTES, 'already-played')
    expect(event?.slot.label).toBe('2교시')
    expect(event?.secondsRemaining).toBe(3 * 60)
    expect(detectPreAlert(status, THREE_MINUTES, event!.key)).toBeNull()
  })

  it('stays silent early in a break and during a class', () => {
    const earlyBreak = getScheduleStatus(at('2026-09-17T00:41:00Z'), settings) // 09:41 KST
    expect(detectPreAlert(earlyBreak, THREE_MINUTES, 'already-played')).toBeNull()

    const duringClass = getScheduleStatus(at('2026-09-17T00:30:00Z'), settings) // 09:30 KST
    expect(duringClass.activeSlot?.kind).toBe('class')
    expect(detectPreAlert(duringClass, THREE_MINUTES, 'already-played')).toBeNull()
  })

  it('stays silent before the window and when the cue is turned off', () => {
    const early = getScheduleStatus(at('2026-09-16T23:30:00Z'), settings) // 08:30 KST
    expect(detectPreAlert(early, THREE_MINUTES, 'already-played')).toBeNull()
    const inWindow = getScheduleStatus(at('2026-09-16T23:58:00Z'), settings)
    expect(detectPreAlert(inWindow, 0, 'already-played')).toBeNull()
  })

  it('skips the very first evaluation after a page load', () => {
    const status = getScheduleStatus(at('2026-09-16T23:58:00Z'), settings)
    expect(detectPreAlert(status, THREE_MINUTES, null)).toBeNull()
  })

  it('never pre-announces a break or lunch block', () => {
    const microGap = settingsWith()
    const periods: TimetablePeriod[] = [
      { id: 'p1', label: '1교시', kind: 'class', start: '09:00', end: '09:40' },
      { id: 'p2', label: '2교시', kind: 'class', start: '09:43', end: '10:23' },
    ]
    microGap.timetables['4'] = { enabled: true, periods }

    // 09:41 KST sits in the three minute gap before 2교시 → the *next* block is
    // a real class, so the cue still fires…
    const beforeClass = getScheduleStatus(at('2026-09-17T00:41:00Z'), microGap)
    expect(beforeClass.nextSlot?.kind).toBe('class')
    expect(detectPreAlert(beforeClass, THREE_MINUTES, 'already-played')?.slot.label).toBe('2교시')

    // …while a gap in front of 점심 (kind: lunch) stays silent.
    const lunchGap = settingsWith()
    lunchGap.timetables['4'] = {
      enabled: true,
      periods: [
        { id: 'p1', label: '1교시', kind: 'class', start: '09:00', end: '09:40' },
        { id: 'lunch', label: '점심시간 및 급식', kind: 'lunch', start: '09:43', end: '10:30' },
      ],
    }
    const beforeLunch = getScheduleStatus(at('2026-09-17T00:41:00Z'), lunchGap)
    expect(beforeLunch.nextSlot?.kind).toBe('lunch')
    expect(detectPreAlert(beforeLunch, THREE_MINUTES, 'already-played')).toBeNull()
  })

  it('writes a human notification for the cue', () => {
    const status = getScheduleStatus(at('2026-09-16T23:58:00Z'), settings)
    const event = detectPreAlert(status, THREE_MINUTES, 'already-played')!
    const copy = preAlertCopy(event)

    expect(copy.title).toContain('1교시')
    expect(copy.body).toContain('09:00')
  })
})
