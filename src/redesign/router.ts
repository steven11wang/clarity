// Hash routing for the preview: the page is one static file, so every screen
// lives behind #/… and a reload lands where the student was.

import { useSyncExternalStore } from 'react'

export type Route = { path: string; parts: string[]; query: URLSearchParams }

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, search = ''] = raw.split('?')
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(search) }
}

let current = parse()
const listeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  current = parse()
  listeners.forEach((listener) => listener())
})

export function go(path: string) {
  if (window.location.hash === `#${path}`) return
  let swapped = false
  const swap = () => {
    if (swapped) return
    swapped = true
    window.location.hash = path
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }
  // a page turn between screens, where the browser can draw one. A tab that
  // isn't painting (in the background, say, while a friend joins) never runs
  // the transition's callback, so the move happens anyway after a beat.
  type Transition = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => Transition }
  if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    try {
      const transition = doc.startViewTransition(swap)
      // a skipped transition rejects its promises; the move itself still happens
      const ignore = () => {}
      transition.ready.catch(ignore)
      transition.finished.catch(ignore)
      transition.updateCallbackDone.catch(ignore)
    } catch {
      swap()
    }
    window.setTimeout(swap, 300)
  } else swap()
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}
