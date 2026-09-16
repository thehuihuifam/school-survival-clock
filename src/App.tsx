import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AppHeader } from './components/AppHeader'
import { BatteryCard } from './components/BatteryCard'
import { CelebrationToast } from './components/CelebrationToast'
import { ClockHero } from './components/ClockHero'
import { PeriodTracker } from './components/PeriodTracker'
import { SettingsModal } from './components/SettingsModal'
import { SolarIcon } from './components/Icon'
import { detectPreAlert, detectScheduleEvent, dispatchPreAlert, dispatchScheduleEvent } from './lib/alerts'
import { documentTitleFor, greetingForHour } from './lib/copy'
import { getNotificationState } from './lib/notify'
import { subscribeInstallPrompt, type InstallPrompt } from './lib/pwa'
import { getNextSchoolDay, getScheduleStatus } from './lib/schedule'
import { getSemesterMetrics } from './lib/semester'
import { getAutoSemesterWindow } from './lib/semesterWindow'
import { loadSettings, normalizeSettings, saveSettings, subscribeToExternalSettings } from './lib/settings'
import { chimeEngine } from './lib/sound'
import { useResolvedTheme } from './lib/theme'
import { getKstTimeParts, secondsUntilDateKey } from './lib/time'
import { getUpcomingEvents } from './lib/timeline'
import { useNow } from './lib/useNow'
import { useRevealOnScroll } from './lib/reveal'
import type { DayOverride, NextSchoolDay, ThemeMode, UserSettings } from './types'

const CONFETTI_COLORS = ['#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#10b981']
const CELEBRATION_MS = 12000
const THEME_CYCLE: ThemeMode[] = ['dark', 'light', 'system']

const introRevealStyle = { '--index': 0 } as CSSProperties
const footerRevealStyle = { '--index': 2 } as CSSProperties

function App() {
  const [settings, setSettings] = useState<UserSettings>(loadSettings)
  const { now } = useNow()
  const resolvedTheme = useResolvedTheme(settings.themeMode)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  const [isCelebrationVisible, setIsCelebrationVisible] = useState(false)
  const [notificationState, setNotificationState] = useState(getNotificationState)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)

  const previousPhaseKeyRef = useRef<string | null>(null)
  const celebratedKeyRef = useRef<string | null>(null)
  const celebrationTimeoutRef = useRef<number | undefined>(undefined)
  const preAlertRef = useRef<{ initialized: boolean; lastKey: string | null }>({
    initialized: false,
    lastKey: null,
  })

  useRevealOnScroll()

  const kstNow = useMemo(() => getKstTimeParts(now), [now])
  const status = useMemo(() => getScheduleStatus(kstNow, settings), [kstNow, settings])

  const metrics = useMemo(
    () => getSemesterMetrics(kstNow, settings),
    [kstNow.dateKey, settings],
  )

  const nextSchoolDayAnchor = useMemo(
    () => getNextSchoolDay(kstNow, settings),
    [kstNow.dateKey, settings],
  )

  const nextSchoolDay = useMemo<NextSchoolDay | null>(() => {
    if (!nextSchoolDayAnchor) return null
    const secondsUntilMidnight = secondsUntilDateKey(kstNow, nextSchoolDayAnchor.dateKey)
    return {
      ...nextSchoolDayAnchor,
      secondsUntil: Math.max(0, secondsUntilMidnight),
      secondsUntilFirstPeriod: nextSchoolDayAnchor.firstPeriodSeconds === null
        ? Math.max(0, secondsUntilMidnight)
        : Math.max(0, secondsUntilMidnight + nextSchoolDayAnchor.firstPeriodSeconds),
    }
  }, [nextSchoolDayAnchor, kstNow])

  const upcoming = useMemo(
    () => getUpcomingEvents(kstNow, settings, status, nextSchoolDay, 6),
    [kstNow, settings, status, nextSchoolDay],
  )

  const preAlertSeconds = settings.preAlertEnabled ? settings.preAlertMinutes * 60 : 0
  const todayOverride: DayOverride | null = settings.dayOverrides[kstNow.dateKey] ?? null

  useEffect(() => {
    saveSettings(settings)
    chimeEngine.setEnabled(settings.soundEnabled)
  }, [settings])

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('open') === 'settings') setIsSettingsOpen(true)
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
    const key = `${dateKey}-${dismissalTime}`
    if (celebratedKeyRef.current === key) return
    celebratedKeyRef.current = key
    setIsCelebrationVisible(true)
    if (celebrationTimeoutRef.current !== undefined) window.clearTimeout(celebrationTimeoutRef.current)
    celebrationTimeoutRef.current = window.setTimeout(() => setIsCelebrationVisible(false), CELEBRATION_MS)

    void import('canvas-confetti').then(({ default: confetti }) => {
      void confetti({
        particleCount: 130,
        spread: 70,
        startVelocity: 32,
        scalar: 1.02,
        origin: { y: 0.65 },
        colors: CONFETTI_COLORS,
        disableForReducedMotion: true,
      })
      window.setTimeout(() => {
        void confetti({ particleCount: 70, spread: 100, startVelocity: 22, scalar: 0.85, origin: { x: 0.15, y: 0.8 }, colors: CONFETTI_COLORS, disableForReducedMotion: true })
        void confetti({ particleCount: 70, spread: 100, startVelocity: 22, scalar: 0.85, origin: { x: 0.85, y: 0.8 }, colors: CONFETTI_COLORS, disableForReducedMotion: true })
      }, 160)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const tracker = preAlertRef.current
    if (!tracker.initialized) {
      tracker.initialized = true
      tracker.lastKey = `${status.phaseKey}:pre-bell`
      return
    }
    const event = detectPreAlert(status, preAlertSeconds, tracker.lastKey)
    if (!event) return
    tracker.lastKey = event.key
    dispatchPreAlert(event, { sound: settings.soundEnabled, notify: settings.notifyEnabled })
  }, [status, preAlertSeconds, settings.soundEnabled, settings.notifyEnabled])

  useEffect(() => {
    setSettings((current) => {
      if (!current.semesterAuto) return current
      const w = getAutoSemesterWindow(kstNow.dateKey)
      if (current.semesterStart === w.startDate && current.vacationDate === w.vacationDate) return current
      return { ...current, semesterStart: w.startDate, vacationDate: w.vacationDate }
    })
  }, [kstNow.dateKey])

  useEffect(() => {
    setSettings((current) => {
      const pruned = normalizeSettings(current, kstNow.dateKey)
      return Object.keys(pruned.dayOverrides).length === Object.keys(current.dayOverrides).length ? current : pruned
    })
  }, [kstNow.dateKey])

  useEffect(() => {
    const prev = previousPhaseKeyRef.current
    previousPhaseKeyRef.current = status.phaseKey
    const event = detectScheduleEvent(prev, status, kstNow.daySeconds)
    if (!event) return
    dispatchScheduleEvent(event, status, { sound: settings.soundEnabled, notify: settings.notifyEnabled })
    if (event.kind === 'dismissed') triggerCelebration(kstNow.dateKey, settings.dismissalTime)
  }, [status, kstNow.daySeconds, kstNow.dateKey, settings.soundEnabled, settings.notifyEnabled, settings.dismissalTime, triggerCelebration])

  const title = documentTitleFor(status, kstNow)
  useEffect(() => { if (document.title !== title) document.title = title }, [title])

  useEffect(() => () => { if (celebrationTimeoutRef.current !== undefined) window.clearTimeout(celebrationTimeoutRef.current) }, [])

  const handleSaveSettings = (nextSettings: UserSettings) => {
    setSettings(nextSettings)
    setIsSettingsOpen(false)
    setNotificationState(getNotificationState())
    chimeEngine.play('ui')
  }

  const handleOverrideChange = useCallback((nextOverride: DayOverride | null) => {
    setSettings((current) => {
      const dayOverrides = { ...current.dayOverrides }
      if (nextOverride) dayOverrides[kstNow.dateKey] = nextOverride
      else delete dayOverrides[kstNow.dateKey]
      return { ...current, dayOverrides }
    })
    chimeEngine.play('ui')
  }, [kstNow.dateKey])

  const handleCycleTheme = useCallback(() => {
    setSettings((current) => {
      const idx = THEME_CYCLE.indexOf(current.themeMode)
      return { ...current, themeMode: THEME_CYCLE[(idx + 1) % THEME_CYCLE.length] }
    })
    chimeEngine.play('ui')
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return
      if (isSettingsOpen) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault()
          setIsSettingsOpen(true)
          break
        case 't':
          event.preventDefault()
          handleCycleTheme()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCycleTheme, isSettingsOpen])

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
          isOffline={isOffline}
          onCycleTheme={handleCycleTheme}
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
                <SolarIcon name="hand-heart-bold" size={14} />
                <span>
                  {status.phase === 'off-day'
                    ? '오늘은 교실 대신 나를 돌보는 날'
                    : status.phase === 'dismissed'
                      ? '오늘의 미션은 모두 끝났습니다'
                      : '실시간으로 응원하는 중'}
                </span>
              </p>
              {installPrompt && (
                <button type="button" className="ghost-button is-small" onClick={() => void installPrompt().then(() => setInstallPrompt(null))}>
                  <SolarIcon name="download-square-bold" size={13} /> 앱 설치
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

          <PeriodTracker now={kstNow} status={status} upcoming={upcoming} preAlertSeconds={preAlertSeconds} />
        </main>

        <footer className="app-footer reveal" style={footerRevealStyle}>
          <span>교사 생존 시계 <b>·</b> {kstNow.year} <b>·</b> Asia/Seoul</span>
          <span>단축키 S 설정 · T 테마 · 클릭으로 카운트다운 전환</span>
        </footer>
      </div>

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
