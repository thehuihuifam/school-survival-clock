import { useEffect, useRef, useState } from 'react'

const INTERVAL_MS = 1000
const MIN_DELAY_MS = 40

/**
 * 드리프트 없는 1Hz 시계.
 *
 * 전용 워커(`tick.worker.ts`)가 틱을 만들기 때문에 탭이 백그라운드로 내려가도
 * 시간이 밀리지 않는다. 워커를 쓸 수 없는 브라우저에서는 같은 알고리즘이 메인
 * 스레드에서 돈다. 어느 쪽이든 화면에 그리는 시각은 항상 절대 시각
 * (`Date.now()`)에서 다시 계산하고, `visibilitychange`·`focus`·`online`에서
 * 즉시 재동기화하므로 절전에서 깨어난 노트북도 카운트다운이 어긋나지 않는다.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
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
        const current = Date.now()
        publish(current)
        timeoutRef.current = window.setTimeout(
          loop,
          Math.max(MIN_DELAY_MS, INTERVAL_MS - (current % INTERVAL_MS)),
        )
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
          startMainThreadTicker()
        }
      }
      worker.postMessage('start')
      workerRef.current = worker
    } catch {
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

  return now
}
