import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  primaryViewDirection,
  type PrimaryConsoleView,
} from './primaryViewTransition.ts'

const PRIMARY_TRANSITION_MS = 350

type Layer = {
  view: PrimaryConsoleView
  state: 'current' | 'entering' | 'exiting'
}

type PrimaryViewTransitionProps = {
  activeView: PrimaryConsoleView
  panels: Record<PrimaryConsoleView, ReactNode>
}

export function PrimaryViewTransition({
  activeView,
  panels,
}: PrimaryViewTransitionProps) {
  const activeViewRef = useRef(activeView)
  const generationRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const [direction, setDirection] = useState<'forward' | 'backward'>(
    'forward',
  )
  const [layers, setLayers] = useState<Layer[]>([
    { view: activeView, state: 'current' },
  ])

  useEffect(() => {
    const previousView = activeViewRef.current
    if (previousView === activeView) return

    activeViewRef.current = activeView
    generationRef.current += 1
    const generation = generationRef.current
    const nextDirection = primaryViewDirection(previousView, activeView)

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }

    setDirection(nextDirection < 0 ? 'backward' : 'forward')
    setLayers([
      { view: previousView, state: 'exiting' },
      { view: activeView, state: 'entering' },
    ])

    timerRef.current = window.setTimeout(() => {
      if (generationRef.current !== generation) return
      setLayers([{ view: activeView, state: 'current' }])
      timerRef.current = null
    }, PRIMARY_TRANSITION_MS)
  }, [activeView])

  useEffect(() => () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <section
      className="console-primary-transition"
      data-direction={direction}
      aria-label={`${activeView} view`}
      aria-busy={layers.length > 1}
    >
      {layers.map((layer) => (
        <div
          className={`console-primary-layer console-primary-layer--${layer.state}`}
          key={`${layer.view}-${layer.state}`}
          aria-hidden={layer.state === 'exiting' ? true : undefined}
        >
          {panels[layer.view]}
        </div>
      ))}
    </section>
  )
}
