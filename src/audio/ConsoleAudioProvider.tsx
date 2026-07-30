import { useEffect, useRef } from 'react'

import { ConsoleAudio, type ConsoleScene, type UiCue } from './consoleAudio.ts'

type ConsoleAudioProviderProps = {
  scene: ConsoleScene | null
}

function resolveCue(target: EventTarget | null, attribute: 'uiSoundHover' | 'uiSoundClick') {
  if (!(target instanceof Element)) return null
  const element = target.closest<HTMLElement>('[data-ui-sound]')
  if (!element) return null
  return (element.dataset[attribute] as UiCue | undefined) ?? null
}

export function ConsoleAudioProvider({ scene }: ConsoleAudioProviderProps) {
  const audioRef = useRef<ConsoleAudio | null>(null)

  useEffect(() => {
    const audio = new ConsoleAudio()
    audioRef.current = audio

    const handlePointerOver = (event: PointerEvent) => {
      const cue = resolveCue(event.target, 'uiSoundHover')
      if (cue) audio.playCue(cue)
    }
    const handleFocus = (event: FocusEvent) => {
      const cue = resolveCue(event.target, 'uiSoundHover')
      if (cue) audio.playCue(cue)
    }
    const handleClick = (event: MouseEvent) => {
      const cue = resolveCue(event.target, 'uiSoundClick')
      if (cue) audio.playCue(cue)
    }

    document.addEventListener('pointerover', handlePointerOver)
    document.addEventListener('focusin', handleFocus)
    document.addEventListener('click', handleClick)

    return () => {
      document.removeEventListener('pointerover', handlePointerOver)
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('click', handleClick)
      audio.dispose()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!scene) {
      audio.stopAmbient()
      return
    }
    audio.startAmbient(scene)
  }, [scene])

  return null
}
