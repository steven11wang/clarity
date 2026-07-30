type ConsoleScene = 'auth' | 'app'
type UiCue = 'hover' | 'select' | 'open'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createNoiseBuffer(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * 0.28
  }
  return buffer
}

export class ConsoleAudio {
  private context: AudioContext | null = null

  private master: GainNode | null = null

  private ambientBus: GainNode | null = null

  private ambientNodes: AudioNode[] = []

  private hoverAt = 0

  private scene: ConsoleScene | null = null

  private ensureContext() {
    if (typeof window === 'undefined') return null
    if (!this.context) {
      const BrowserAudioContext = globalThis.AudioContext
      const browserWindow = window as {
        webkitAudioContext?: typeof AudioContext
      }
      const Context = BrowserAudioContext ?? browserWindow.webkitAudioContext
      if (!Context) return null
      const context = new Context()
      const master = context.createGain()
      master.gain.value = 0.18
      master.connect(context.destination)
      this.context = context
      this.master = master
    }
    const context = this.context
    if (context.state === 'suspended') {
      void context.resume()
    }
    return context
  }

  startAmbient(scene: ConsoleScene) {
    const context = this.ensureContext()
    if (!context || !this.master) return
    if (this.scene === scene && this.ambientNodes.length > 0) return
    this.stopAmbient()
    this.scene = scene

    const ambientBus = context.createGain()
    ambientBus.gain.setValueAtTime(0.0001, context.currentTime)
    ambientBus.connect(this.master)
    this.ambientBus = ambientBus

    const noiseSource = context.createBufferSource()
    noiseSource.buffer = createNoiseBuffer(context)
    noiseSource.loop = true
    const noiseFilter = context.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = scene === 'auth' ? 540 : 880
    noiseFilter.Q.value = 0.45
    const noiseGain = context.createGain()
    noiseGain.gain.value = scene === 'auth' ? 0.06 : 0.02
    noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(ambientBus)
    noiseSource.start()

    const padFrequencies = scene === 'auth' ? [196, 293.66, 392] : [246.94, 369.99]
    const padOscillators = padFrequencies.flatMap((frequency, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = index === 0 ? 'sine' : 'triangle'
      oscillator.frequency.value = frequency
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = scene === 'auth' ? 720 : 980
      const gain = context.createGain()
      gain.gain.value = scene === 'auth' ? 0.012 : 0.007
      oscillator.connect(filter)
      filter.connect(gain)
      gain.connect(ambientBus)
      oscillator.start()
      return [oscillator, filter, gain]
    })

    const lfo = context.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = scene === 'auth' ? 0.11 : 0.18
    const lfoDepth = context.createGain()
    lfoDepth.gain.value = scene === 'auth' ? 0.012 : 0.006
    lfo.connect(lfoDepth)
    lfoDepth.connect(ambientBus.gain)
    lfo.start()

    ambientBus.gain.exponentialRampToValueAtTime(
      scene === 'auth' ? 0.34 : 0.16,
      context.currentTime + 2.2,
    )
    this.ambientNodes = [noiseSource, noiseFilter, noiseGain, ...padOscillators, lfo, lfoDepth, ambientBus]
  }

  stopAmbient() {
    if (!this.context) return
    const context = this.context
    const stopAt = context.currentTime + 0.55
    if (this.ambientBus) {
      const current = clamp(this.ambientBus.gain.value, 0.0001, 1)
      this.ambientBus.gain.cancelScheduledValues(context.currentTime)
      this.ambientBus.gain.setValueAtTime(current, context.currentTime)
      this.ambientBus.gain.exponentialRampToValueAtTime(0.0001, stopAt)
    }
    window.setTimeout(() => {
      for (const node of this.ambientNodes) {
        if ('stop' in node && typeof node.stop === 'function') {
          try {
            node.stop()
          } catch {
            // Node may already be stopped during Strict Mode cleanup.
          }
        }
        node.disconnect()
      }
      this.ambientNodes = []
      this.ambientBus = null
      this.scene = null
    }, 650)
  }

  playCue(cue: UiCue) {
    const context = this.ensureContext()
    if (!context || !this.master) return
    const now = context.currentTime
    if (cue === 'hover' && now - this.hoverAt < 0.06) return
    if (cue === 'hover') this.hoverAt = now

    const carrier = context.createOscillator()
    const shimmer = context.createOscillator()
    const gain = context.createGain()
    const filter = context.createBiquadFilter()
    const stereo = context.createStereoPanner()

    carrier.type = cue === 'select' ? 'triangle' : 'sine'
    shimmer.type = 'triangle'
    filter.type = 'bandpass'

    const envelope =
      cue === 'hover'
        ? { base: 880, peak: 1280, duration: 0.12, volume: 0.032, pan: -0.2 }
        : cue === 'open'
          ? { base: 660, peak: 1180, duration: 0.22, volume: 0.05, pan: 0.16 }
          : { base: 720, peak: 1440, duration: 0.18, volume: 0.044, pan: 0.08 }

    carrier.frequency.setValueAtTime(envelope.base, now)
    carrier.frequency.exponentialRampToValueAtTime(envelope.peak, now + envelope.duration * 0.28)
    carrier.frequency.exponentialRampToValueAtTime(envelope.peak * 0.72, now + envelope.duration)

    shimmer.frequency.setValueAtTime(envelope.base * 1.5, now)
    shimmer.frequency.exponentialRampToValueAtTime(envelope.peak * 1.2, now + envelope.duration * 0.22)

    filter.frequency.setValueAtTime(1100, now)
    filter.Q.value = cue === 'hover' ? 1.8 : 2.2
    stereo.pan.value = envelope.pan

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(envelope.volume, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + envelope.duration)

    carrier.connect(filter)
    shimmer.connect(filter)
    filter.connect(stereo)
    stereo.connect(gain)
    gain.connect(this.master)

    carrier.start(now)
    shimmer.start(now)
    carrier.stop(now + envelope.duration + 0.04)
    shimmer.stop(now + envelope.duration + 0.04)
  }

  dispose() {
    this.stopAmbient()
    if (!this.context) return
    const context = this.context
    this.context = null
    this.master = null
    window.setTimeout(() => {
      void context.close()
    }, 700)
  }
}

export type { ConsoleScene, UiCue }
