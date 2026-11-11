// A one-time walk around the dashboard for a brand-new student, right after
// their first question. It plays itself: a highlighter ring glides from stop to
// stop with one short line each, about seven seconds in all. No "Next" buttons
// to click through — a tap anywhere, Esc, or "Skip" ends it at once, and it
// never comes back.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

import { updateGame } from '../game/store.ts'

type Stop = { target: string; title: string; say: string; ink: string }

const STOPS: Stop[] = [
  { target: 'page', title: 'Today’s page', say: 'Your next page lives here. One a day keeps the streak.', ink: 'var(--yellow)' },
  { target: 'path', title: 'Path', say: 'Every skill on the test, one stop at a time.', ink: 'var(--green)' },
  { target: 'notebook', title: 'Mistakes', say: 'Misses get clipped here and come back to beat.', ink: 'var(--pink)' },
  { target: 'arena', title: 'Arena & Study Hall', say: 'Speed rounds vs friends, and the Study Hall to chat.', ink: 'var(--violet)' },
  { target: 'exam', title: 'Exams', say: 'Full practice tests, scored like the real thing.', ink: 'var(--blue)' },
]

const HOLD = 1350 // ms on each stop
const LEAD_IN = 450 // let the dashboard land first

type Box = { top: number; left: number; width: number; height: number }

function measure(target: string): Box | null {
  // the tab bar moves to the bottom on a phone; pick whichever copy is on screen
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`))
  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      const pad = 6
      return { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    }
  }
  return null
}

export function DashboardTour() {
  const [at, setAt] = useState(-1) // -1: lead-in, before the first stop
  const [box, setBox] = useState<Box | null>(null)
  const [leaving, setLeaving] = useState(false)
  const done = useRef(false)

  const finish = useCallback(() => {
    if (done.current) return
    done.current = true
    setLeaving(true)
    updateGame((state) => ({ ...state, tourPending: false }))
  }, [])

  // the clock: lead-in, then one stop after another, then out
  useEffect(() => {
    if (leaving) return
    const wait = at === -1 ? LEAD_IN : HOLD
    const timer = window.setTimeout(() => {
      if (at + 1 >= STOPS.length) finish()
      else setAt(at + 1)
    }, wait)
    return () => window.clearTimeout(timer)
  }, [at, leaving, finish])

  // follow the current stop, and keep following it if the window changes
  useLayoutEffect(() => {
    if (at < 0) return
    const update = () => setBox(measure(STOPS[at].target))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [at])

  // any tap or key ends it; the student is never stuck behind it
  useEffect(() => {
    const end = () => finish()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') finish()
    }
    window.addEventListener('pointerdown', end, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', end, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [finish])

  // after the fade-out, take it off the page
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => setGone(true), 260)
    return () => window.clearTimeout(timer)
  }, [leaving])
  if (gone) return null

  const stop = at >= 0 ? STOPS[at] : null
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight

  // the caption sits beside the ring where there's room: right of a side tab,
  // above a bottom tab, below the page card
  let caption: CSSProperties = { opacity: 0 }
  if (stop && box) {
    const width = Math.min(280, vw - 32)
    const roomRight = vw - (box.left + box.width)
    if (roomRight > width + 28 && box.height < 160) {
      caption = { top: Math.max(16, box.top + box.height / 2 - 40), left: box.left + box.width + 16, width }
    } else if (box.top > vh * 0.55) {
      caption = { bottom: vh - box.top + 14, left: Math.min(Math.max(16, box.left + box.width / 2 - width / 2), vw - width - 16), width }
    } else {
      caption = {
        top: Math.min(box.top + box.height + 14, vh - 110),
        left: Math.min(Math.max(16, box.left + 24), vw - width - 16),
        width,
      }
    }
  }

  return (
    <div className={`tour ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-label="A quick look around" aria-live="polite">
      {box && stop && (
        <div
          className="tour__ring"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height, ['--mark' as string]: stop.ink }}
          aria-hidden="true"
        />
      )}
      {stop && box && (
        <div className="tour__caption speech" style={caption} key={stop.target}>
          <b className="tour__title">{stop.title}</b>
          <span>{stop.say}</span>
        </div>
      )}
      <div className="tour__bar">
        <ol className="tour__dots" aria-hidden="true">
          {STOPS.map((s, i) => (
            <li key={s.target} className={i < at ? 'is-done' : i === at ? 'is-here' : ''} style={i === at ? { ['--hold' as string]: `${HOLD}ms` } : undefined} />
          ))}
        </ol>
        <button type="button" className="tour__skip" onClick={finish}>
          Skip
        </button>
      </div>
    </div>
  )
}
