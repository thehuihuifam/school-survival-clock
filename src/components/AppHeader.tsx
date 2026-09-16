import {
  BatteryCharging,
  Maximize2,
  Minimize2,
  Moon,
  Settings2,
  Sun,
} from 'lucide-react'
import type { Theme } from '../types'

interface AppHeaderProps {
  theme: Theme
  isFullscreen: boolean
  onToggleTheme: () => void
  onToggleFullscreen: () => void
  onOpenSettings: () => void
}

export function AppHeader({
  theme,
  isFullscreen,
  onToggleTheme,
  onToggleFullscreen,
  onOpenSettings,
}: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          <BatteryCharging size={25} strokeWidth={2.2} />
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
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? '전체 화면 종료' : '전체 화면으로 보기'}
          title={isFullscreen ? '전체 화면 종료' : '전체 화면으로 보기'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <button className="settings-button" type="button" onClick={onOpenSettings}>
          <Settings2 size={17} />
          <span>내 설정</span>
        </button>
      </div>
    </header>
  )
}
