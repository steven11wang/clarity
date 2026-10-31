// The Study Hall: who is studying right now, and a chat to talk to them.
//
// Students can tap one of four quick phrases or a 汤圆 sticker, or type a
// message. Typed messages are checked by chatModeration.ts twice — before they
// leave and again on every receiver — so swearing, insults, slurs, threats,
// contact details, links and personal questions never reach anyone's screen.
// Online, typing needs a signed-in account, so a report can name the sender;
// reports land in the feedback table for a person to review. Messages travel
// over the live bus and are never stored.

import { useEffect, useMemo, useRef, useState } from 'react'

import { isSupabaseConfigured, supabase } from '../../lib/supabase.ts'
import type { Mood } from '../components/Tangyuan.tsx'
import { selfPeer } from './identity.ts'
import { canUseTypedChat, moderateMessage, type Verdict } from './chatModeration.ts'
import { liveMode, openBus, type Bus, type Peer } from './live.ts'
import { getGame } from './store.ts'

/** The four quick phrases in the hall. */
export const PHRASES = [
  { id: 'gl', text: 'Good luck today!' },
  { id: 'speed', text: 'Anyone up for a Speed Round?' },
  { id: 'beat', text: 'Just beat a comeback!' },
  { id: 'nice', text: 'Nice one!' },
] as const

/** What flies across a friend match. */
export const MATCH_PHRASES = [
  { id: 'gl', text: 'Good luck today!' },
  { id: 'nice', text: 'Nice one!' },
  { id: 'gg', text: 'GG. Rematch?' },
  { id: 'thanks', text: 'Thanks!' },
] as const

export const STICKERS: Array<{ id: string; mood: Mood; label: string }> = [
  { id: 'yay', mood: 'happy', label: 'Yay' },
  { id: 'wow', mood: 'wow', label: 'Wow' },
  { id: 'wink', mood: 'wink', label: 'Nice' },
  { id: 'hmm', mood: 'think', label: 'Hmm' },
  { id: 'oops', mood: 'sad', label: 'Oops' },
]

export type PhraseId = (typeof PHRASES)[number]['id']

export function phraseText(id: string): string | null {
  return [...PHRASES, ...MATCH_PHRASES].find((phrase) => phrase.id === id)?.text ?? null
}

export function signedIn(): boolean {
  return getGame().account?.kind === 'cloud'
}

/** Nicknames are the one free-text field anyone sees: keep them short and plain. */
export function cleanName(value: unknown): string {
  const text = typeof value === 'string' ? value : ''
  const clean = text.replace(/[^A-Za-z0-9_.\- ]/g, '').trim().slice(0, 20)
  if (!clean) return 'Student'
  // a name can be loud (spam rules are for messages), but never rude or a handle
  const verdict = moderateMessage(clean)
  return verdict.ok || verdict.reason === 'spam' ? clean : 'Student'
}

export type HallMessage = {
  key: string
  from: { id: string; name: string; outfit: string }
  kind: 'phrase' | 'sticker' | 'cheer' | 'text'
  value: string
  to?: string
  at: number
}

export type Challenge = { from: { id: string; name: string; outfit: string }; code: string; at: number }

const HIDDEN_KEY = 'clarity-redesign:hall-hidden'
const SEND_GAP_MS = 2500

function readHidden(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function useHall(active: boolean, status: string) {
  const [peers, setPeers] = useState<Peer[]>([])
  const [feed, setFeed] = useState<HallMessage[]>([])
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [hidden, setHidden] = useState<string[]>(readHidden)
  const bus = useRef<Bus | null>(null)
  const me = useRef<Peer | null>(null)
  const lastSent = useRef(0)
  const recentMine = useRef<string[]>([])

  useEffect(() => {
    if (!active) return
    const self = selfPeer({ status })
    me.current = self
    const opened = openBus('study-hall', self)
    bus.current = opened
    setPeers(opened.peers())
    const stopPeers = opened.onPeers(setPeers)
    const stopSay = opened.on('say', (payload) => {
      const message = payload as Partial<HallMessage> | undefined
      if (!message?.from?.id || typeof message.from.id !== 'string' || typeof message.value !== 'string') return
      if (!['phrase', 'sticker', 'cheer', 'text'].includes(message.kind ?? '')) return
      // a typed message is checked again here: the sender's check can't be trusted
      if (message.kind === 'text' && !moderateMessage(message.value).ok) return
      if (message.kind === 'cheer' && message.value !== 'cheer') return
      if (message.kind === 'phrase' && !phraseText(message.value)) return
      if (message.kind === 'sticker' && !STICKERS.some((sticker) => sticker.id === message.value)) return
      const clean: HallMessage = {
        key: `${message.from.id}:${message.at ?? Date.now()}`,
        from: { id: message.from.id, name: cleanName(message.from.name), outfit: String(message.from.outfit ?? 'none') },
        kind: message.kind as HallMessage['kind'],
        value: message.value,
        to: typeof message.to === 'string' ? message.to : undefined,
        at: Date.now(),
      }
      setFeed((list) => [clean, ...list].slice(0, 40))
    })
    const stopChallenge = opened.on('challenge', (payload) => {
      const incoming = payload as { to?: string; code?: string; from?: { id: string; name: string; outfit: string } } | undefined
      if (!incoming?.from || incoming.to !== self.id || typeof incoming.code !== 'string') return
      setChallenge({ from: { ...incoming.from, name: cleanName(incoming.from.name) }, code: incoming.code, at: Date.now() })
    })
    return () => {
      stopPeers()
      stopSay()
      stopChallenge()
      opened.close()
      bus.current = null
    }
  }, [active, status])

  const send = (kind: HallMessage['kind'], value: string, to?: string) => {
    const self = me.current
    if (!bus.current || !self) return false
    if (kind === 'text' && !canUseTypedChat(liveMode(), value, signedIn())) return false
    const now = Date.now()
    if (now - lastSent.current < SEND_GAP_MS) return false
    lastSent.current = now
    const message: HallMessage = { key: `${self.id}:${now}`, from: { id: self.id, name: self.name, outfit: self.outfit }, kind, value, to, at: now }
    bus.current.send('say', message)
    setFeed((list) => [message, ...list].slice(0, 40))
    return true
  }

  const visiblePeers = useMemo((): Peer[] => peers.filter((peer) => !hidden.includes(peer.id)).map((peer) => ({ ...peer, name: cleanName(peer.name) })), [peers, hidden])
  const visibleFeed = useMemo(() => feed.filter((message) => !hidden.includes(message.from.id)), [feed, hidden])

  return {
    me: me.current,
    peers: visiblePeers,
    feed: visibleFeed,
    challenge,
    dismissChallenge: () => setChallenge(null),
    say: (phrase: PhraseId) => send('phrase', phrase),
    /** Check a typed message, then send it. The verdict says why if it can't go. */
    sayText(text: string): Verdict | { ok: false; reason: 'wait' | 'account'; message: string } {
      const value = text.trim()
      const verdict = moderateMessage(value, recentMine.current)
      if (!verdict.ok) return verdict
      if (liveMode() === 'online' && !signedIn()) return { ok: false, reason: 'account', message: 'Sign in to write messages. Quick phrases and stickers work without an account.' }
      if (!send('text', value)) return { ok: false, reason: 'wait', message: 'One moment — wait a couple of seconds between messages.' }
      recentMine.current = [...recentMine.current, value].slice(-5)
      return { ok: true }
    },
    /** Hide the sender and, online, file the message for a person to review. */
    report(message: HallMessage) {
      hideId(message.from.id)
      void fileReport(message)
    },
    sticker: (id: string) => send('sticker', id),
    cheer: (peerId: string) => send('cheer', 'cheer', peerId),
    challengePeer(peerId: string, code: string) {
      const self = me.current
      if (!bus.current || !self) return
      bus.current.send('challenge', { to: peerId, code, from: { id: self.id, name: self.name, outfit: self.outfit } })
    },
    hide: hideId,
  }

  function hideId(peerId: string) {
    setHidden((current) => {
      const next = [...new Set([...current, peerId])]
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
      } catch {
        /* hidden for this visit */
      }
      return next
    })
  }
}

/**
 * Online, a report goes to public.feedback (signed-in users may insert their own
 * rows; only the owner reads them). Offline there is nobody to send it to: the
 * sender is hidden on this device either way.
 */
async function fileReport(message: HallMessage) {
  const game = getGame()
  if (!isSupabaseConfigured || !supabase || game.account?.kind !== 'cloud' || !game.account.userId) return
  const what = message.kind === 'text' ? message.value : `${message.kind}: ${message.value}`
  await supabase.from('feedback').insert({
    user_id: game.account.userId,
    email: game.account.email ?? null,
    display_name: game.name || null,
    message: `[Study Hall report] ${message.from.name} (${message.from.id}): ${what}`.slice(0, 4000),
    view: 'study-hall',
    page_url: window.location.href,
  })
}
