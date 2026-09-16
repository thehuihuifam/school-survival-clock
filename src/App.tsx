import confetti from 'canvas-confetti'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AppHeader } from './components/AppHeader'
import { BatteryCard } from './components/BatteryCard'
import { CelebrationToast } from './components/CelebrationToast'
import { ClockHero } from './components/ClockHero'
import { SolarIcon } from './components/Icon'
import { PeriodTracker } from './components/PeriodTracker'
import { QuoteCard } from './components/QuoteCard'
import { SettingsModal } from './components/SettingsModal'
import { SnapshotCard } from './components/SnapshotCard'
import {
  formatDuration,
  getBatteryMetrics,
  getEffectiveDismissalSeconds,
  getKstSeconds,
  getKstTimeParts,
  getPeriodStatus,
  getSchoolDayContext,
} from './lib/time'
import { loadSettings, saveSettings } from './lib/storage'
import { useRevealOnScroll } from './lib/reveal'
import type { UserSettings } from './types'

const CONFETTI_COLORS = ['#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#10b981']

const introRevealStyle = { '--index': 1 } as CSSProperties
const footerRevealStyle = { '--index': 3 } as CSSProperties

function App() {
  const [settings, setSettings] = useState<UserSettings>(loadSettings)
  const [now, setNow] = useState(() => new Date())
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCelebrationVisible, setIsCelebrationVisible] = useState(false)
  const previousMomentRef = useRef<{ dateKey: string; seconds: number } | null>(null)
  const celebratedKeyRef = useRef<string | null>(null)
  const celebrationTimeoutRef = useRef<number | undefined>(undefined)

  useRevealOnScroll()

  useEffect(() => {
    let timeoutId: number | undefined

    const syncClock = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      setNow(new Date())
      const millisecondsUntilNextSecond = 1000 - (Date.now() % 1000) + 16
      timeoutId = window.setTimeout(syncClock, millisecondsUntilNextSecond)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncClock()
      }
    }

    syncClock()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    saveSettings(settings)
    document.documentElement.style.colorScheme = settings.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#09090b' : '#fafafa')
  }, [settings])

  const kstNow = useMemo(() => getKstTimeParts(now), [now])
  const currentSeconds = getKstSeconds(kstNow)
  const schoolDay = useMemo(
    () => getSchoolDayContext(kstNow, settings.holidayDates),
    [kstNow, settings.holidayDates],
  )
  const dismissalSeconds = getEffectiveDismissalSeconds(
    settings.dismissalTime,
    settings.schedule,
    settings.lunchStart,
    settings.lunchEnd,
  )
  const batteryMetrics = useMemo(
    () => getBatteryMetrics(kstNow, settings.semesterStart, settings.vacationDate, settings.holidayDates),
    [kstNow, settings.semesterStart, settings.vacationDate, settings.holidayDates],
  )
  const periodStatus = useMemo(
    () => getPeriodStatus(
      currentSeconds,
      settings.dismissalTime,
      settings.schedule,
      settings.lunchStart,
      settings.lunchEnd,
      schoolDay,
    ),
    [currentSeconds, schoolDay, settings.dismissalTime, settings.lunchEnd, settings.lunchStart, settings.schedule],
  )
  const countdownSeconds = schoolDay.isSchoolDay
    ? Math.max(0, dismissalSeconds - currentSeconds)
    : 0

  const triggerCelebration = useCallback(() => {
    setIsCelebrationVisible(true)
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current)
    }
    celebrationTimeoutRef.current = window.setTimeout(() => setIsCelebrationVisible(false), 10000)

    void confetti({
      particleCount: 150,
      spread: 75,
      startVelocity: 35,
      scalar: 1.05,
      origin: { y: 0.65 },
      colors: CONFETTI_COLORS,
    })
    window.setTimeout(() => {
      void confetti({
        particleCount: 80,
        spread: 110,
        startVelocity: 24,
        scalar: 0.8,
        origin: { x: 0.15, y: 0.8 },
        colors: CONFETTI_COLORS,
      })
      void confetti({
        particleCount: 80,
        spread: 110,
        startVelocity: 24,
        scalar: 0.8,
        origin: { x: 0.85, y: 0.8 },
        colors: CONFETTI_COLORS,
      })
    }, 180)
  }, [])

  useEffect(() => {
    const previous = previousMomentRef.current
    const celebrationKey = `${kstNow.dateKey}-${settings.dismissalTime}`
    const crossedDismissal = schoolDay.isSchoolDay && previous &&
      previous.dateKey === kstNow.dateKey &&
      previous.seconds < dismissalSeconds &&
      currentSeconds >= dismissalSeconds

    if (crossedDismissal && celebratedKeyRef.current !== celebrationKey) {
      celebratedKeyRef.current = celebrationKey
      triggerCelebration()
    }

    previousMomentRef.current = { dateKey: kstNow.dateKey, seconds: currentSeconds }
  }, [currentSeconds, dismissalSeconds, kstNow.dateKey, schoolDay.isSchoolDay, settings.dismissalTime, triggerCelebration])

  useEffect(() => {
    document.title = schoolDay.isWeekend
      ? '주말 휴식 · 교사 생존 배터리'
      : schoolDay.isHoliday
        ? '휴일 모드 · 교사 생존 배터리'
        : periodStatus.isAfterSchool
          ? '퇴근 완료 · 교사 생존 배터리'
          : `${formatDuration(countdownSeconds)} 남음 · 교사 생존 배터리`
  }, [countdownSeconds, periodStatus.isAfterSchool, schoolDay.isHoliday, schoolDay.isWeekend])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => () => {
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current)
    }
  }, [])

  const handleSaveSettings = (nextSettings: UserSettings) => {
    setSettings(nextSettings)
    setIsSettingsOpen(false)
  }

  const handleToggleTheme = () => {
    setSettings((current) => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }))
  }

  const handleToggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      setIsFullscreen(false)
    }
  }

  return (
    <div className={`app-shell theme-${settings.theme}`}>
      <div className="background-mesh" aria-hidden="true" />
      <div className="page-wrap">
        <AppHeader
          theme={settings.theme}
          isFullscreen={isFullscreen}
          onToggleTheme={handleToggleTheme}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <main>
          <section className="dashboard-intro reveal" style={introRevealStyle}>
            <div>
              <p className="intro-kicker">A LITTLE POWER FOR A BIG DAY</p>
              <h2>오늘도 무사히, 선생님.</h2>
            </div>
            <div className="intro-side-note">
              <SolarIcon name="hand-heart-bold" size={16} />
              {schoolDay.isSchoolDay ? '선생님의 하루를 응원하는 중' : `${schoolDay.label} · 회복을 응원하는 중`}
            </div>
          </section>

          <section className="hero-grid">
            <ClockHero
              now={kstNow}
              displayName={settings.displayName}
              dismissalTime={settings.dismissalTime}
              countdownSeconds={countdownSeconds}
              status={periodStatus}
            />
            <BatteryCard metrics={batteryMetrics} isRestDay={schoolDay.isSchoolDay === false} />
          </section>

          <PeriodTracker
            now={kstNow}
            dismissalTime={settings.dismissalTime}
            status={periodStatus}
            schedule={settings.schedule}
            lunchStart={settings.lunchStart}
            lunchEnd={settings.lunchEnd}
          />

          <section className="lower-grid">
            <QuoteCard />
            <SnapshotCard dismissalTime={settings.dismissalTime} metrics={batteryMetrics} status={periodStatus} />
          </section>
        </main>

        <footer className="app-footer reveal reveal-on-scroll" style={footerRevealStyle}>
          <span>교사 생존 배터리 <b>·</b> {kstNow.year} desk edition</span>
          <span>오늘도 충분히 잘하고 있어요 <SolarIcon name="arrow-right-up-linear" size={14} /></span>
        </footer>
      </div>

      <div className="grain-overlay" aria-hidden="true" />

      <CelebrationToast
        isVisible={isCelebrationVisible}
        dismissalTime={settings.dismissalTime}
        onClose={() => setIsCelebrationVisible(false)}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  )
}

export default App
