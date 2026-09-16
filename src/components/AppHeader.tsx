import type { CSSProperties } from 'react'
import { SolarIcon } from './Icon'
import type { NotificationState } from '../lib/notify'
import type { TickerSource } from '../lib/useNow'
import type { ResolvedTheme, ThemeMode } from '../types'

interface AppHeaderProps {
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  soundEnabled: boolean
  notifyEnabled: boolean
  notificationState: NotificationState
  tickerSource: TickerSource
  isOffline: boolean
  isFullscreen: boolean
  onCycleTheme: () => void
  onToggleSound: () => void
  onToggleNotifications: () => void
  onToggleFullscreen: () => void
  onOpenSettings: () => void
}

const revealStyle = { '--index': 0 } as CSSProperties

const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  dark: '다크 모드',
  light: '라이트 모드',
  system: '시스템 설정 따름',
}

const NEXT_THEME_ICON: Record<ThemeMode, 'sun-2-bold' | 'moon-bold' | 'monitor-smartphone-bold'> = {
  dark: 'sun-2-bold',
  light: 'monitor-smartphone-bold',
  system: 'moon-bold',
}

export function AppHeader({
  themeMode,
  resolvedTheme,
  soundEnabled,
  notifyEnabled,
  notificationState,
  tickerSource,
  isOffline,
  isFullscreen,
  onCycleTheme,
  onToggleSound,
  onToggleNotifications,
  onToggleFullscreen,
  onOpenSettings,
}: AppHeaderProps) {
  const notificationsActive = notifyEnabled && notificationState === 'granted'

  return (
    <header className="topbar reveal" style={revealStyle}>
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          <SolarIcon name="battery-charge-bold" size={25} />
          <span className="brand-mark-spark" />
        </div>
        <div className="brand-copy">
          <p className="brand-kicker">SCHOOL SURVIVAL CLOCK</p>
          <h1>교사 생존 배터리 <span>&amp; 시간표 레이더</span></h1>
        </div>
      </div>

      <div className="header-actions">
        <div className="header-chips">
          <p className="live-chip" title="한국 표준시(Asia/Seoul) 기준으로 계산합니다">
            <span className="live-dot" aria-hidden="true" />
            <span>KST LIVE</span>
          </p>
          <p
            className={`status-chip ${tickerSource === 'worker' ? 'is-good' : 'is-soft'}`}
            title={
              tickerSource === 'worker'
                ? '백그라운드 워커가 시계를 구동해 탭을 숨겨도 초가 밀리지 않습니다'
                : '이 브라우저에서는 메인 스레드 타이머를 사용합니다 (드래프트 보정 적용)'
            }
          >
            <SolarIcon name={tickerSource === 'worker' ? 'bolt-bold' : 'clock-circle-bold'} size={12} />
            <span>{tickerSource === 'worker' ? 'DRIFT-FREE' : 'DRIFT-FIXED'}</span>
          </p>
          {isOffline && (
            <p className="status-chip is-warn" title="네트워크가 끊겨도 저장된 설정과 캐시로 계속 동작합니다">
              <SolarIcon name="cloud-download-bold" size={12} />
              <span>OFFLINE</span>
            </p>
          )}
        </div>

        <div className="header-buttons">
          <button
            className={`icon-button ${soundEnabled ? 'is-active' : ''}`}
            type="button"
            onClick={onToggleSound}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? '알림 소리 끄기' : '알림 소리 켜기'}
            title={soundEnabled ? '알림 소리 켜짐 · 클릭하면 음소거' : '알림 소리 꺼짐 · 클릭하면 켜짐'}
          >
            <SolarIcon name={soundEnabled ? 'volume-bold' : 'volume-cross-bold'} size={17} />
          </button>
          <button
            className={`icon-button ${notificationsActive ? 'is-active' : ''}`}
            type="button"
            onClick={onToggleNotifications}
            aria-pressed={notificationsActive}
            aria-label={notificationsActive ? '브라우저 알림 끄기' : '브라우저 알림 켜기'}
            title={
              notificationState === 'unsupported'
                ? '이 브라우저는 알림을 지원하지 않습니다'
                : notificationState === 'denied'
                  ? '브라우저에서 알림이 차단되어 있습니다 (사이트 권한을 허용해 주세요)'
                  : notificationsActive
                    ? '브라우저 알림 켜짐'
                    : '브라우저 알림 켜기 (권한 요청)'
            }
          >
            <SolarIcon name={notificationsActive ? 'bell-ring-bold' : 'bell-off-bold'} size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onCycleTheme}
            aria-label={`테마 전환 · 현재 ${THEME_MODE_LABELS[themeMode]}`}
            title={`테마: ${THEME_MODE_LABELS[themeMode]} (클릭하면 다음 모드로)`
            }
          >
            <SolarIcon name={NEXT_THEME_ICON[themeMode]} size={17} />
            <span className="icon-button-badge" aria-hidden="true">
              {resolvedTheme === 'dark' ? 'D' : 'L'}
            </span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onToggleFullscreen}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? '전체 화면 종료 (F)' : '전체 화면으로 보기 (F)'}
            title={isFullscreen ? '전체 화면 종료 (F)' : '전체 화면 (F)'}
          >
            <SolarIcon name={isFullscreen ? 'minimize-square-bold' : 'maximize-square-3-bold'} size={17} />
          </button>
          <button className="settings-button" type="button" onClick={onOpenSettings} title="내 설정 (S)">
            <SolarIcon name="settings-bold" size={16} />
            <span>내 설정</span>
            <kbd className="key-hint" aria-hidden="true">S</kbd>
          </button>
        </div>
      </div>
    </header>
  )
}
