import { describe, expect, it } from 'vitest'
import { STALE_EVENT_SECONDS, alertCopy, detectScheduleEvent, eventKindForStatus } from '../alerts'
import { getScheduleStatus } from '../schedule'
import { at, settingsWith } from './helpers'

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
