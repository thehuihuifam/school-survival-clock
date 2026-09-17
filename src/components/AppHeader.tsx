import type { CSSProperties } from 'react'
import { SolarIcon } from './Icon'
import type { ThemeMode, ResolvedTheme } from '../types'

interface AppHeaderProps {
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  isOffline: boolean
  onCycleTheme: () => void
  onOpenSettings: () => void
}

const revealStyle = { '--index': 0 } as CSSProperties

const THEME_LABEL: Record<ThemeMode, string> = {
  dark: '다크 모드',
  light: '라이트 모드',
  system: '시스템 설정 따름',
}

/** 버튼을 누르면 넘어갈 다음 모드. 아이콘과 라벨이 같은 값을 가리키게 한다. */
const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
}

/**
 * 아이콘은 "지금 화면이 어떤 모드인지"를 나타낸다. `system`일 때는 실제로
 * 적용된 테마(`resolvedTheme`)를 보여 줘야 사용자가 현재 상태를 읽을 수 있다.
 */
const MODE_ICON: Record<ThemeMode, 'sun-2-bold' | 'moon-bold' | 'monitor-smartphone-bold'> = {
  dark: 'moon-bold',
  light: 'sun-2-bold',
  system: 'monitor-smartphone-bold',
}

export function AppHeader({
  themeMode,
  resolvedTheme,
  isOffline,
  onCycleTheme,
  onOpenSettings,
}: AppHeaderProps) {
  const nextMode = NEXT_MODE[themeMode]
  const currentLabel =
    themeMode === 'system'
      ? `${THEME_LABEL.system} · 현재 ${resolvedTheme === 'dark' ? '다크' : '라이트'}`
      : THEME_LABEL[themeMode]

  return (
    <header className="topbar reveal" style={revealStyle}>
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          <SolarIcon name="battery-charge-bold" size={20} />
        </div>
        <div className="brand-copy">
          <h1>교사 생존 시계 <span>· 시간표</span></h1>
        </div>
        {isOffline && (
          <span className="offline-dot" title="오프라인 · 저장된 화면으로 동작 중" aria-label="오프라인" />
        )}
      </div>

      <div className="header-actions">
        <button
          className="icon-button"
          type="button"
          onClick={onCycleTheme}
          aria-label={`화면 모드 전환 · 현재 ${currentLabel}, 누르면 ${THEME_LABEL[nextMode]}`}
          title={`${currentLabel} · 누르면 ${THEME_LABEL[nextMode]} (T)`}
        >
          <SolarIcon name={MODE_ICON[themeMode]} size={16} />
        </button>
        <button className="settings-button" type="button" onClick={onOpenSettings} title="내 설정 (S)">
          <SolarIcon name="settings-bold" size={14} />
          <span>설정</span>
        </button>
      </div>
    </header>
  )
}
