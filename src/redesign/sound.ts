// Sound for the notebook, synthesised with Web Audio, so there are no files to
// load and every cue can be tuned here. Rules the cues follow:
//   - a cue confirms something the student just did or just earned; nothing
//     plays on its own, and nothing loops
//   - short (under half a second, celebrations under a second) and quiet
//   - always paired with something visible, so muting loses nothing
//   - one switch mutes it all, the choice is remembered, and on an iPhone the
//     ringer switch still wins (the session stays "ambient")
//   - exams are silent: test day has no dings

import { useSyncExternalStore } from 'react'

export type Cue =
  | 'pick'
  | 'commit'
  | 'turn'
  | 'right'
  | 'wrong'
  | 'stamp'
  | 'clip'
  | 'rip'
  | 'reveal'
  | 'holo'
  | 'levelup'
  | 'streak'
  | 'beat'
  | 'tick'
  | 'go'
  | 'win'
  | 'lose'
  | 'emote'
  | 'join'
  | 'ink'
  | 'flip'

type Settings = { on: boolean; volume: number }

const KEY = 'clarity-redesign:sound'
const MAX_VOICES = 10

function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null
    if (raw && typeof raw.on === 'boolean') return { on: raw.on, volume: typeof raw.volume === 'number' ? raw.volume : 0.6 }
  } catch {
    /* fall through to the default */
  }
  return { on: true, volume: 0.6 }
}

let settings = readSettings()
let quiet = false
let ctx: AudioContext | null = null
let master: GainNode | null = null
let voices = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    // "ambient": mixes with the student's own music and obeys the ringer switch
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'ambient'
    ctx = new Ctor()
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -12
    limiter.ratio.value = 8
    master = ctx.createGain()
    master.gain.value = settings.volume * 0.7
    master.connect(limiter)
    limiter.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// Browsers only allow audio after a gesture: wake the context on the first one.
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (settings.on) context()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

// --- building blocks ---------------------------------------------------------

function envelope(audio: AudioContext, at: number, duration: number, peak: number, attack = 0.004) {
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  gain.connect(master!)
  return gain
}

function tone(freq: number, delay: number, duration: number, peak: number, type: OscillatorType = 'triangle', glideTo?: number) {
  const audio = ctx!
  const at = audio.currentTime + delay
  const osc = audio.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + duration)
  osc.connect(envelope(audio, at, duration, peak))
  osc.start(at)
  osc.stop(at + duration + 0.02)
}

let noiseBuffer: AudioBuffer | null = null
function noise(delay: number, duration: number, peak: number, filter: BiquadFilterType, freq: number, sweepTo?: number, q = 1) {
  const audio = ctx!
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate * 0.6, audio.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const at = audio.currentTime + delay
  const source = audio.createBufferSource()
  source.buffer = noiseBuffer
  const shape = audio.createBiquadFilter()
  shape.type = filter
  shape.Q.value = q
  shape.frequency.setValueAtTime(freq, at)
  if (sweepTo) shape.frequency.exponentialRampToValueAtTime(sweepTo, at + duration)
  source.connect(shape)
  shape.connect(envelope(audio, at, duration, peak, 0.003))
  source.start(at)
  source.stop(at + duration + 0.02)
}

const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760, C7: 2093 }

const CUES: Record<Cue, { voices: number; play: () => void }> = {
  // a pencil tapping a bubble
  pick: { voices: 2, play: () => { noise(0, 0.03, 0.22, 'bandpass', 3600, undefined, 1.4); tone(1900, 0, 0.025, 0.05, 'sine') } },
  commit: { voices: 1, play: () => tone(NOTE.E5, 0, 0.06, 0.08, 'sine', NOTE.A5) },
  // a page turning
  turn: { voices: 1, play: () => noise(0, 0.17, 0.09, 'bandpass', 700, 2600, 0.8) },
  // the red pen ticks, then a small bright ding
  right: { voices: 3, play: () => { noise(0, 0.04, 0.12, 'highpass', 2600); tone(NOTE.A5, 0.04, 0.09, 0.11); tone(NOTE.E6, 0.1, 0.16, 0.1) } },
  // a soft, low "not that one" — never a buzzer
  wrong: { voices: 2, play: () => { noise(0, 0.05, 0.1, 'bandpass', 1400); tone(233, 0.03, 0.18, 0.09, 'triangle', 185) } },
  // a rubber stamp landing
  stamp: { voices: 2, play: () => { tone(130, 0, 0.2, 0.32, 'sine', 55); noise(0, 0.07, 0.18, 'lowpass', 900) } },
  // a paper clip snapping on
  clip: { voices: 2, play: () => { tone(2600, 0, 0.025, 0.06, 'triangle'); tone(3400, 0.035, 0.03, 0.05, 'triangle') } },
  // tearing the sticker pack open
  rip: { voices: 1, play: () => noise(0, 0.32, 0.16, 'highpass', 900, 5200, 0.7) },
  reveal: { voices: 3, play: () => { tone(NOTE.C6, 0, 0.09, 0.09); tone(NOTE.E6, 0.07, 0.09, 0.09); tone(NOTE.G6, 0.14, 0.16, 0.09) } },
  holo: {
    voices: 6,
    play: () => {
      ;[NOTE.C6, NOTE.D6, NOTE.E6, NOTE.G6, NOTE.A6, NOTE.C7].forEach((f, i) => tone(f, i * 0.06, 0.18, 0.08))
      tone(NOTE.C7, 0.36, 0.5, 0.05, 'sine')
    },
  },
  levelup: {
    voices: 6,
    play: () => {
      ;[NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone(f, i * 0.09, 0.14, 0.1))
      tone(NOTE.E6, 0.36, 0.45, 0.07)
      tone(NOTE.G6, 0.36, 0.45, 0.05)
    },
  },
  streak: { voices: 3, play: () => { tone(NOTE.G5, 0, 0.32, 0.06, 'sine'); tone(NOTE.C6, 0.04, 0.32, 0.05, 'sine'); tone(NOTE.E6, 0.08, 0.36, 0.05, 'sine') } },
  // a comeback beaten: three rising notes
  beat: { voices: 3, play: () => { tone(NOTE.E5, 0, 0.09, 0.1); tone(NOTE.G5, 0.08, 0.09, 0.1); tone(NOTE.C6, 0.16, 0.2, 0.11) } },
  tick: { voices: 1, play: () => tone(1050, 0, 0.03, 0.07, 'sine') },
  go: { voices: 1, play: () => tone(1570, 0, 0.14, 0.1, 'sine') },
  win: {
    voices: 6,
    play: () => {
      ;[NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => tone(f, i * 0.1, 0.12, 0.1))
      ;[NOTE.C6, NOTE.E6, NOTE.G6].forEach((f) => tone(f, 0.32, 0.5, 0.06))
    },
  },
  lose: { voices: 3, play: () => { tone(NOTE.G5, 0, 0.14, 0.07); tone(NOTE.E5, 0.12, 0.14, 0.07); tone(NOTE.D5, 0.24, 0.3, 0.06) } },
  emote: { voices: 1, play: () => tone(620, 0, 0.07, 0.09, 'sine', 1240) },
  // ding-dong: a friend walked in
  join: { voices: 2, play: () => { tone(NOTE.G5, 0, 0.22, 0.09, 'sine'); tone(NOTE.E5, 0.18, 0.3, 0.09, 'sine') } },
  ink: { voices: 1, play: () => tone(1400, 0, 0.06, 0.07, 'sine', 2100) },
  flip: { voices: 1, play: () => noise(0, 0.08, 0.1, 'bandpass', 1600, 900, 0.9) },
}

/** Play one cue, if sound is on and the student is not sitting an exam. */
export function play(cue: Cue) {
  if (!settings.on || quiet) return
  const audio = context()
  if (!audio || !master || audio.state !== 'running') return
  const spec = CUES[cue]
  if (voices + spec.voices > MAX_VOICES) return
  voices += spec.voices
  window.setTimeout(() => (voices -= spec.voices), 700)
  try {
    spec.play()
  } catch {
    /* a failed cue never breaks the page */
  }
}

export function setSound(next: Partial<Settings>) {
  settings = { ...settings, ...next }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* remembered for this visit only */
  }
  if (master) master.gain.value = settings.volume * 0.7
  if (settings.on) {
    context()
    play('commit')
  }
  emit()
}

/** Exams switch sound off for their whole run, whatever the setting says. */
export function setQuiet(value: boolean) {
  quiet = value
}

export function useSound(): Settings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => settings,
  )
}
