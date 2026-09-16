/**
 * Background-safe 1 Hz heartbeat.
 *
 * Main-thread `setInterval` is throttled (and in some browsers frozen) once the
 * tab is hidden, which made the countdown drift and, worse, silently skipped
 * period transitions. This worker owns the timer instead: it posts the
 * authoritative `Date.now()` every second, aligned to the wall-clock boundary
 * so ticks never accumulate drift, and it keeps running while the tab is in the
 * background — which is what makes on-time break/dismissal alerts possible.
 *
 * Messages in: `'start'` | `'stop'`. Messages out: epoch milliseconds.
 */

interface TickWorkerScope {
  setTimeout(handler: () => void, timeout: number): number
  clearTimeout(id: number | undefined): void
  postMessage(message: number): void
  onmessage: ((event: { data: unknown }) => void) | null
}

// The app bundle is compiled against the DOM lib, where `self` is a `Window`.
// Inside a dedicated worker `globalThis` is the worker scope, so the surface we
// actually use is described locally and cast once — no extra tsconfig needed.
const scope = globalThis as unknown as TickWorkerScope

const INTERVAL_MS = 1000
/** Never re-fire faster than this, even if a boundary was missed. */
const MIN_DELAY_MS = 40

let timeoutId: number | undefined
let running = false

function tick() {
  if (!running) {
    return
  }

  const now = Date.now()
  scope.postMessage(now)

  // Align the next wake-up with the following whole second so a long-lived tab
  // stays on the wall clock instead of drifting by the timer's own latency.
  timeoutId = scope.setTimeout(tick, Math.max(MIN_DELAY_MS, INTERVAL_MS - (now % INTERVAL_MS)))
}

function stop() {
  running = false
  scope.clearTimeout(timeoutId)
  timeoutId = undefined
}

scope.onmessage = (event) => {
  const command = event.data
  if (command === 'start') {
    if (running) {
      return
    }
    running = true
    tick()
    return
  }
  if (command === 'stop') {
    stop()
  }
}
