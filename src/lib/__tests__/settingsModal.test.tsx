import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SettingsModal } from '../../components/SettingsModal'
import { createDefaultSettings } from '../settings'
import { TEST_TODAY_KEY } from './helpers'
import type { UserSettings } from '../../types'

/**
 * Settings modal smoke tests (D-2).
 *
 * The modal is server-rendered with `isOpen` so the whole form tree executes
 * exactly like a first paint. That is enough to prove the inline guidance about
 * a 하교 시각 that the engine would silently clamp.
 */
function renderModal(overrides: Partial<UserSettings> = {}) {
  const settings: UserSettings = { ...createDefaultSettings(TEST_TODAY_KEY), ...overrides }
  return renderToString(
    <SettingsModal
      isOpen
      settings={settings}
      todayDateKey={TEST_TODAY_KEY}
      notificationState="default"
      onClose={() => {}}
      onSave={() => {}}
    />,
  ).replace(/<!-- -->/g, '')
}

describe('SettingsModal 하교 시각 안내', () => {
  it('warns that an early dismissal time is overridden by the last period', () => {
    // 기본 시간표는 월~목 14:50, 금 13:00에 끝난다.
    const html = renderModal({ dismissalTime: '13:00' })

    expect(html).toContain('월요일 마지막 교시가 14:50에 끝납니다')
    expect(html).toContain('하교 시각은 마지막 교시 종료 이후여야 적용됩니다.')
    expect(html).toContain('단축 하교')
  })

  it('stays quiet when the dismissal time is after every last period', () => {
    const html = renderModal({ dismissalTime: '17:00' })

    expect(html).not.toContain('하교 시각은 마지막 교시 종료 이후여야 적용됩니다.')
  })
})
