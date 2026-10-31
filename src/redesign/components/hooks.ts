import { useEffect, useRef, useState, type RefObject } from 'react'

const MOTION_OK = () => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Scroll reveals that never hide content by default: an element is only marked
 * pending when it starts below the fold and motion is allowed, and the
 * observer un-pends it as it arrives. Highlighter swipes and pen circles ride
 * the same observer, so a mark draws itself the moment its line is read.
 */
export function useReveal(root: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const host = root.current
    if (!host || !MOTION_OK() || !('IntersectionObserver' in window)) return
    const targets = Array.from(host.querySelectorAll<HTMLElement>('.reveal, .hl[data-swipe], .pen-circle[data-draw]'))
    const fold = window.innerHeight * 0.92
    const pending = targets.filter((el) => el.getBoundingClientRect().top > fold || el.dataset.swipe === 'load' || el.dataset.draw === 'load')
    pending.forEach((el) => el.classList.add('is-pending'))
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const delay = Number(el.dataset.delay ?? 0)
          window.setTimeout(() => el.classList.remove('is-pending'), delay)
          observer.unobserve(el)
        })
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    )
    pending.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Count a number up to its target, easing out; jumps straight there under reduced motion. */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (!MOTION_OK() || start === target) {
      from.current = target
      setValue(target)
      return
    }
    let frame = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 4)
      setValue(Math.round(start + (target - start) * eased))
      if (p < 1) frame = requestAnimationFrame(tick)
      else from.current = target
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

export function buzz(pattern: number | number[] = 12) {
  try {
    if (MOTION_OK()) navigator.vibrate?.(pattern)
  } catch {
    /* no vibration on this device */
  }
}
