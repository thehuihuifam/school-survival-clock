/**
 * Chime engine.
 *
 * Period transitions are announced with short synthesised bells built from the
 * Web Audio API — no audio files to download, no codec issues, and total
 * silence unless the user turned sound on. The context is created lazily and
 * resumed from the first real user gesture so browsers never block it.
 */

export type ChimeKind =
  | 'class-started'
  | 'break-started'
  | 'lunch-started'
  | 'duty-started'
  | 'dismissed'
  | 'pre-bell'
  | 'ui'

interface Voice {
  frequency: number
  /** Peak gain (0..1) before the exponential decay. */
  gain: number
  /** Seconds the voice takes to fade out. */
  decay: number
  /** Seconds before the voice starts. */
  delay?: number
  type?: OscillatorType
}

const NOTE = {
  G4: 392.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.51,
} as const

/** A bell-ish voice pair: fundamental plus a softer upper partial. */
function bell(frequency: number, gain: number, decay: number, delay = 0): Voice[] {
  return [
    { frequency, gain, decay, delay, type: 'sine' },
    { frequency: frequency * 2.01, gain: gain * 0.32, decay: decay * 0.62, delay, type: 'sine' },
  ]
}

const RECIPES: Record<ChimeKind, Voice[]> = {
  // Two rising notes: "수업 시작합니다"
  'class-started': [...bell(NOTE.E5, 0.34, 0.85), ...bell(NOTE.A5, 0.3, 1.05, 0.19)],
  // Two falling notes: "쉬는 시간입니다"
  'break-started': [...bell(NOTE.A5, 0.3, 0.7), ...bell(NOTE.E5, 0.26, 1.0, 0.17)],
  'lunch-started': [
    ...bell(NOTE.C5, 0.3, 0.8),
    ...bell(NOTE.E5, 0.28, 0.9, 0.15),
    ...bell(NOTE.G5, 0.26, 1.15, 0.3),
  ],
  'duty-started': [...bell(NOTE.G4, 0.24, 0.9), ...bell(NOTE.D5, 0.22, 1.1, 0.2)],
  // Small fanfare for the dismissal moment.
  dismissed: [
    ...bell(NOTE.C5, 0.32, 0.8),
    ...bell(NOTE.E5, 0.3, 0.85, 0.14),
    ...bell(NOTE.G5, 0.3, 0.95, 0.28),
    ...bell(NOTE.C6, 0.34, 1.5, 0.42),
    ...bell(NOTE.E6, 0.16, 1.7, 0.56),
  ],
  // 예비종: a quiet, falling two-note cue that reads as "get ready" without
  // competing with the real transition bells above.
  'pre-bell': [...bell(NOTE.G5, 0.2, 0.5), ...bell(NOTE.D5, 0.18, 0.85, 0.16)],
  // Barely-there click for interactive feedback.
  ui: [{ frequency: 1180, gain: 0.07, decay: 0.09, type: 'triangle' }],
}

class ChimeEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private enabled = true
  private volume = 0.6
  private failed = false

  /** `true` when the browser can actually synthesise audio. */
  get isSupported() {
    return !this.failed && typeof window !== 'undefined' && this.resolveConstructor() !== null
  }

  private resolveConstructor(): typeof AudioContext | null {
    const candidate =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    return candidate ?? null
  }

  private ensureContext(): AudioContext | null {
    if (this.failed || typeof window === 'undefined') {
      return null
    }
    if (this.context) {
      return this.context
    }

    const Constructor = this.resolveConstructor()
    if (!Constructor) {
      this.failed = true
      return null
    }

    try {
      this.context = new Constructor()
      this.master = this.context.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.context.destination)
      return this.context
    } catch {
      this.failed = true
      this.context = null
      this.master = null
      return null
    }
  }

  /** Call from a real user gesture so the context is allowed to run. */
  unlock() {
    const context = this.ensureContext()
    if (!context) {
      return
    }
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (enabled) {
      this.unlock()
    }
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume))
    if (this.master) {
      this.master.gain.value = this.volume
    }
  }

  get isEnabled() {
    return this.enabled
  }

  play(kind: ChimeKind) {
    if (!this.enabled) {
      return false
    }
    const context = this.ensureContext()
    if (!context || !this.master) {
      return false
    }
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
      // A suspended context cannot be forced awake without a gesture; the call
      // is best-effort so we still schedule the voices below.
    }

    const startedAt = context.currentTime
    for (const voice of RECIPES[kind]) {
      this.renderVoice(context, startedAt, voice)
    }
    return true
  }

  private renderVoice(context: AudioContext, startedAt: number, voice: Voice) {
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const start = startedAt + (voice.delay ?? 0)
    const end = start + voice.decay + 0.05

    oscillator.type = voice.type ?? 'sine'
    oscillator.frequency.setValueAtTime(voice.frequency, start)

    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, voice.gain), start + 0.014)
    envelope.gain.exponentialRampToValueAtTime(0.0001, end)

    oscillator.connect(envelope)
    envelope.connect(this.master ?? context.destination)
    oscillator.start(start)
    oscillator.stop(end + 0.02)
    oscillator.onended = () => {
      oscillator.disconnect()
      envelope.disconnect()
    }
  }
}

export const chimeEngine = new ChimeEngine()
