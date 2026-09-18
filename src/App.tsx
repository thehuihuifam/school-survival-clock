import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { BatteryCard } from './components/BatteryCard'
import { CelebrationToast } from './components/CelebrationToast'
import { ClockHero } from './components/ClockHero'
import { PeriodTracker } from './components/PeriodTracker'
import { SettingsModal } from './components/SettingsModal'
import { WeekOverview } from './components/WeekOverview'
import { SolarIcon } from './components/Icon'
import { detectPreAlert, detectScheduleEvent, dispatchPreAlert, dispatchScheduleEvent } from './lib/alerts'
import { documentTitleFor, greetingForHour } from './lib/copy'
import { subscribeInstallPrompt, type InstallPrompt } from './lib/pwa'
import { dismissalTimeFor, getNextSchoolDay, getScheduleStatus } from './lib/schedule'
import { getSemesterMetrics } from './lib/semester'
import { getAutoSemesterWindow } from './lib/semesterWindow'
import { loadSettings, normalizeSettings, saveSettings, subscribeToExternalSettings } from './lib/settings'
import { chimeEngine } from './lib/sound'
import { useResolvedTheme } from './lib/theme'
import { getKstTimeParts, secondsUntilDateKey } from './lib/time'
import { getUpcomingEvents } from './lib/timeline'
import { useNow } from './lib/useNow'
import { getNotificationState, requestNotificationPermission } from './lib/notify'
import type { DayOverride, NextSchoolDay, ThemeMode, UserSettings } from './types'

const CONFETTI_COLORS = ['#2997ff', '#0066cc', '#64d2ff', '#a8d8ff', '#ffffff']
const CELEBRATION_MS = 12000
const THEME_CYCLE: ThemeMode[] = ['dark', 'light', 'system']

function App() {
  const [settings, setSettings] = useState<UserSettings>(loadSettings)
  const now = useNow()
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

  const kstNow = useMemo(() => getKstTimeParts(now), [now])
  const status = useMemo(() => getScheduleStatus(kstNow, settings), [kstNow, settings])

  const metrics = useMemo(
    () => getSemesterMetrics(kstNow, settings),
    [kstNow.dateKey, settings],
  )

  // 오늘의 수업이 끝났거나(하교 완료) 애초에 없는 날이면 앵커를 '내일 이후의
  // 등교일'로 밀어 둔다. 오늘을 그대로 앵커로 넘기면 NEXT UP 레일의 폴백이 이미
  // 지나간 오늘 시간표를 다시 채워 지난 교시를 "9시간 후"로 되살린다(D-3).
  const isTodayFinished = status.phase === 'dismissed' || !status.day.hasClasses
  const nextSchoolDayAnchor = useMemo(
    () => getNextSchoolDay(kstNow, settings, isTodayFinished ? kstNow.dateKey : undefined),
    [kstNow.dateKey, settings, isTodayFinished],
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
  // 단축 수업일에도 화면 표기는 실제 하교 시각과 일치해야 한다(설정 원본값이 아니라 오늘 기준값).
  const effectiveDismissalTime = useMemo(
    () => dismissalTimeFor(settings, kstNow.dateKey),
    [settings, kstNow.dateKey],
  )

  useEffect(() => {
    saveSettings(settings)
    chimeEngine.setEnabled(settings.soundEnabled)
    chimeEngine.setVolume(settings.soundVolume / 100)
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
    if (event.kind === 'dismissed') triggerCelebration(kstNow.dateKey, effectiveDismissalTime)
  }, [status, kstNow.daySeconds, kstNow.dateKey, settings.soundEnabled, settings.notifyEnabled, effectiveDismissalTime, triggerCelebration])

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

  /** M · 차임벨 켜기/끄기. 끌 때는 소리를 내지 않는다. */
  const handleToggleSound = useCallback(() => {
    const soundEnabled = !settings.soundEnabled
    setSettings((current) => ({ ...current, soundEnabled }))
    chimeEngine.setEnabled(soundEnabled)
    if (soundEnabled) {
      chimeEngine.unlock()
      chimeEngine.play('ui')
    }
  }, [settings.soundEnabled])

  /** N · 브라우저 알림 켜기/끄기. 켤 때만 권한을 요청한다. */
  const handleToggleNotify = useCallback(() => {
    if (settings.notifyEnabled) {
      setSettings((current) => ({ ...current, notifyEnabled: false }))
      chimeEngine.play('ui')
      return
    }
    setSettings((current) => ({ ...current, notifyEnabled: true }))
    chimeEngine.play('ui')
    void requestNotificationPermission().then((state) => {
      setNotificationState(state)
      if (state !== 'granted') {
        setSettings((latest) => ({ ...latest, notifyEnabled: false }))
      }
    })
  }, [settings.notifyEnabled])

  /** F · 전체 화면(교실 TV에 띄워 둘 때). */
  const handleToggleFullscreen = useCallback(() => {
    const element = document.documentElement
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
      return
    }
    if (typeof element.requestFullscreen === 'function') {
      void element.requestFullscreen().catch(() => {})
    }
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
        case 'f':
          event.preventDefault()
          handleToggleFullscreen()
          break
        case 'm':
          event.preventDefault()
          handleToggleSound()
          break
        case 'n':
          event.preventDefault()
          handleToggleNotify()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleCycleTheme,
    handleToggleFullscreen,
    handleToggleNotify,
    handleToggleSound,
    isSettingsOpen,
  ])

  return (
    <div className="app-shell">
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
          <section className="dashboard-intro reveal">
            <div className="intro-copy">
              <h2>{greetingForHour(kstNow.hour)}, {settings.displayName || '선생님'}.</h2>
            </div>
            {installPrompt && (
              <button
                type="button"
                className="ghost-button is-small"
                onClick={() => void installPrompt().then(() => setInstallPrompt(null))}
              >
                <SolarIcon name="download-square-bold" size={13} /> 앱 설치
              </button>
            )}
          </section>

          <section className="hero-grid" aria-label="현재 시각과 학기 진행률">
            <ClockHero
              now={kstNow}
              status={status}
              nextSchoolDay={nextSchoolDay}
              preAlertSeconds={preAlertSeconds}
              override={todayOverride}
              dismissalTime={effectiveDismissalTime}
              overrideDismissalTime={settings.dismissalTime}
              onOverrideChange={handleOverrideChange}
            />
            <BatteryCard metrics={metrics} isTodaySchoolDay={status.day.isSchoolDay && status.day.hasClasses} />
          </section>

          <PeriodTracker now={kstNow} status={status} upcoming={upcoming} preAlertSeconds={preAlertSeconds} />

          <WeekOverview now={kstNow} settings={settings} />
        </main>

        <footer className="app-footer reveal">
          <span>교사 생존 시계 <b>·</b> {kstNow.year} <b>·</b> Asia/Seoul</span>
          <span>단축키 S 설정 · T 화면 모드 · F 전체 화면 · M 소리 · N 알림</span>
        </footer>
      </div>

      <CelebrationToast
        isVisible={isCelebrationVisible}
        dismissalTime={effectiveDismissalTime}
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
