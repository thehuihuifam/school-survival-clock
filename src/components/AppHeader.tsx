import type { CSSProperties } from 'react'
import { SolarIcon } from './Icon'
import type { Theme } from '../types'

interface AppHeaderProps {
  theme: Theme
  isFullscreen: boolean
  onToggleTheme: () => void
  onToggleFullscreen: () => void
  onOpenSettings: () => void
}

const revealStyle = { '--index': 0 } as CSSProperties

export function AppHeader({
  theme,
  isFullscreen,
  onToggleTheme,
  onToggleFullscreen,
  onOpenSettings,
}: AppHeaderProps) {
  return (
    <header className="topbar reveal" style={revealStyle}>
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          <SolarIcon name="battery-charge-bold" size={25} />
          <span className="brand-mark-spark" />
        </div>
        <div>
          <p className="brand-kicker">TEACHER&apos;S SURVIVAL DASHBOARD</p>
          <h1>교사 생존 배터리 <span>&amp; 방학 D-Day</span></h1>
        </div>
      </div>

      <div className="header-actions">
        <div className="live-chip" aria-label="현재 한국 표준시 기준으로 작동 중">
          <span className="live-dot" />
          <span>KST LIVE</span>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
        >
          {theme === 'dark' ? <SolarIcon name="sun-2-bold" size={18} /> : <SolarIcon name="moon-bold" size={18} />}
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? '전체 화면 종료' : '전체 화면으로 보기'}
          title={isFullscreen ? '전체 화면 종료' : '전체 화면으로 보기'}
        >
          {isFullscreen
            ? <SolarIcon name="minimize-square-bold" size={18} />
            : <SolarIcon name="maximize-square-3-bold" size={18} />}
        </button>
        <button className="settings-button" type="button" onClick={onOpenSettings}>
          <SolarIcon name="settings-bold" size={17} />
          <span>내 설정</span>
        </button>
      </div>
    </header>
  )
}
