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
const NEXT_ICON: Record<ThemeMode, 'sun-2-bold' | 'moon-bold' | 'monitor-smartphone-bold'> = {
  dark: 'sun-2-bold',
  light: 'monitor-smartphone-bold',
  system: 'moon-bold',
}

export function AppHeader({
  themeMode,
  resolvedTheme: _resolvedTheme,
  isOffline,
  onCycleTheme,
  onOpenSettings,
}: AppHeaderProps) {
  return (
    <header className="topbar reveal" style={revealStyle}>
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          <SolarIcon name="battery-charge-bold" size={20} />
        </div>
        <div className="brand-copy">
          <p className="brand-kicker">SCHOOL SURVIVAL CLOCK</p>
          <h1>교사 생존 시계 <span>· 시간표</span></h1>
        </div>
        {isOffline && <span className="offline-dot" title="오프라인 · 캐시로 동작 중" aria-label="오프라인" />}
      </div>

      <div className="header-actions">
        <button
          className="icon-button"
          type="button"
          onClick={onCycleTheme}
          aria-label={`테마 전환 · 현재 ${THEME_LABEL[themeMode]}`}
          title={`${THEME_LABEL[themeMode]} · 클릭하면 전환`}
        >
          <SolarIcon name={NEXT_ICON[themeMode]} size={16} />
        </button>
        <button className="settings-button" type="button" onClick={onOpenSettings} title="내 설정 (S)">
          <SolarIcon name="settings-bold" size={14} />
          <span>설정</span>
        </button>
      </div>
    </header>
  )
}
