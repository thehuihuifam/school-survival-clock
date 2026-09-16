import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AppHeader } from './components/AppHeader'
import { BatteryCard } from './components/BatteryCard'
import { CelebrationToast } from './components/CelebrationToast'
import { ClockHero } from './components/ClockHero'
import { PeriodTracker } from './components/PeriodTracker'
import { QuoteCard } from './components/QuoteCard'
import { SettingsModal } from './components/SettingsModal'
import { SnapshotCard } from './components/SnapshotCard'
import { StatsStrip } from './components/StatsStrip'
import { SolarIcon } from './components/Icon'
import { detectPreAlert, detectScheduleEvent, dispatchPreAlert, dispatchScheduleEvent } from './lib/alerts'
import { documentTitleFor, greetingForHour } from './lib/copy'
import { getNotificationState, requestNotificationPermission } from './lib/notify'
import { subscribeInstallPrompt, type InstallPrompt } from './lib/pwa'
import {
  getNextDayOff,
  getNextSchoolDay,
  getScheduleStatus,
  getWeekContext,
  type WeekContext,
} from './lib/schedule'
import { getSemesterMetrics } from './lib/semester'
import { getAutoSemesterWindow } from './lib/semesterWindow'
import { loadSettings, normalizeSettings, saveSettings, subscribeToExternalSettings } from './lib/settings'
import { chimeEngine } from './lib/sound'
import { useResolvedTheme } from './lib/theme'
import { getKstTimeParts, secondsUntilDateKey } from './lib/time'
import { getUpcomingEvents } from './lib/timeline'
import { useNow } from './lib/useNow'
import { useRevealOnScroll } from './lib/reveal'
import type { DayOverride, NextDayOff, NextSchoolDay, ThemeMode, UserSettings } from './types'

const CONFETTI_COLORS = ['#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#10b981']
const CELEBRATION_MS = 12000
const THEME_CYCLE: ThemeMode[] = ['dark', 'light', 'system']

const introRevealStyle = { '--index': 0 } as CSSProperties
const footerRevealStyle = { '--index': 3 } as CSSProperties

function App() {
  const [settings, setSettings] = useState<UserSettings>(loadSettings)
  const { now, source } = useNow()
  const resolvedTheme = useResolvedTheme(settings.themeMode)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  const [isCelebrationVisible, setIsCelebrationVisible] = useState(false)
  const [notificationState, setNotificationState] = useState(getNotificationState)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)

  const previousPhaseKeyRef = useRef<string | null>(null)
  const celebratedKeyRef = useRef<string | null>(null)
  const celebrationTimeoutRef = useRef<number | undefined>(undefined)
  // Pre-bell bookkeeping: `initialized` keeps a page load from chiming for a
  // class that is already imminent, `lastKey` dedupes the cue per phase.
  const preAlertRef = useRef<{ initialized: boolean; lastKey: string | null }>({
    initialized: false,
    lastKey: null,
  })

  useRevealOnScroll()

  /* ---------------------------------------------------------------- *
   * Derived state
   * ---------------------------------------------------------------- */

  const kstNow = useMemo(() => getKstTimeParts(now), [now])

  const status = useMemo(() => getScheduleStatus(kstNow, settings), [kstNow, settings])

  // Day-anchored values: recomputed when the KST date or the settings change,
  // never on every tick (counting a semester's school days each second would
  // be pure waste). Only `kstNow.dateKey` is used as a dependency on purpose;
  // the live countdown seconds are re-derived from `kstNow` right below.
  const metrics = useMemo(
    () => getSemesterMetrics(kstNow, settings),
    [kstNow.dateKey, settings],
  )
  const weekAnchor = useMemo(
    () => getWeekContext(kstNow, settings),
    [kstNow.dateKey, settings],
  )
  const nextDayOffAnchor = useMemo(
    () => getNextDayOff(kstNow, settings),
    [kstNow.dateKey, settings],
  )
  const nextSchoolDayAnchor = useMemo(
    () => getNextSchoolDay(kstNow, settings),
    [kstNow.dateKey, settings],
  )

  const nextDayOff = useMemo<NextDayOff | null>(() => {
    if (!nextDayOffAnchor) {
      return null
    }
    return {
      ...nextDayOffAnchor,
      secondsUntil: Math.max(0, secondsUntilDateKey(kstNow, nextDayOffAnchor.dateKey)),
    }
  }, [nextDayOffAnchor, kstNow])

  const nextSchoolDay = useMemo<NextSchoolDay | null>(() => {
    if (!nextSchoolDayAnchor) {
      return null
    }
    const secondsUntilMidnight = secondsUntilDateKey(kstNow, nextSchoolDayAnchor.dateKey)
    return {
      ...nextSchoolDayAnchor,
      secondsUntil: Math.max(0, secondsUntilMidnight),
      secondsUntilFirstPeriod: nextSchoolDayAnchor.firstPeriodSeconds === null
        ? Math.max(0, secondsUntilMidnight)
        : Math.max(0, secondsUntilMidnight + nextSchoolDayAnchor.firstPeriodSeconds),
    }
  }, [nextSchoolDayAnchor, kstNow])

  const week = useMemo<WeekContext>(() => {
    if (!weekAnchor.weekendDateKey || weekAnchor.secondsUntilWeekend === null) {
      return weekAnchor
    }
    const secondsUntil = secondsUntilDateKey(kstNow, weekAnchor.weekendDateKey)
    return { ...weekAnchor, secondsUntilWeekend: secondsUntil > 0 ? secondsUntil : null }
  }, [weekAnchor, kstNow])

  const upcoming = useMemo(
    () => getUpcomingEvents(kstNow, settings, status, nextSchoolDay, 4),
    [kstNow, settings, status, nextSchoolDay],
  )

  /** 0 disables the pre-bell state and cue entirely. */
  const preAlertSeconds = settings.preAlertEnabled ? settings.preAlertMinutes * 60 : 0
  const todayOverride: DayOverride | null = settings.dayOverrides[kstNow.dateKey] ?? null

  /* ---------------------------------------------------------------- *
   * Side effects
   * ---------------------------------------------------------------- */

  useEffect(() => {
    saveSettings(settings)
    chimeEngine.setEnabled(settings.soundEnabled)
  }, [settings])

  // Audio contexts may only start after a real gesture: unlock on the first
  // one so the very first bell of the day is never silently dropped.
  useEffect(() => {
    const unlock = () => chimeEngine.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => subscribeToExternalSettings(setSettings), [])

  useEffect(() => subscribeInstallPrompt(setInstallPrompt), [])

  // Deep link used by the PWA manifest shortcut (`?open=settings`).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('open') === 'settings') {
      setIsSettingsOpen(true)
    }
  }, [])

  useEffect(() => {
    const updateOnline = () => setIsOffline(navigator.onLine === false)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  useEffect(() => {
    const refreshPermission = () => setNotificationState(getNotificationState())
    document.addEventListener('visibilitychange', refreshPermission)
    return () => document.removeEventListener('visibilitychange', refreshPermission)
  }, [])

  const triggerCelebration = useCallback((dateKey: string, dismissalTime: string) => {
    const celebrationKey = `${dateKey}-${dismissalTime}`
    if (celebratedKeyRef.current === celebrationKey) {
      return
    }
    celebratedKeyRef.current = celebrationKey

    setIsCelebrationVisible(true)
    if (celebrationTimeoutRef.current !== undefined) {
      window.clearTimeout(celebrationTimeoutRef.current)
    }
    celebrationTimeoutRef.current = window.setTimeout(
      () => setIsCelebrationVisible(false),
      CELEBRATION_MS,
    )

    // Confetti is a once-a-day treat, so it is code-split out of the main
    // bundle and only fetched when the dismissal moment actually arrives.
    void import('canvas-confetti')
      .then(({ default: confetti }) => {
        void confetti({
          particleCount: 150,
          spread: 75,
          startVelocity: 35,
          scalar: 1.05,
          origin: { y: 0.65 },
          colors: CONFETTI_COLORS,
          disableForReducedMotion: true,
        })
        window.setTimeout(() => {
          void confetti({
            particleCount: 80,
            spread: 110,
            startVelocity: 24,
            scalar: 0.85,
            origin: { x: 0.15, y: 0.8 },
            colors: CONFETTI_COLORS,
            disableForReducedMotion: true,
          })
          void confetti({
            particleCount: 80,
            spread: 110,
            startVelocity: 24,
            scalar: 0.85,
            origin: { x: 0.85, y: 0.8 },
            colors: CONFETTI_COLORS,
            disableForReducedMotion: true,
          })
        }, 180)
      })
      .catch(() => {
        // Offline without a cached chunk: the toast and chime still celebrate.
      })
  }, [])

  // 예비종: a single "get ready" cue when the next class enters the window.
  useEffect(() => {
    const tracker = preAlertRef.current
    if (!tracker.initialized) {
      tracker.initialized = true
      tracker.lastKey = `${status.phaseKey}:pre-bell`
      return
    }

    const event = detectPreAlert(status, preAlertSeconds, tracker.lastKey)
    if (!event) {
      return
    }
    tracker.lastKey = event.key
    dispatchPreAlert(event, { sound: settings.soundEnabled, notify: settings.notifyEnabled })
  }, [status, preAlertSeconds, settings.soundEnabled, settings.notifyEnabled])

  // An automatically managed semester window has to follow the KST date even
  // when the tab is never reloaded (a desk dashboard can stay open for weeks).
  useEffect(() => {
    setSettings((current) => {
      if (!current.semesterAuto) {
        return current
      }
      const window = getAutoSemesterWindow(kstNow.dateKey)
      if (current.semesterStart === window.startDate && current.vacationDate === window.vacationDate) {
        return current
      }
      return { ...current, semesterStart: window.startDate, vacationDate: window.vacationDate }
    })
  }, [kstNow.dateKey])

  // Expired one-day exceptions are dropped as soon as the date rolls over.
  useEffect(() => {
    setSettings((current) => {
      const pruned = normalizeSettings(current, kstNow.dateKey)
      return Object.keys(pruned.dayOverrides).length === Object.keys(current.dayOverrides).length
        ? current
        : pruned
    })
  }, [kstNow.dateKey])

  useEffect(() => {
    const previousPhaseKey = previousPhaseKeyRef.current
    previousPhaseKeyRef.current = status.phaseKey

    const event = detectScheduleEvent(previousPhaseKey, status, kstNow.daySeconds)
    if (!event) {
      return
    }

    dispatchScheduleEvent(event, status, {
      sound: settings.soundEnabled,
      notify: settings.notifyEnabled,
    })

    if (event.kind === 'dismissed') {
      triggerCelebration(kstNow.dateKey, settings.dismissalTime)
    }
  }, [status, kstNow.daySeconds, kstNow.dateKey, settings.soundEnabled, settings.notifyEnabled, settings.dismissalTime, triggerCelebration])

  const title = documentTitleFor(status, kstNow)
  useEffect(() => {
    if (document.title !== title) {
      document.title = title
    }
  }, [title])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => () => {
    if (celebrationTimeoutRef.current !== undefined) {
      window.clearTimeout(celebrationTimeoutRef.current)
    }
  }, [])

  /* ---------------------------------------------------------------- *
   * Handlers
   * ---------------------------------------------------------------- */

  const handleSaveSettings = (nextSettings: UserSettings) => {
    setSettings(nextSettings)
    setIsSettingsOpen(false)
    setNotificationState(getNotificationState())
    chimeEngine.play('ui')
  }

  const handleOverrideChange = useCallback((nextOverride: DayOverride | null) => {
    setSettings((current) => {
      const dayOverrides = { ...current.dayOverrides }
      if (nextOverride) {
        dayOverrides[kstNow.dateKey] = nextOverride
      } else {
        delete dayOverrides[kstNow.dateKey]
      }
      return { ...current, dayOverrides }
    })
    chimeEngine.play('ui')
  }, [kstNow.dateKey])

  const handleCycleTheme = useCallback(() => {
    setSettings((current) => {
      const index = THEME_CYCLE.indexOf(current.themeMode)
      return { ...current, themeMode: THEME_CYCLE[(index + 1) % THEME_CYCLE.length] }
    })
    chimeEngine.play('ui')
  }, [])

  const handleToggleSound = useCallback(() => {
    setSettings((current) => {
      const soundEnabled = !current.soundEnabled
      if (soundEnabled) {
        chimeEngine.unlock()
        chimeEngine.setEnabled(true)
        chimeEngine.play('ui')
      }
      return { ...current, soundEnabled }
    })
  }, [])

  const handleToggleNotifications = useCallback(async () => {
    const currentlyOn = settings.notifyEnabled && notificationState === 'granted'
    if (currentlyOn) {
      setSettings((current) => ({ ...current, notifyEnabled: false }))
      return
    }

    const state = await requestNotificationPermission()
    setNotificationState(state)
    setSettings((current) => ({ ...current, notifyEnabled: state === 'granted' }))
    if (state === 'granted') {
      chimeEngine.play('ui')
    }
  }, [notificationState, settings.notifyEnabled])

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) {
        return
      }
      if (isSettingsOpen) {
        return
      }

      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        return
      }

      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault()
          setIsSettingsOpen(true)
          break
        case 't':
          event.preventDefault()
          handleCycleTheme()
          break
        case 'f':
          event.preventDefault()
          void handleToggleFullscreen()
          break
        case 'm':
          event.preventDefault()
          handleToggleSound()
          break
        case 'n':
          event.preventDefault()
          void handleToggleNotifications()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCycleTheme, handleToggleFullscreen, handleToggleNotifications, handleToggleSound, isSettingsOpen])

  /* ---------------------------------------------------------------- *
   * Render
   * ---------------------------------------------------------------- */

  const introKicker = status.phase === 'off-day'
    ? 'RECOVERY DAY · NO BELL TODAY'
    : status.phase === 'dismissed'
      ? 'DAY COMPLETE · REST WELL'
      : 'A LITTLE POWER FOR A BIG DAY'

  return (
    <div className={`app-shell theme-${resolvedTheme}`}>
      <div className="background-mesh" aria-hidden="true" />
      <a className="skip-link" href="#main-content">본문 바로가기</a>

      <div className="page-wrap">
        <AppHeader
          themeMode={settings.themeMode}
          resolvedTheme={resolvedTheme}
          soundEnabled={settings.soundEnabled}
          notifyEnabled={settings.notifyEnabled}
          notificationState={notificationState}
          tickerSource={source}
          isOffline={isOffline}
          isFullscreen={isFullscreen}
          onCycleTheme={handleCycleTheme}
          onToggleSound={handleToggleSound}
          onToggleNotifications={() => void handleToggleNotifications()}
          onToggleFullscreen={() => void handleToggleFullscreen()}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <main id="main-content">
          <section className="dashboard-intro reveal" style={introRevealStyle}>
            <div className="intro-copy">
              <p className="intro-kicker">{introKicker}</p>
              <h2>{greetingForHour(kstNow.hour)}, {settings.displayName || '선생님'}.</h2>
              <p className="intro-sub">{status.day.description}</p>
            </div>
            <div className="intro-side">
              <p className="intro-side-note">
                <SolarIcon name="hand-heart-bold" size={16} />
                <span>
                  {status.phase === 'off-day'
                    ? '오늘은 교실 대신 나를 돌보는 날'
                    : status.phase === 'dismissed'
                      ? '오늘의 미션은 모두 끝났습니다'
                      : '선생님의 하루를 실시간으로 응원하는 중'}
                </span>
              </p>
              {installPrompt && (
                <button
                  type="button"
                  className="ghost-button is-small"
                  onClick={() => void installPrompt().then(() => setInstallPrompt(null))}
                >
                  <SolarIcon name="download-square-bold" size={15} /> 바탕화면 앱으로 설치
                </button>
              )}
            </div>
          </section>

          <section className="hero-grid" aria-label="현재 시각과 학기 진행률">
            <ClockHero
              now={kstNow}
              displayName={settings.displayName}
              status={status}
              nextSchoolDay={nextSchoolDay}
              preAlertSeconds={preAlertSeconds}
              override={todayOverride}
              dismissalTime={settings.dismissalTime}
              onOverrideChange={handleOverrideChange}
            />
            <BatteryCard metrics={metrics} isTodaySchoolDay={status.day.isSchoolDay && status.day.hasClasses} />
          </section>

          <StatsStrip status={status} metrics={metrics} week={week} />

          <PeriodTracker now={kstNow} status={status} upcoming={upcoming} preAlertSeconds={preAlertSeconds} />

          <section className="lower-grid" aria-label="응원 메시지와 요약">
            <QuoteCard />
            <SnapshotCard
              status={status}
              metrics={metrics}
              dismissalTime={settings.dismissalTime}
              nextDayOff={nextDayOff}
              nextEvent={upcoming[0] ?? null}
              override={todayOverride}
              isOffline={isOffline}
            />
          </section>
        </main>

        <footer className="app-footer reveal reveal-on-scroll" style={footerRevealStyle}>
          <span>
            교사 생존 배터리 <b>·</b> {kstNow.year} desk edition <b>·</b> Asia/Seoul 기준
          </span>
          <span>
            단축키 S 설정 · T 테마 · F 전체화면 · M 소리 · N 알림
            <SolarIcon name="arrow-right-up-linear" size={14} />
          </span>
        </footer>
      </div>

      <div className="grain-overlay" aria-hidden="true" />

      <CelebrationToast
        isVisible={isCelebrationVisible}
        dismissalTime={settings.dismissalTime}
        durationMs={CELEBRATION_MS}
        totalClassCount={status.totalClassCount}
        totalClassSeconds={status.totalClassSeconds}
        onClose={() => setIsCelebrationVisible(false)}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        todayDateKey={kstNow.dateKey}
        notificationState={notificationState}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  )
}

export default App
