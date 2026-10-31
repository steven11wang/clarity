// A live Speed Round against a friend. Both players get the same five
// questions; each plays at their own pace with 30 seconds a question, and the
// scoreboard shows the other side's ticks and crosses as they land. Stickers
// and preset phrases fly across; nobody can type.

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Swords, Timer, UserPlus, Volume2, VolumeX } from 'lucide-react'

import type { Question } from '../../types.ts'
import { REWARDS, SKILL_SHORT, type OutfitId } from '../game/content.ts'
import { bumpQuest, fileMiss, gain, recordAnswer } from '../game/engine.ts'
import { newCode, openMatch, type FriendSession, type MatchLink, type Move } from '../game/friendMatch.ts'
import { MATCH_PHRASES, STICKERS, cleanName, phraseText } from '../game/hall.ts'
import { LETTERS, byId, loadBank } from '../game/questions.ts'
import { updateGame, useGame, useToday } from '../game/store.ts'
import { go } from '../router.ts'
import { play } from '../sound.ts'
import { buzz } from '../components/hooks.ts'
import { myIdentity } from '../components/FriendPanel.tsx'
import { QuestionSheet } from '../components/QuestionSheet.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'

type Letter = (typeof LETTERS)[number]

const SECONDS = 30
const QUICK_PHRASES = MATCH_PHRASES.map((phrase) => phrase.id)

// handed over from the lobby; a reload mid-match goes back to the lobby
let active: FriendSession | null = null
let rematchCode: string | null = null

export function startFriendMatch(session: FriendSession) {
  active = session
  go('/arena/match')
}

/** A rematch code to host when the lobby opens next, if one was promised. */
export function takeRematchCode(): string | null {
  const code = rematchCode
  rematchCode = null
  return code
}

export function FriendMatch() {
  const session = active
  useEffect(() => {
    if (!session) go('/arena')
  }, [session])
  if (!session) return null
  return <Match key={session.matchId} session={session} />
}

type Emote = { key: number; from: 'me' | 'them'; sticker?: string; phrase?: string }

function Match({ session }: { session: FriendSession }) {
  const game = useGame()
  const day = useToday()
  const [questions, setQuestions] = useState<Question[]>([])
  const [phase, setPhase] = useState<'versus' | 'round' | 'waiting' | 'result'>('versus')
  const [count, setCount] = useState(3)
  const [at, setAt] = useState(0)
  const [picked, setPicked] = useState<Letter | null>(null)
  const [left, setLeft] = useState(SECONDS)
  const [mine, setMine] = useState<Array<boolean | null>>([])
  const [theirs, setTheirs] = useState<Array<boolean | null>>([])
  const [theirDone, setTheirDone] = useState(false)
  const [theyLeft, setTheyLeft] = useState(false)
  const [emotes, setEmotes] = useState<Emote[]>([])
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)
  mutedRef.current = muted
  const [rematchOffer, setRematchOffer] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const link = useRef<MatchLink | null>(null)
  const points = useRef({ mine: 0, theirs: 0 })
  const startedAt = useRef(Date.now())
  const lastEmote = useRef(0)
  const settled = useRef(false)
  const opponent = { ...session.opponent, name: cleanName(session.opponent.name) }

  // the questions: same ids, same order, on both sides
  useEffect(() => {
    void loadBank().then((bank) => {
      const list = session.questionIds.map((id) => byId(bank, id)).filter((q): q is Question => Boolean(q))
      setQuestions(list)
      setMine(list.map(() => null))
      setTheirs(list.map(() => null))
    })
  }, [session])

  // the line to the other player
  useEffect(() => {
    const opened = openMatch(session.matchId, myIdentity())
    link.current = opened
    const stop = opened.on((move: Move) => {
      if (move.type === 'answer') {
        setTheirs((list) => list.map((value, i) => (i === move.index ? move.correct : value)))
        points.current.theirs += move.points
      } else if (move.type === 'finished') setTheirDone(true)
      else if (move.type === 'left') setTheyLeft(true)
      else if (move.type === 'emote') {
        if (mutedRef.current) return
        const sticker = STICKERS.find((item) => item.id === move.id)
        const phrase = phraseText(move.id)
        if (!sticker && !phrase) return
        play('emote')
        show({ from: 'them', sticker: sticker?.id, phrase: phrase ?? undefined })
      } else if (move.type === 'rematch' && typeof move.code === 'string') {
        setRematchOffer(move.code)
        play('join')
      }
    })
    return () => {
      stop()
      opened.close()
      link.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.matchId])

  // 3, 2, 1, go
  useEffect(() => {
    if (phase !== 'versus' || questions.length === 0) return
    if (count === 0) {
      play('go')
      startedAt.current = Date.now()
      setPhase('round')
      return
    }
    play('tick')
    const timer = window.setTimeout(() => setCount((value) => value - 1), 800)
    return () => window.clearTimeout(timer)
  }, [phase, count, questions.length])

  // the clock for the current question
  useEffect(() => {
    if (phase !== 'round' || picked) return
    const timer = window.setInterval(() => setLeft((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [phase, picked, at])

  useEffect(() => {
    if (phase !== 'round') return
    if (left <= 5 && left > 0 && !picked) play('tick')
    if (left <= 0 && !picked) answer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  // the result lands once both sides are done (or the other side has gone)
  useEffect(() => {
    if (phase === 'waiting' && (theirDone || theyLeft)) setPhase('result')
  }, [phase, theirDone, theyLeft])

  const myScore = mine.filter(Boolean).length
  const theirScore = theirs.filter(Boolean).length
  const outcome: 'win' | 'loss' | 'draw' =
    theyLeft && !theirDone
      ? 'win'
      : myScore !== theirScore
        ? myScore > theirScore
          ? 'win'
          : 'loss'
        : points.current.mine === points.current.theirs
          ? 'draw'
          : points.current.mine > points.current.theirs
            ? 'win'
            : 'loss'

  useEffect(() => {
    if (phase !== 'result' || settled.current) return
    settled.current = true
    play(outcome === 'loss' ? 'lose' : 'win')
    updateGame((state) => {
      let next = gain(state, 15, 1)
      if (outcome === 'win') next = bumpQuest(gain(next, REWARDS.speedWinXp - 5, REWARDS.speedWinInk - 1), 'win-speed')
      return next
    })
  }, [phase, outcome])

  function show(emote: Omit<Emote, 'key'>) {
    const key = Date.now() + Math.random()
    setEmotes((list) => [...list.filter((item) => item.from !== emote.from), { ...emote, key }])
    window.setTimeout(() => setEmotes((list) => list.filter((item) => item.key !== key)), 2600)
  }

  const sendEmote = (id: string) => {
    const now = Date.now()
    if (now - lastEmote.current < 1500) return
    lastEmote.current = now
    link.current?.send({ type: 'emote', id })
    play('emote')
    const sticker = STICKERS.find((item) => item.id === id)
    show({ from: 'me', sticker: sticker?.id, phrase: sticker ? undefined : phraseText(id) ?? undefined })
  }

  const q = questions[at]

  function answer(letter: Letter | null) {
    if (picked || !q) return
    const correct = letter === q.answer
    const taken = (SECONDS - left) * 1000
    const gained = correct ? 100 + Math.round(Math.max(0, SECONDS * 1000 - taken) / 300) : 0
    points.current.mine += gained
    setPicked(letter ?? ('none' as Letter))
    setMine((list) => list.map((value, i) => (i === at ? correct : value)))
    play(correct ? 'right' : 'wrong')
    buzz(correct ? 14 : [10, 40, 10])
    link.current?.send({ type: 'answer', index: at, correct, points: gained })
    updateGame((state) => {
      const next = recordAnswer(state, q.skill, correct)
      return correct ? next : fileMiss(next, q.id, q.skill, day)
    })
    window.setTimeout(() => {
      if (at + 1 >= questions.length) {
        link.current?.send({ type: 'finished' })
        setPhase('waiting')
        return
      }
      play('turn')
      setAt(at + 1)
      setPicked(null)
      setLeft(SECONDS)
    }, 1200)
  }

  const offerRematch = () => {
    const code = newCode()
    rematchCode = code
    link.current?.send({ type: 'rematch', code })
    go('/arena')
  }

  const isFriend = (game.friends ?? []).some((friend) => friend.id === opponent.id)
  const bubble = (from: 'me' | 'them') => {
    const emote = emotes.find((item) => item.from === from)
    if (!emote) return null
    const sticker = STICKERS.find((item) => item.id === emote.sticker)
    return (
      <span className={`emote-bubble emote-bubble--${from}`} key={emote.key}>
        {sticker ? <Tangyuan size={40} mood={sticker.mood} idle={false} outfit={from === 'me' ? game.outfit : (opponent.outfit as OutfitId)} /> : emote.phrase}
      </span>
    )
  }

  const emoteBar = (
    <div className="emote-bar" role="group" aria-label="Send a sticker or phrase">
      {STICKERS.map((sticker) => (
        <button key={sticker.id} type="button" className="emote-bar__sticker" onClick={() => sendEmote(sticker.id)} aria-label={`Send ${sticker.label}`}>
          <Tangyuan size={30} mood={sticker.mood} idle={false} outfit={game.outfit} />
        </button>
      ))}
      {QUICK_PHRASES.map((id) => (
        <button key={id} type="button" className="chip emote-bar__phrase" onClick={() => sendEmote(id)}>
          {phraseText(id)}
        </button>
      ))}
      <button type="button" className="icon-btn" onClick={() => setMuted(!muted)} aria-pressed={muted} aria-label={muted ? 'Show their stickers' : 'Mute their stickers'} title={muted ? 'Show their stickers' : 'Mute their stickers'}>
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  )

  const scoreboard = (
    <header className="sr-bar sr-bar--friend">
      <div className="sr-player">
        {bubble('me')}
        <Tangyuan outfit={game.outfit} size={44} idle={false} />
        <b>You</b>
        <span className="sr-score display num">{myScore}</span>
      </div>
      <div className="sr-mid">
        {phase === 'round' ? (
          <span className={`sr-clock num ${left <= 8 ? 'is-low' : ''}`}>
            <Timer size={18} /> 0:{String(Math.max(0, left)).padStart(2, '0')}
          </span>
        ) : (
          <span className="sr-clock num">Friend match</span>
        )}
        <div className="sr-logs">
          <ol className="sr-log" aria-label="Your answers">
            {mine.map((value, i) => (
              <li key={i} className={value === null ? (i === at && phase === 'round' ? 'is-here' : '') : value ? 'is-right' : 'is-wrong'} />
            ))}
          </ol>
          <ol className="sr-log" aria-label={`${opponent.name}'s answers`}>
            {theirs.map((value, i) => (
              <li key={i} className={value === null ? '' : value ? 'is-right' : 'is-wrong'} />
            ))}
          </ol>
        </div>
      </div>
      <div className="sr-player sr-player--them">
        {bubble('them')}
        <span className="sr-score display num">{theirScore}</span>
        <b>{opponent.name}</b>
        <Tangyuan outfit={opponent.outfit as OutfitId} size={44} idle={false} mood={theyLeft ? 'sad' : 'think'} />
        <span className={`sr-typing ${theirDone ? 'is-done' : ''}`}>{theyLeft ? 'left the match' : theirDone ? 'finished' : `on question ${Math.min(theirs.filter((v) => v !== null).length + 1, questions.length)}`}</span>
      </div>
    </header>
  )

  if (phase === 'versus') {
    return (
      <div className="speedround speedround--versus">
        <div className="arena__versus">
          <div className="vs-side vs-side--you">
            <Tangyuan outfit={game.outfit} size={130} mood="happy" />
            <b className="title">You</b>
          </div>
          <div className="vs-count">
            <span className="display vs-mark">VS</span>
            <span className="display vs-number num" key={count}>
              {questions.length === 0 ? '…' : count}
            </span>
          </div>
          <div className="vs-side vs-side--them">
            <Tangyuan outfit={opponent.outfit as OutfitId} size={130} mood="wink" />
            <b className="title">{opponent.name}</b>
            <span>{opponent.rankLabel}</span>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    return (
      <div className="speedround">
        {scoreboard}
        <div className="arena__result">
          <Tangyuan outfit={game.outfit} mood={outcome === 'loss' ? 'sad' : 'wow'} size={130} />
          <span className={`stamp stamp--big is-landing ${outcome === 'loss' ? 'stamp--miss' : ''}`}>{outcome === 'win' ? 'You win' : outcome === 'draw' ? 'Draw' : `${opponent.name} wins`}</span>
          <p className="display arena__final num">
            {myScore} – {theirScore}
          </p>
          <p className="arena__delta">
            {theyLeft && !theirDone ? `${opponent.name} left, so the round is yours. ` : ''}
            Friend matches don’t move your rank. You earned <b className="num">{outcome === 'win' ? REWARDS.speedWinXp + 10 : 15} XP</b>.
          </p>
          {emoteBar}
          <div className="arena__actions">
            {rematchOffer ? (
              <button type="button" className="btn btn--lg btn--hl" onClick={() => go(`/arena/join/${rematchOffer}`)}>
                <Swords /> Join {opponent.name}’s rematch
              </button>
            ) : (
              <button type="button" className="btn btn--lg" onClick={offerRematch} disabled={theyLeft}>
                <Swords /> Rematch
              </button>
            )}
            {!isFriend && !saved && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  updateGame((state) => ({
                    ...state,
                    friends: [...(state.friends ?? []), { id: opponent.id, name: opponent.name, outfit: opponent.outfit as OutfitId, addedDay: day }],
                  }))
                  setSaved(true)
                  play('stamp')
                }}
              >
                <UserPlus /> Save {opponent.name} as a friend
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={() => go('/notebook')}>
              Open Mistake Notebook <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="speedround">
      {scoreboard}
      {phase === 'waiting' ? (
        <div className="arena__finding">
          <Tangyuan outfit={game.outfit} size={90} mood="think" />
          <p className="title">
            Done. Waiting for {opponent.name} — on question {Math.min(theirs.filter((v) => v !== null).length + 1, questions.length)} of {questions.length}.
          </p>
          {emoteBar}
        </div>
      ) : (
        q && (
          <>
            <article className="play__sheet sheet sheet--ruled" key={at}>
              <QuestionSheet
                question={q}
                picked={picked && picked !== ('none' as Letter) ? picked : null}
                onPick={picked ? undefined : (letter) => answer(letter)}
                graded={Boolean(picked)}
                header={
                  <div className="play__tags">
                    <span className="tag tag--quiet">
                      Round {at + 1} of {questions.length}
                    </span>
                    <span className="tag tag--quiet">{SKILL_SHORT[q.skill] ?? q.skill}</span>
                  </div>
                }
              />
            </article>
            <div className="friend-emotes">{emoteBar}</div>
          </>
        )
      )}
    </div>
  )
}
