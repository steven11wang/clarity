// Friend matches: one player makes a six-character code (or sends the link),
// the other types it in, and both play the same five questions live.
//
// The handshake is the live app's Arena protocol, message for message
// (`arena-invite-CODE` → invite-join / match-found, then `arena-match-ID` →
// move), so a redesign player and a live-app player can join each other's
// codes when Supabase is on. Emotes and rematches are extra move types the live
// app simply ignores.

import { parseInviteCode } from '../../arena/inviteCode.ts'
import { newInviteCode } from '../../arena/matchmaking.ts'
import { openBus, type Bus } from './live.ts'

export type Opponent = { id: string; name: string; outfit: string; rankLabel: string }

export type FriendSession = {
  matchId: string
  seed: string
  questionIds: string[]
  role: 'host' | 'guest'
  opponent: Opponent
}

export type Move =
  | { type: 'answer'; index: number; correct: boolean; points: number }
  | { type: 'finished' }
  | { type: 'emote'; id: string }
  | { type: 'rematch'; code: string }
  | { type: 'left' }

type Identity = { id: string; name: string; avatarId: string; rankLabel: string; outfit: string }

export const newCode = newInviteCode

/** Pull a code out of whatever was pasted: the code itself, a redesign link, or a live-app link. */
export function parseCode(input: string): string | null {
  const fromHash = /arena\/join\/([A-Za-z0-9]{6})/.exec(input)
  return parseInviteCode(fromHash ? fromHash[1] : input)
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/redesign.html#/arena/join/${code}`
}

function matchId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `m-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

function toOpponent(identity: Partial<Identity> | undefined): Opponent {
  return {
    id: identity?.id ?? 'friend',
    name: identity?.name ?? 'Friend',
    outfit: identity?.outfit ?? 'none',
    rankLabel: identity?.rankLabel ?? '',
  }
}

export type Pending = { promise: Promise<FriendSession | null>; cancel: () => void }

/** Hold a code open until a friend arrives with it. */
export function hostMatch(code: string, me: Identity, pickQuestionIds: (seed: string) => string[]): Pending {
  let bus: Bus | null = openBus(`arena-invite-${code}`, null)
  let settled = false
  let cancel = () => {}
  const promise = new Promise<FriendSession | null>((resolve) => {
    const finish = (session: FriendSession | null) => {
      if (settled) return
      settled = true
      // give the match-found broadcast a moment to leave before closing
      const closing = bus
      bus = null
      window.setTimeout(() => closing?.close(), 1500)
      resolve(session)
    }
    cancel = () => finish(null)
    bus!.on('invite-join', (payload) => {
      const guest = payload as Partial<Identity> | undefined
      if (!guest?.id || guest.id === me.id || settled) return
      const id = matchId()
      const questionIds = pickQuestionIds(id)
      bus?.send('match-found', {
        matchId: id,
        seed: id,
        questionIds,
        config: { domain: 'Mixed', difficulty: 'Mixed', count: questionIds.length },
        host: me,
        guestId: guest.id,
      })
      finish({ matchId: id, seed: id, questionIds, role: 'host', opponent: toOpponent(guest) })
    })
  })
  return { promise, cancel: () => cancel() }
}

/** Knock on a friend's code until they answer (or 30 seconds pass). */
export function joinMatch(code: string, me: Identity): Pending {
  const bus = openBus(`arena-invite-${code}`, null)
  let settled = false
  let knock = 0
  let giveUp = 0
  let cancel = () => {}
  const promise = new Promise<FriendSession | null>((resolve) => {
    const finish = (session: FriendSession | null) => {
      if (settled) return
      settled = true
      window.clearInterval(knock)
      window.clearTimeout(giveUp)
      bus.close()
      resolve(session)
    }
    cancel = () => finish(null)
    bus.on('match-found', (payload) => {
      const found = payload as { matchId: string; seed: string; questionIds: string[]; host: Identity; guestId: string } | undefined
      if (!found || found.guestId !== me.id) return
      finish({ matchId: found.matchId, seed: found.seed, questionIds: found.questionIds, role: 'guest', opponent: toOpponent(found.host) })
    })
    void bus.ready.then(() => {
      if (settled) return
      bus.send('invite-join', me)
      // the host may still be connecting when the first knock lands
      knock = window.setInterval(() => bus.send('invite-join', me), 1500)
      giveUp = window.setTimeout(() => finish(null), 30_000)
    })
  })
  return { promise, cancel: () => cancel() }
}

export type MatchLink = { send: (move: Move) => void; on: (listener: (move: Move) => void) => () => void; close: () => void }

/** The match itself: moves both ways, and a "left" when the other side goes. */
export function openMatch(id: string, me: Identity): MatchLink {
  const bus = openBus(`arena-match-${id}`, { id: me.id, name: me.name, outfit: me.outfit, at: Date.now() })
  const listeners = new Set<(move: Move) => void>()
  let seenOther = false
  let goneTimer = 0
  bus.on('move', (payload) => {
    const move = payload as Move | undefined
    if (move && typeof move === 'object' && 'type' in move) listeners.forEach((listener) => listener(move))
  })
  // presence blinks (a reconnect, a remount): only call it a forfeit when the
  // other player has been gone for a few seconds straight
  bus.onPeers((peers) => {
    const other = peers.some((peer) => peer.id !== me.id)
    if (other) {
      seenOther = true
      window.clearTimeout(goneTimer)
      goneTimer = 0
    } else if (seenOther && !goneTimer) {
      goneTimer = window.setTimeout(() => listeners.forEach((listener) => listener({ type: 'left' })), 4000)
    }
  })
  return {
    send: (move) => bus.send('move', move),
    on(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close: () => {
      window.clearTimeout(goneTimer)
      bus.close()
    },
  }
}
