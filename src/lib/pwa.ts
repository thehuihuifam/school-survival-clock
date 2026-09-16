import { assetUrl } from './assets'

/** Chrome/Edge install prompt, which is not part of the standard Event types. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Register the service worker that makes the dashboard work offline.
 *
 * Only in production: during development a caching worker would serve stale
 * modules between HMR updates. Failures are swallowed on purpose — a browser
 * that refuses the worker (private mode, strict sandbox) still gets the full
 * app, just without offline support.
 */
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }
  if (!import.meta.env.PROD) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(assetUrl('sw.js')).catch(() => undefined)
  })
}

export type InstallPrompt = () => Promise<boolean>

/**
 * Capture `beforeinstallprompt` so the UI can offer a real "install" action
 * instead of leaving users to hunt through browser menus.
 */
export function subscribeInstallPrompt(handler: (prompt: InstallPrompt | null) => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  let captured: BeforeInstallPromptEvent | null = null

  const onPrompt = (event: Event) => {
    event.preventDefault()
    captured = event as BeforeInstallPromptEvent
    handler(async () => {
      if (!captured) {
        return false
      }
      await captured.prompt()
      const choice = await captured.userChoice
      captured = null
      handler(null)
      return choice.outcome === 'accepted'
    })
  }

  const onInstalled = () => {
    captured = null
    handler(null)
  }

  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)

  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  }
}
