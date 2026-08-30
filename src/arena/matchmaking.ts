import { supabase, isSupabaseConfigured } from '../lib/supabase.ts'
import {
  botIdentity,
  scriptBot,
  type ArenaOpponent,
  type BotProfile,
  type MatchConfig,
  type MatchSession,
} from './model.ts'

// Two clients, one match, no server: matchmaking rides Supabase Realtime
// presence and broadcast. Nothing about a battle is persisted server-side - the
// questions are drawn from a shared seed and each side scores its own board -
// so the whole feature degrades to a training opponent when Realtime is absent.

export type MatchMessage =
  | { type: 'answer'; index: number; correct: boolean; points: number }
  | { type: 'finished' }
  | { type: 'left' }

export type MatchTransport = {
  // Called once the countdown clears. The bot uses it to start its clock; the
  // live transport has nothing to do.
  begin: () => void
  // Only the bot transport implements this: once you are done, there is no
  // reason to sit through the rest of its scripted pace.
  rush?: () => void
  send: (message: MatchMessage) => void
  subscribe: (listener: (message: MatchMessage) => void) => () => void
  leave: () => void
}

export type QueueIdentity = {
  id: string
  name: string
  avatarId: string
  rankLabel: string
}

export type PendingMatch = {
  promise: Promise<MatchSession | null>
  cancel: () => void
}

export function isLiveArenaAvailable(): boolean {
  return isSupabaseConfigured && supabase !== null
}

export function newMatchId(): string {
  const crypto = globalThis.crypto
  return crypto && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

// Ambiguous characters are left out so a code read aloud still works.
export function newInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

function queueChannelName(config: MatchConfig): string {
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `arena-queue-${slug(config.domain)}-${slug(config.difficulty)}`
}

function opponentFrom(identity: QueueIdentity): ArenaOpponent {
  return {
    id: identity.id,
    name: identity.name,
    avatarId: identity.avatarId,
    rankLabel: identity.rankLabel,
    isBot: false,
  }
}

// --- Training opponent --------------------------------------------------------

export function botTransport(seed: string, total: number, profile: BotProfile): MatchTransport {
  const beats = scriptBot(seed, total, profile)
  const timers: number[] = []
  const listeners = new Set<(message: MatchMessage) => void>()
  const delivered = new Set<number>()
  let closed = false

  const emit = (message: MatchMessage) => {
    if (closed) return
    listeners.forEach((listener) => listener(message))
  }

  const deliver = (beat: (typeof beats)[number]) => {
    if (delivered.has(beat.index)) return
    delivered.add(beat.index)
    emit({ type: 'answer', index: beat.index, correct: beat.correct, points: beat.points })
    if (delivered.size >= total) emit({ type: 'finished' })
  }

  const reschedule = (remaining: typeof beats, windowMs: number, offsetMs: number) => {
    timers.splice(0).forEach((timer) => clearTimeout(timer))
    remaining.forEach((beat, index) => {
      const at = windowMs > 0 ? offsetMs + ((index + 1) / remaining.length) * windowMs : beat.atMs
      timers.push(setTimeout(() => deliver(beat), at) as unknown as number)
    })
  }

  return {
    begin() {
      beats.forEach((beat) => {
        timers.push(setTimeout(() => deliver(beat), beat.atMs) as unknown as number)
      })
    },
    rush() {
      const remaining = beats.filter((beat) => !delivered.has(beat.index))
      if (remaining.length === 0) return
      reschedule(remaining, 2600, 600)
    },
    send() {},
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    leave() {
      if (closed) return
      closed = true
      timers.forEach((timer) => clearTimeout(timer))
      timers.length = 0
      listeners.clear()
    },
  }
}

// --- Live match ---------------------------------------------------------------

export function liveTransport(matchId: string, selfId: string): MatchTransport {
  const client = supabase!
  const listeners = new Set<(message: MatchMessage) => void>()
  // Moves made before the channel finishes subscribing are held, not dropped.
  const pending: MatchMessage[] = []
  let subscribed = false
  let closed = false

  const channel = client.channel(`arena-match-${matchId}`, {
    config: { presence: { key: selfId }, broadcast: { self: false } },
  })

  const emit = (message: MatchMessage) => {
    if (closed) return
    listeners.forEach((listener) => listener(message))
  }

  channel.on('broadcast', { event: 'move' }, ({ payload }: { payload: unknown }) => {
    const message = payload as MatchMessage | undefined
    if (message?.type === 'answer' || message?.type === 'finished') emit(message)
  })

  // A rival closing the tab is a forfeit, not a hang.
  channel.on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
    if (key !== selfId) emit({ type: 'left' })
  })

  channel.subscribe((status: string) => {
    if (status !== 'SUBSCRIBED') return
    subscribed = true
    channel.track({ id: selfId, at: Date.now() })
    pending.splice(0).forEach((message) => {
      channel.send({ type: 'broadcast', event: 'move', payload: message })
    })
  })

  return {
    begin() {},
    send(message) {
      if (closed) return
      if (!subscribed) {
        pending.push(message)
        return
      }
      channel.send({ type: 'broadcast', event: 'move', payload: message })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    leave() {
      if (closed) return
      closed = true
      listeners.clear()
      client.removeChannel(channel)
    },
  }
}

// --- Queue --------------------------------------------------------------------
// Everyone waiting on the same domain/difficulty sits in one presence channel.
// The longest-waiting player is the host: they mint the match, draw the
// questions, and broadcast the session to the second player in line. Ties on
// join time break on id so both clients elect the same host.

export function joinQueue({
  config,
  me,
  pickQuestionIds,
  onWaiting,
}: {
  config: MatchConfig
  me: QueueIdentity
  pickQuestionIds: (seed: string) => string[]
  onWaiting?: (others: number) => void
}): PendingMatch {
  const client = supabase!
  const joinedAt = Date.now()
  let settled = false
  let cancel = () => {}

  const promise = new Promise<MatchSession | null>((resolve) => {
    const channel = client.channel(queueChannelName(config), {
      config: { presence: { key: me.id }, broadcast: { self: false } },
    })

    const finish = (session: MatchSession | null) => {
      if (settled) return
      settled = true
      client.removeChannel(channel)
      resolve(session)
    }
    cancel = () => finish(null)

    const tryPair = () => {
      if (settled) return
      const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>
      const waiting = Object.values(state)
        .flat()
        .flatMap((entry) =>
          entry && typeof entry.id === 'string'
            ? [entry as unknown as QueueIdentity & { joinedAt: number }]
            : [],
        )
        .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))

      onWaiting?.(Math.max(0, waiting.length - 1))
      if (waiting.length < 2 || waiting[0].id !== me.id) return

      const guest = waiting[1]
      const matchId = newMatchId()
      const questionIds = pickQuestionIds(matchId)
      if (questionIds.length === 0) return

      channel.send({
        type: 'broadcast',
        event: 'match-found',
        payload: { matchId, seed: matchId, questionIds, config, host: me, guestId: guest.id },
      })
      finish({
        matchId,
        seed: matchId,
        questionIds,
        config,
        opponent: opponentFrom(guest),
        role: 'host',
      })
    }

    channel.on('broadcast', { event: 'match-found' }, ({ payload }: { payload: unknown }) => {
      const found = payload as
        | (Omit<MatchSession, 'opponent' | 'role'> & { host: QueueIdentity; guestId: string })
        | undefined
      if (!found || found.guestId !== me.id) return
      finish({
        matchId: found.matchId,
        seed: found.seed,
        questionIds: found.questionIds,
        config: found.config,
        opponent: opponentFrom(found.host),
        role: 'guest',
      })
    })
    channel.on('presence', { event: 'sync' }, tryPair)
    channel.on('presence', { event: 'join' }, tryPair)
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') channel.track({ ...me, joinedAt })
    })
  })

  return { promise, cancel: () => cancel() }
}

// --- Private match ------------------------------------------------------------
// An invite skips the queue: the host holds a channel named after the code, and
// whoever arrives with that code is the opponent.

export function hostInvite({
  code,
  config,
  me,
  pickQuestionIds,
}: {
  code: string
  config: MatchConfig
  me: QueueIdentity
  pickQuestionIds: (seed: string) => string[]
}): PendingMatch {
  const client = supabase!
  let settled = false
  let cancel = () => {}

  const promise = new Promise<MatchSession | null>((resolve) => {
    const channel = client.channel(`arena-invite-${code}`, { config: { broadcast: { self: false } } })
    const finish = (session: MatchSession | null) => {
      if (settled) return
      settled = true
      client.removeChannel(channel)
      resolve(session)
    }
    cancel = () => finish(null)

    channel.on('broadcast', { event: 'invite-join' }, ({ payload }: { payload: unknown }) => {
      const guest = payload as QueueIdentity | undefined
      if (!guest?.id || settled) return
      const matchId = newMatchId()
      const questionIds = pickQuestionIds(matchId)
      channel.send({
        type: 'broadcast',
        event: 'match-found',
        payload: { matchId, seed: matchId, questionIds, config, host: me, guestId: guest.id },
      })
      finish({
        matchId,
        seed: matchId,
        questionIds,
        config,
        opponent: opponentFrom(guest),
        role: 'host',
      })
    })
    channel.subscribe()
  })

  return { promise, cancel: () => cancel() }
}

export function joinInvite(code: string, me: QueueIdentity): PendingMatch {
  const client = supabase!
  let settled = false
  let cancel = () => {}

  const promise = new Promise<MatchSession | null>((resolve) => {
    const channel = client.channel(`arena-invite-${code}`, { config: { broadcast: { self: false } } })
    const finish = (session: MatchSession | null) => {
      if (settled) return
      settled = true
      client.removeChannel(channel)
      resolve(session)
    }
    cancel = () => finish(null)

    channel.on('broadcast', { event: 'match-found' }, ({ payload }: { payload: unknown }) => {
      const found = payload as
        | (Omit<MatchSession, 'opponent' | 'role'> & { host: QueueIdentity; guestId: string })
        | undefined
      if (!found || found.guestId !== me.id) return
      finish({
        matchId: found.matchId,
        seed: found.seed,
        questionIds: found.questionIds,
        config: found.config,
        opponent: opponentFrom(found.host),
        role: 'guest',
      })
    })
    channel.subscribe((status: string) => {
      if (status !== 'SUBSCRIBED') return
      channel.send({ type: 'broadcast', event: 'invite-join', payload: me })
      // The host may still be subscribing when the first knock lands.
      setTimeout(() => {
        if (!settled) channel.send({ type: 'broadcast', event: 'invite-join', payload: me })
      }, 1200)
    })
  })

  return { promise, cancel: () => cancel() }
}

export { botIdentity }
