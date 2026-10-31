// Who the student is to other players: a stable id, a display name and 汤圆's
// outfit. Signed in, the id is their account's; otherwise a random id kept on
// this device. Names are what friends see, so they follow the live app's
// username rules (letters, numbers, dot, dash, underscore).

import { liveMode, type Peer } from './live.ts'
import { getGame } from './store.ts'

const ID_KEY = 'clarity-redesign:player-id'
const TAB_KEY = 'clarity-redesign:tab-id'

function stored(storage: Storage, key: string): string {
  const saved = storage.getItem(key)
  if (saved) return saved
  const fresh = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 12)
  storage.setItem(key, fresh)
  return fresh
}

export function playerId(): string {
  try {
    const base = getGame().account?.userId ?? `p-${stored(localStorage, ID_KEY)}`
    // on a preview server with no Supabase, "friends" are other tabs of this
    // browser, which share storage, so each tab has to be its own player
    return liveMode() === 'this-device' ? `${base}:${stored(sessionStorage, TAB_KEY)}` : base
  } catch {
    return `p-${Math.random().toString(36).slice(2)}`
  }
}

export function displayName(): string {
  const name = getGame().name.trim()
  return name || 'Guest'
}

export function selfPeer(extra: Record<string, unknown> = {}): Peer {
  const game = getGame()
  return { id: playerId(), name: displayName(), outfit: game.outfit, founder: Boolean(game.founder), at: Date.now(), ...extra }
}

export function validateName(value: string): string | null {
  const name = value.trim()
  if (name.length < 2) return 'Use at least 2 characters.'
  if (name.length > 20) return 'Use 20 characters or fewer.'
  if (!/^[A-Za-z0-9_.\- ]+$/.test(name)) return 'Letters, numbers, spaces, dots, dashes and underscores only.'
  return null
}
