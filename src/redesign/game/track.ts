// Product analytics, first-party and anonymous.
//
// Events go to our own Supabase `events` table (supabase/migrations/
// 202611110001_events.sql) and nowhere else: no third-party script, no cookie,
// no user id, no IP address, no full URL. A visitor who sends Do Not Track or
// Global Privacy Control is never recorded. Nothing here may throw or block:
// if the network or storage is unavailable the game carries on untracked.

type Value = string | number | boolean
export type Props = Record<string, Value>

export type EventRow = {
  name: string
  anon_id: string
  session_id: string
  path: string
  referrer: string | null
  signed_in: boolean
  props: Props
}

const ANON_KEY = 'clarity-anon:v1'
const FIRST_DAY_KEY = 'clarity-first-day:v1'
const LAST_DAY_KEY = 'clarity-last-active:v1'
const SESSION_KEY = 'clarity-session:v1'
const FLUSH_MS = 4000
const MAX_BATCH = 20

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {}
const url = env.VITE_SUPABASE_URL?.trim()
const key = env.VITE_SUPABASE_ANON_KEY?.trim()

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)

export const EVENT_NAME = /^[a-z][a-z0-9_]{0,47}$/

/** Keep only short, flat values, so nothing typed by a student can ride along. */
export function cleanProps(props: Record<string, unknown> | undefined): Props {
  const out: Props = {}
  if (!props) return out
  for (const [name, value] of Object.entries(props).slice(0, 12)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[name] = value
    else if (typeof value === 'boolean') out[name] = value
    else if (typeof value === 'string') out[name] = value.slice(0, 48)
  }
  return out
}

/** Only the screen name: "#/founders?code=ABC" becomes "/founders". */
export function screenOf(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0] || '/'
  const head = path.split('/').filter(Boolean)[0]
  return head ? `/${head.slice(0, 40)}` : '/'
}

/** Only the site a visitor came from, never the page or its query string. */
export function referrerHost(referrer: string, ownHost: string): string | null {
  if (!referrer) return null
  try {
    const host = new URL(referrer).hostname
    return host && host !== ownHost ? host.slice(0, 120) : null
  } catch {
    return null
  }
}

export function optedOut(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } | undefined): boolean {
  if (!nav) return true
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true
}

/** Local development never reports: only a real, published host does. */
export function isPublicHost(hostname: string): boolean {
  return Boolean(hostname) && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '[::1]' && !hostname.endsWith('.localhost') && !hostname.endsWith('.test')
}

/** Whole days between two YYYY-MM-DD keys. */
export function dayGap(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

// ---------------------------------------------------------------------------
// Browser side

let queue: EventRow[] = []
let timer: number | null = null
let signedIn = false
let wired = false

function enabled(): boolean {
  if (typeof window === 'undefined' || !url || !key) return false
  if (!isPublicHost(window.location.hostname)) return false
  return !optedOut(navigator as Navigator & { globalPrivacyControl?: boolean })
}

function randomId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

function stored(storage: 'local' | 'session', name: string, make: () => string): string {
  try {
    const box = storage === 'local' ? window.localStorage : window.sessionStorage
    const found = box.getItem(name)
    if (found) return found
    const made = make()
    box.setItem(name, made)
    return made
  } catch {
    return make()
  }
}

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function flush() {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
  if (queue.length === 0 || !url || !key) return
  const rows = queue
  queue = []
  try {
    void fetch(`${url}/rest/v1/events`, {
      method: 'POST',
      keepalive: true,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    }).catch(() => {
      /* offline or blocked: the event is dropped, the game is not */
    })
  } catch {
    /* same */
  }
}

function wire() {
  if (wired) return
  wired = true
  // a tab being closed or put away is the last chance to send what's queued
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

export function setSignedIn(value: boolean) {
  signedIn = value
}

export function track(name: string, props?: Record<string, unknown>) {
  try {
    if (!enabled() || !EVENT_NAME.test(name)) return
    wire()
    queue.push({
      name,
      anon_id: stored('local', ANON_KEY, randomId),
      session_id: stored('session', SESSION_KEY, randomId),
      path: screenOf(window.location.hash),
      referrer: referrerHost(document.referrer, window.location.hostname),
      signed_in: signedIn,
      props: cleanProps(props),
    })
    if (queue.length >= MAX_BATCH) flush()
    else if (timer === null) timer = window.setTimeout(flush, FLUSH_MS)
  } catch {
    /* analytics must never break the page */
  }
}

/** Once per session: used for views that would otherwise fire on every render. */
export function trackOnce(name: string, props?: Record<string, unknown>) {
  try {
    const flag = `clarity-once:${name}`
    if (window.sessionStorage.getItem(flag)) return
    window.sessionStorage.setItem(flag, '1')
  } catch {
    /* no session storage: count it anyway */
  }
  track(name, props)
}

/**
 * Once per calendar day: `day_n` is how many days since this browser first
 * played, which is what day-1 and day-7 retention are read from.
 */
export function trackDayActive() {
  try {
    if (!enabled()) return
    const day = todayKey()
    if (window.localStorage.getItem(LAST_DAY_KEY) === day) return
    window.localStorage.setItem(LAST_DAY_KEY, day)
    const first = stored('local', FIRST_DAY_KEY, () => day)
    track('day_active', { day_n: Math.max(0, dayGap(first, day)) })
  } catch {
    /* storage blocked */
  }
}
