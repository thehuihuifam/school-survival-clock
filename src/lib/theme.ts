import { useEffect, useState } from 'react'
import type { ResolvedTheme, ThemeMode } from '../types'

/** Keep in sync with the inline bootstrap in `index.html`. */
export const THEME_ATTRIBUTE = 'data-theme'
const THEME_COLOR_BY_THEME: Record<ResolvedTheme, string> = {
  dark: '#09090b',
  light: '#f6f7f5',
}

function prefersDarkColorScheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(mode: ThemeMode, systemPrefersDark = prefersDarkColorScheme()): ResolvedTheme {
  if (mode === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }
  return mode
}

/** Reflect the resolved theme on `<html>` so CSS, meta and the SW all agree. */
export function applyTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') {
    return
  }
  const root = document.documentElement
  root.setAttribute(THEME_ATTRIBUTE, theme)
  root.style.colorScheme = theme

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) {
    meta.content = THEME_COLOR_BY_THEME[theme]
  }
}

/**
 * Resolve a `ThemeMode` into `dark`/`light` and follow the OS preference live
 * while the mode is `system`.
 */
export function useResolvedTheme(mode: ThemeMode): ResolvedTheme {
  const [systemPrefersDark, setSystemPrefersDark] = useState(prefersDarkColorScheme)

  useEffect(() => {
    if (mode !== 'system' || typeof window.matchMedia !== 'function') {
      return
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    setSystemPrefersDark(query.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [mode])

  const theme = resolveTheme(mode, systemPrefersDark)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return theme
}
