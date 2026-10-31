// One small realtime bus for everything social in the redesign: friend
// matches, and the Study Hall's presence and preset messages.
//
// Online it rides Supabase Realtime broadcast + presence, the same rails the
// live app's Arena uses, so nothing is stored server-side. When Supabase is not
// configured (a local preview server), it falls back to BroadcastChannel, which
// connects tabs of this browser on this computer — enough to open two tabs and
// play yourself, and honest about it in the UI.

import { isSupabaseConfigured, supabase } from '../../lib/supabase.ts'

export type Peer = { id: string; name: string; outfit: string; at: number; [key: string]: unknown }

export type Bus = {
  send: (event: string, payload: unknown) => void
  on: (event: string, listener: (payload: unknown) => void) => () => void
  /** everyone currently here, you included */
  peers: () => Peer[]
  onPeers: (listener: (peers: Peer[]) => void) => () => void
  /** resolves once messages can flow */
  ready: Promise<void>
  close: () => void
}

export type LiveMode = 'online' | 'this-device'

export function liveMode(): LiveMode {
  return isSupabaseConfigured && supabase ? 'online' : 'this-device'
}

export function openBus(name: string, self: Peer | null): Bus {
  return liveMode() === 'online' ? supabaseBus(name, self) : localBus(name, self)
}

// --- Supabase Realtime -------------------------------------------------------

function supabaseBus(name: string, self: Peer | null): Bus {
  const client = supabase!
  const handlers = new Map<string, Set<(payload: unknown) => void>>()
  const peerListeners = new Set<(peers: Peer[]) => void>()
  const queue: Array<[string, unknown]> = []
  let live = false
  let closed = false
  let resolveReady = () => {}
  const ready = new Promise<void>((resolve) => (resolveReady = resolve))

  const channel = client.channel(name, {
    config: { broadcast: { self: false }, ...(self ? { presence: { key: self.id } } : {}) },
  })

  const listPeers = (): Peer[] => {
    const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>
    const seen = new Map<string, Peer>()
    Object.values(state)
      .flat()
      .forEach((entry) => {
        if (entry && typeof entry.id === 'string') seen.set(entry.id, entry as unknown as Peer)
      })
    return [...seen.values()]
  }

  channel.on('broadcast', { event: '*' }, (message: { event: string; payload: unknown }) => {
    handlers.get(message.event)?.forEach((listener) => listener(message.payload))
  })
  if (self) {
    channel.on('presence', { event: 'sync' }, () => {
      const peers = listPeers()
      peerListeners.forEach((listener) => listener(peers))
    })
  }
  channel.subscribe((status: string) => {
    if (status !== 'SUBSCRIBED' || closed) return
    live = true
    if (self) void channel.track(self)
    queue.splice(0).forEach(([event, payload]) => void channel.send({ type: 'broadcast', event, payload }))
    resolveReady()
  })

  return {
    send(event, payload) {
      if (closed) return
      if (!live) queue.push([event, payload])
      else void channel.send({ type: 'broadcast', event, payload })
    },
    on(event, listener) {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(listener)
      return () => handlers.get(event)?.delete(listener)
    },
    peers: listPeers,
    onPeers(listener) {
      peerListeners.add(listener)
      return () => peerListeners.delete(listener)
    },
    ready,
    close() {
      if (closed) return
      closed = true
      handlers.clear()
      peerListeners.clear()
      void client.removeChannel(channel)
    },
  }
}

// --- This device: BroadcastChannel between tabs ------------------------------

type Wire =
  | { kind: 'event'; event: string; payload: unknown }
  | { kind: 'hello' | 'here' | 'beat'; peer: Peer }
  | { kind: 'bye'; id: string }

function localBus(name: string, self: Peer | null): Bus {
  const handlers = new Map<string, Set<(payload: unknown) => void>>()
  const peerListeners = new Set<(peers: Peer[]) => void>()
  const peers = new Map<string, { peer: Peer; seen: number }>()
  const supported = typeof BroadcastChannel !== 'undefined'
  const channel = supported ? new BroadcastChannel(`clarity-redesign:${name}`) : null
  let closed = false

  const list = () => [...(self ? [self] : []), ...[...peers.values()].map((entry) => entry.peer)]
  const announce = () => {
    const current = list()
    peerListeners.forEach((listener) => listener(current))
  }
  const post = (wire: Wire) => {
    try {
      channel?.postMessage(wire)
    } catch {
      /* the tab is going away */
    }
  }

  if (channel) {
    channel.onmessage = (message: MessageEvent<Wire>) => {
      const wire = message.data
      if (!wire || closed) return
      if (wire.kind === 'event') {
        handlers.get(wire.event)?.forEach((listener) => listener(wire.payload))
        return
      }
      if (wire.kind === 'bye') {
        if (peers.delete(wire.id)) announce()
        return
      }
      const known = peers.has(wire.peer.id)
      peers.set(wire.peer.id, { peer: wire.peer, seen: Date.now() })
      if (wire.kind === 'hello' && self) post({ kind: 'here', peer: self })
      if (!known) announce()
    }
  }

  // presence over a channel with no server: say hello, keep a heartbeat, and
  // forget anyone silent for eight seconds
  let heartbeat = 0
  if (self && channel) {
    post({ kind: 'hello', peer: self })
    heartbeat = window.setInterval(() => {
      post({ kind: 'beat', peer: self })
      const now = Date.now()
      let changed = false
      peers.forEach((entry, id) => {
        if (now - entry.seen > 8000) {
          peers.delete(id)
          changed = true
        }
      })
      if (changed) announce()
    }, 3000)
  }
  const onUnload = () => self && post({ kind: 'bye', id: self.id })
  window.addEventListener('pagehide', onUnload)

  return {
    send(event, payload) {
      if (!closed) post({ kind: 'event', event, payload })
    },
    on(event, listener) {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(listener)
      return () => handlers.get(event)?.delete(listener)
    },
    peers: list,
    onPeers(listener) {
      peerListeners.add(listener)
      return () => peerListeners.delete(listener)
    },
    ready: Promise.resolve(),
    close() {
      if (closed) return
      onUnload()
      closed = true
      window.clearInterval(heartbeat)
      window.removeEventListener('pagehide', onUnload)
      handlers.clear()
      peerListeners.clear()
      channel?.close()
    },
  }
}
