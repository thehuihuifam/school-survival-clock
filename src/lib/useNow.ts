import { useEffect, useRef, useState } from 'react'

export type TickerSource = 'worker' | 'main-thread'

export interface NowState {
  /** Authoritative instant, updated about once per second. */
  now: Date
  /** Which clock is driving the UI (surfaced in the header status chip). */
  source: TickerSource
}

const INTERVAL_MS = 1000
const MIN_DELAY_MS = 40

/**
 * Drift-corrected 1 Hz clock.
 *
 * A dedicated worker (`tick.worker.ts`) drives the updates so background tabs
 * keep ticking; if workers are unavailable the same boundary-aligned algorithm
 * runs on the main thread. Either way the rendered time is always derived from
 * an absolute `Date.now()` sample, and a `visibilitychange` forces an instant
 * resync — so a sleeping laptop or a throttled tab can never leave the
 * countdown behind.
 */
export function useNow(): NowState {
  const [now, setNow] = useState(() => new Date())
  const [source, setSource] = useState<TickerSource>('main-thread')
  const timeoutRef = useRef<number | undefined>(undefined)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    let disposed = false

    const publish = (epochMs: number) => {
      if (!disposed) {
        setNow(new Date(epochMs))
      }
    }

    const startMainThreadTicker = () => {
      const loop = () => {
        const now = Date.now()
        publish(now)
        timeoutRef.current = window.setTimeout(loop, Math.max(MIN_DELAY_MS, INTERVAL_MS - (now % INTERVAL_MS)))
      }
      loop()
    }

    try {
      const worker = new Worker(new URL('./tick.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<number>) => publish(event.data)
      worker.onerror = () => {
        worker.terminate()
        if (workerRef.current === worker) {
          workerRef.current = null
          setSource('main-thread')
          startMainThreadTicker()
        }
      }
      worker.postMessage('start')
      workerRef.current = worker
      setSource('worker')
    } catch {
      setSource('main-thread')
      startMainThreadTicker()
    }

    const resync = () => publish(Date.now())
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
    window.addEventListener('online', resync)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
      window.removeEventListener('online', resync)

      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
      const worker = workerRef.current
      workerRef.current = null
      if (worker) {
        worker.postMessage('stop')
        worker.terminate()
      }
    }
  }, [])

  return { now, source }
}
