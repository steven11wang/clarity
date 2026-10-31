// "Play a friend": make a code to share, or type a friend's code in. Codes are
// six characters with look-alikes left out (no 0/O, 1/I/L), so one read aloud
// across a classroom still works.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, Copy, Link2, Share2, UserPlus, X } from 'lucide-react'

import { INVITE_CODE_LENGTH } from '../../arena/inviteCode.ts'
import { hostMatch, inviteLink, joinMatch, newCode, parseCode, type FriendSession, type Pending } from '../game/friendMatch.ts'
import { displayName, playerId, validateName } from '../game/identity.ts'
import { liveMode } from '../game/live.ts'
import { loadBank, pickPage } from '../game/questions.ts'
import { getGame, updateGame, useGame } from '../game/store.ts'
import { rankFor } from '../game/engine.ts'
import { play } from '../sound.ts'
import { Tangyuan } from './Tangyuan.tsx'

export const FRIEND_ROUNDS = 5

export function myIdentity() {
  const game = getGame()
  return { id: playerId(), name: displayName(), avatarId: 'clawd', outfit: game.outfit, rankLabel: rankFor(game.arena.rp).rank.name }
}

/** Questions both players will see: drawn by the host from the shared seed. */
async function pickIds(seed: string): Promise<string[]> {
  const bank = await loadBank()
  const pool = bank.filter((question) => question.difficulty !== 'Hard' && question.passage.length < 600)
  return pickPage(pool, null, null, FRIEND_ROUNDS, `friend:${seed}`).map((question) => question.id)
}

type Props = {
  onMatched: (session: FriendSession) => void
  /** a code arriving from a link or a Study Hall challenge */
  incomingCode?: string | null
  /** host this code instead of making a new one (a rematch or a challenge) */
  hostCode?: string | null
}

export function FriendPanel({ onMatched, incomingCode = null, hostCode = null }: Props) {
  const game = useGame()
  const [code, setCode] = useState<string | null>(null)
  const [typed, setTyped] = useState(incomingCode ?? '')
  const [state, setState] = useState<'idle' | 'hosting' | 'joining'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const pending = useRef<Pending | null>(null)
  const needsName = !game.name.trim()

  useEffect(() => () => pending.current?.cancel(), [])

  const host = (fixed?: string) => {
    if (needsName) return
    pending.current?.cancel()
    const next = fixed ?? newCode()
    setCode(next)
    setState('hosting')
    setError(null)
    // questions are drawn when the friend arrives, from the match id
    let ids: string[] = []
    void pickIds(next).then((picked) => (ids = picked))
    const run = hostMatch(next, myIdentity(), () => ids)
    pending.current = run
    void run.promise.then((session) => {
      if (!session || pending.current !== run) return
      if (session.questionIds.length === 0) {
        setError('The question bank was still loading. Make a new code and try again.')
        setState('idle')
        return
      }
      play('join')
      onMatched(session)
    })
  }

  const join = (raw: string) => {
    if (needsName) return
    const parsed = parseCode(raw)
    if (!parsed) {
      setError(`Codes are ${INVITE_CODE_LENGTH} letters and numbers, like K7MPQ4.`)
      play('wrong')
      return
    }
    pending.current?.cancel()
    setError(null)
    setState('joining')
    const run = joinMatch(parsed, myIdentity())
    pending.current = run
    void run.promise.then((session) => {
      // a newer attempt took over (or the panel closed): this one has nothing to say
      if (pending.current !== run) return
      if (session) {
        play('join')
        onMatched(session)
        return
      }
      setState('idle')
      setError('Nobody is holding that code right now. Check it with your friend, or ask them to make a new one.')
    })
  }

  // a code from a link or a challenge joins straight away; a rematch hosts its code
  useEffect(() => {
    if (incomingCode && !needsName) join(incomingCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCode, needsName])
  useEffect(() => {
    if (hostCode && !needsName) host(hostCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostCode, needsName])

  const cancel = () => {
    pending.current?.cancel()
    pending.current = null
    setState('idle')
    setCode(null)
  }

  const copy = async (what: 'code' | 'link') => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : inviteLink(code))
      setCopied(what)
      window.setTimeout(() => setCopied(null), 1600)
    } catch {
      setError('Copy didn’t work here. Read the code out instead.')
    }
  }

  const share = async () => {
    if (!code) return
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title: 'Clarity Speed Round', text: `Play me in a Clarity Speed Round. Code: ${code}`, url: inviteLink(code) })
      } catch {
        /* closed the share sheet */
      }
    } else void copy('link')
  }

  const submitName = (event: FormEvent) => {
    event.preventDefault()
    const problem = validateName(nameDraft)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    updateGame((current) => ({ ...current, name: nameDraft.trim() }))
  }

  return (
    <section className="friend sheet" aria-labelledby="friend-title">
      <header className="friend__head">
        <h2 className="title" id="friend-title">
          Play a friend
        </h2>
        <span className={`friend__mode ${liveMode() === 'online' ? 'is-online' : ''}`}>
          {liveMode() === 'online' ? 'Works on any device' : 'This preview server: tabs on this computer only'}
        </span>
      </header>

      {needsName ? (
        <form className="friend__name" onSubmit={submitName}>
          <p>Pick a nickname first. It’s what your friend sees.</p>
          <div className="friend__row">
            <input className="field__input" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="e.g. Mina K." maxLength={20} aria-label="Nickname" />
            <button type="submit" className="btn">
              Save
            </button>
          </div>
        </form>
      ) : state === 'hosting' && code ? (
        <div className="friend__hosting" aria-live="polite">
          <p className="friend__label">Give your friend this code</p>
          <div className="code" aria-label={`Code ${code.split('').join(' ')}`}>
            {code.split('').map((char, i) => (
              <span key={i} className="code__cell" style={{ animationDelay: `${i * 60}ms` }}>
                {char}
              </span>
            ))}
          </div>
          <div className="friend__share">
            <button type="button" className="btn btn--sm btn--paper" onClick={() => copy('code')}>
              {copied === 'code' ? <Check /> : <Copy />} {copied === 'code' ? 'Copied' : 'Copy code'}
            </button>
            <button type="button" className="btn btn--sm btn--paper" onClick={() => copy('link')}>
              {copied === 'link' ? <Check /> : <Link2 />} {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" className="btn btn--sm btn--hl" onClick={share}>
              <Share2 /> Share
            </button>
          </div>
          <div className="friend__wait">
            <Tangyuan size={52} mood="think" />
            <span className="hand">waiting for your friend…</span>
            <button type="button" className="friend__cancel" onClick={cancel} aria-label="Cancel the invite">
              <X size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="friend__split">
          <div className="friend__half">
            <p className="friend__label">Start a match</p>
            <button type="button" className="btn btn--lg btn--block" onClick={() => host()}>
              <UserPlus /> Invite a friend
            </button>
            <p className="friend__hint">You get a code and a link. Five questions, 30 seconds each, no ranking points at stake.</p>
          </div>
          <form
            className="friend__half"
            onSubmit={(event) => {
              event.preventDefault()
              join(typed)
            }}
          >
            <label className="friend__label" htmlFor="friend-code">
              Have a code?
            </label>
            <input
              id="friend-code"
              className="code-input"
              value={typed}
              onChange={(event) => setTyped(event.target.value.toUpperCase())}
              placeholder="K7MPQ4"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={80}
              aria-describedby="friend-code-hint"
            />
            <button type="submit" className="btn btn--block btn--hl" disabled={state === 'joining' || typed.trim().length === 0}>
              {state === 'joining' ? 'Knocking…' : 'Join match'}
            </button>
            <p className="friend__hint" id="friend-code-hint">
              Paste the whole link if that’s what you got.
            </p>
          </form>
        </div>
      )}
      {error && (
        <p className="friend__error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
