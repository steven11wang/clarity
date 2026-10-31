// The Arena, in three tabs. Play: Speed Rounds — 洋葱学园's 试炼场 PK, rebuilt:
// five questions against one rival, thirty seconds each — or a friend by code.
// Ranks: the pen ladder and a sample board for scale. Study Hall: the chat.
// Speed Round is the one mode that shows right and wrong at once, because speed
// is the skill being trained. Misses still go to the Mistake Notebook.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, Check, MessagesSquare, Swords, Timer, Trophy } from 'lucide-react'

import { FounderBadge } from '../components/FounderCode.tsx'
import { FriendPanel } from '../components/FriendPanel.tsx'
import { StudyHall } from '../components/StudyHall.tsx'
import { newCode } from '../game/friendMatch.ts'
import { useHall } from '../game/hall.ts'
import { play } from '../sound.ts'
import { startFriendMatch, takeRematchCode } from './FriendMatch.tsx'

import type { Question } from '../../types.ts'
import { RANKS, REWARDS, SAMPLE_RIVALS, SKILL_SHORT, type OutfitId } from '../game/content.ts'
import { fileMiss, hash, rankFor, recordAnswer, seeded, settleSpeedRound } from '../game/engine.ts'
import { LETTERS, loadBank } from '../game/questions.ts'
import { getGame, updateGame, useGame, useToday } from '../game/store.ts'
import { go } from '../router.ts'
import { GameShell } from '../components/GameShell.tsx'
import { INK_VAR, RankEmblem } from '../components/Glyphs.tsx'
import { buzz } from '../components/hooks.ts'
import { QuestionSheet } from '../components/QuestionSheet.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'
import '../styles/arena.css'

type Letter = (typeof LETTERS)[number]
type Phase = 'lobby' | 'finding' | 'versus' | 'round' | 'result'
export type ArenaTab = 'play' | 'ranks' | 'hall'

const ROUNDS = 5
const SECONDS = 30

const TABS: Array<{ id: ArenaTab; label: string; path: string; ink: string; Icon: typeof Swords }> = [
  { id: 'play', label: 'Play', path: '/arena', ink: 'var(--yellow)', Icon: Swords },
  { id: 'ranks', label: 'Ranks', path: '/arena/ranks', ink: 'var(--blue)', Icon: Trophy },
  { id: 'hall', label: 'Study Hall', path: '/arena/hall', ink: 'var(--violet)', Icon: MessagesSquare },
]

// Illustrative scores, not standings or live player records.
const SAMPLE_BOARD = [
  { ...SAMPLE_RIVALS[0], rp: 350 },
  { ...SAMPLE_RIVALS[1], rp: 210 },
  { ...SAMPLE_RIVALS[2], rp: 90 },
  { ...SAMPLE_RIVALS[3], rp: 20 },
]

/** Tabs change the address (so Back works) without the page-turn between screens. */
function openTab(path: string) {
  if (window.location.hash !== `#${path}`) window.location.hash = path
}

export function Arena({ joinCode = null, tab = 'play' }: { joinCode?: string | null; tab?: ArenaTab }) {
  const game = useGame()
  const day = useToday()
  const [phase, setPhase] = useState<Phase>('lobby')
  const [bank, setBank] = useState<Question[]>([])
  const [matchSeed, setMatchSeed] = useState(0)
  const [hostCode, setHostCode] = useState<string | null>(() => takeRematchCode())
  const [incoming, setIncoming] = useState<string | null>(joinCode)
  const [seenAt, setSeenAt] = useState(() => Date.now())
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  // the hall stays open on every tab, so challenges and messages still arrive
  const hall = useHall(phase === 'lobby', 'in the Arena')
  useEffect(() => {
    void loadBank().then(setBank)
  }, [])
  // only a new link replaces the code; switching tabs mid-join leaves it be
  useEffect(() => {
    if (joinCode) setIncoming(joinCode)
  }, [joinCode])
  useEffect(() => {
    if (hall.challenge) play('join')
  }, [hall.challenge])
  useEffect(() => {
    if (tab === 'hall') setSeenAt(Date.now())
  }, [tab, hall.feed.length])

  const { rank, next, progress } = rankFor(game.arena.rp)
  const rival = useMemo(() => {
    const rand = seeded(hash(`rival:${day}:${matchSeed}`))
    const pick = SAMPLE_RIVALS[Math.floor(rand() * SAMPLE_RIVALS.length)]
    const rp = Math.max(0, game.arena.rp + Math.round((rand() - 0.5) * 120))
    return { ...pick, rp, rank: rankFor(rp).rank, accuracy: 0.52 + rand() * 0.25 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, matchSeed])

  const questions = useMemo(() => {
    if (bank.length === 0) return []
    const rand = seeded(hash(`speed:${day}:${matchSeed}`))
    const pool = bank.filter((q) => q.difficulty !== 'Hard' && q.passage.length < 600)
    return Array.from({ length: ROUNDS }, () => pool[Math.floor(rand() * pool.length)])
  }, [bank, day, matchSeed])

  const start = () => {
    play('commit')
    setPhase('finding')
    window.setTimeout(() => setPhase('versus'), 1400)
    window.setTimeout(() => {
      play('go')
      setPhase('round')
    }, 3000)
  }

  // a challenge is hosted from Play, where the code and the wait are shown
  const challenge = (peerId: string) => {
    const code = newCode()
    setIncoming(null)
    setHostCode(code)
    hall.challengePeer(peerId, code)
    play('commit')
    openTab('/arena')
  }

  const onTabKey = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    const to = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : step ? (index + step + TABS.length) % TABS.length : -1
    if (to < 0) return
    event.preventDefault()
    tabRefs.current[to]?.focus()
    openTab(TABS[to].path)
  }

  if (phase === 'round' && questions.length === ROUNDS) {
    return <Round questions={questions} rival={rival} onDone={() => setPhase('result')} />
  }

  const online = new Set(hall.peers.map((peer) => peer.id))
  const friends = game.friends ?? []
  const unread = tab === 'hall' ? 0 : hall.feed.filter((message) => message.from.id !== hall.me?.id && message.at > seenAt).length
  const board = [
    ...SAMPLE_BOARD.map((sample) => ({ name: sample.name, pet: sample.pet as OutfitId, rp: sample.rp, isYou: false })),
    { name: 'You', pet: game.outfit, rp: game.arena.rp, isYou: true },
  ].sort((a, b) => b.rp - a.rp || Number(b.isYou) - Number(a.isYou))

  return (
    <GameShell active="arena">
      <div className="arena">
        {phase === 'lobby' && (
          <>
            <header className="arena__head">
              <h1 className="display">Arena</h1>
              <p>Race a rival or a friend, climb from Pencil to the 800 Club, and talk to whoever else is studying right now.</p>
            </header>

            <div className="arena-tabs" role="tablist" aria-label="Arena">
              {TABS.map(({ id, label, path, ink, Icon }, index) => (
                <button
                  key={id}
                  ref={(node) => {
                    tabRefs.current[index] = node
                  }}
                  type="button"
                  role="tab"
                  id={`arena-tab-${id}`}
                  aria-controls={`arena-panel-${id}`}
                  aria-selected={tab === id}
                  tabIndex={tab === id ? 0 : -1}
                  className="arena-tabs__tab"
                  style={{ ['--mark' as string]: ink }}
                  onClick={() => openTab(path)}
                  onKeyDown={(event) => onTabKey(event, index)}
                >
                  <Icon aria-hidden="true" />
                  <span className="arena-tabs__label">{label}</span>
                  {id === 'hall' && unread > 0 && (
                    <span className="arena-tabs__badge num" aria-label={`${unread} new`}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {hall.challenge && (
              <div className="challenge" role="alert">
                <Tangyuan outfit={hall.challenge.from.outfit as OutfitId} size={48} mood="wink" />
                <p>
                  <b>{hall.challenge.from.name}</b> challenges you to a Speed Round.
                </p>
                <button
                  type="button"
                  className="btn btn--hl"
                  onClick={() => {
                    setHostCode(null)
                    setIncoming(hall.challenge!.code)
                    hall.dismissChallenge()
                    openTab('/arena')
                  }}
                >
                  <Swords /> Join
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={hall.dismissChallenge}>
                  Not now
                </button>
              </div>
            )}

            {/* every panel stays mounted, so a hosted code or a half-read chat survives a tab switch */}
            <div className="arena-panel arena-play" role="tabpanel" id="arena-panel-play" aria-labelledby="arena-tab-play" hidden={tab !== 'play'}>
              <div className="arena-play__main">
                <section className="speedcard sheet" style={{ ['--mark' as string]: INK_VAR[rank.ink] }} aria-labelledby="speed-title">
                  <div className="speedcard__intro">
                    <p className="eyebrow">Speed Round</p>
                    <h2 className="title" id="speed-title">
                      Five questions. Thirty seconds each.
                    </h2>
                    <p>One sample rival near your rank. Right and wrong show at once here — speed is the skill.</p>
                  </div>
                  <div className="speedcard__rank">
                    <RankEmblem rank={rank.id} size={84} />
                    <div className="speedcard__body">
                      <b className="speedcard__name">{rank.name}</b>
                      <span className="num speedcard__rp">
                        {game.arena.rp} RP · {game.arena.wins}W {game.arena.losses}L
                      </span>
                      {next ? (
                        <>
                          <span className="meter meter--thick" role="progressbar" aria-label={`Progress to ${next.name}`} aria-valuemin={rank.min} aria-valuemax={next.min} aria-valuenow={game.arena.rp} style={{ ['--value' as string]: progress }}>
                            <span />
                          </span>
                          <span className="speedcard__next num">
                            {next.min - game.arena.rp} RP to {next.name}
                          </span>
                        </>
                      ) : (
                        <span className="speedcard__next">Top of the kit.</span>
                      )}
                    </div>
                  </div>
                  <div className="speedcard__actions">
                    <button type="button" className="btn btn--lg" onClick={start} disabled={questions.length < ROUNDS}>
                      <Swords /> Find a rival
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => openTab('/arena/ranks')}>
                      All ranks <ArrowRight />
                    </button>
                  </div>
                </section>

                <section className="friends sheet" aria-labelledby="friends-title">
                  <header className="panel__head">
                    <h2 className="title panel__title" id="friends-title">
                      Your friends
                    </h2>
                    <span className="panel__aside num">{friends.length}</span>
                  </header>
                  {friends.length === 0 ? (
                    <p className="empty">Play someone with a code, or tap + next to a name in the Study Hall, and they’ll be listed here.</p>
                  ) : (
                    <ul className="friends__list">
                      {friends.map((friend) => {
                        const here = online.has(friend.id)
                        return (
                          <li key={friend.id} className={`person ${here ? 'is-here' : ''}`}>
                            <Tangyuan outfit={friend.outfit} size={34} idle={false} />
                            <span className="person__name">
                              {friend.name}
                              <span className={`person__status ${here ? 'is-online' : ''}`}>{here ? 'in the Arena now' : 'away'}</span>
                            </span>
                            <button type="button" className="btn btn--sm" disabled={!here} onClick={() => challenge(friend.id)}>
                              <Swords size={16} /> Challenge
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              </div>

              <FriendPanel onMatched={startFriendMatch} incomingCode={incoming} hostCode={hostCode} key={`${incoming ?? ''}:${hostCode ?? ''}`} />
            </div>

            <div className="arena-panel arena-ranks" role="tabpanel" id="arena-panel-ranks" aria-labelledby="arena-tab-ranks" hidden={tab !== 'ranks'}>
              <section className="pen-ladder sheet" aria-labelledby="ladder-title">
                <header className="pen-ladder__head">
                  <p className="eyebrow">Speed Round ranks</p>
                  <h2 className="title" id="ladder-title">
                    From Pencil to 800 Club
                  </h2>
                  <p>
                    Win +{REWARDS.speedWinRp} RP. A loss costs {Math.abs(REWARDS.speedLossRp)} RP. Your next round is a fresh start.
                  </p>
                </header>
                <ol className="pen-ladder__list">
                  {RANKS.map((r) => {
                    const here = r.id === rank.id
                    const done = !here && game.arena.rp >= r.min
                    return (
                      <li key={r.id} className={here ? 'is-here' : done ? 'is-done' : ''} style={{ ['--mark' as string]: INK_VAR[r.ink] }} aria-current={here ? 'step' : undefined}>
                        <span className="pen-ladder__emblem">
                          <RankEmblem rank={r.id} size={44} />
                        </span>
                        <span className="pen-ladder__name">
                          <b>{r.name}</b>
                          <small className="num">{r.min}+ RP</small>
                        </span>
                        {here ? (
                          <span className="pen-ladder__state pen-ladder__state--here">Your rank</span>
                        ) : done ? (
                          <span className="pen-ladder__state">
                            <Check size={16} /> Passed
                          </span>
                        ) : (
                          <span className="pen-ladder__state pen-ladder__state--ahead num">{r.min - game.arena.rp} to go</span>
                        )}
                      </li>
                    )
                  })}
                </ol>
                <p className="pen-ladder__foot num">
                  You: {game.arena.rp} RP · {game.arena.wins} {game.arena.wins === 1 ? 'win' : 'wins'} · {game.arena.losses} {game.arena.losses === 1 ? 'loss' : 'losses'}
                </p>
              </section>

              <section className="arena-board sheet" aria-labelledby="board-title">
                <header className="arena-board__head">
                  <div>
                    <p className="eyebrow">A little friendly perspective</p>
                    <h2 className="title" id="board-title">
                      Sample players
                    </h2>
                    <p>See how rank points compare. These are examples, not a live leaderboard.</p>
                  </div>
                  <span className="arena-board__sample">Examples</span>
                </header>
                <ol className="arena-board__list" aria-label="Sample players by rank points">
                  {board.map((entry, index) => (
                    <li key={entry.isYou ? 'you' : entry.name} className={entry.isYou ? 'is-you' : ''}>
                      <span className="arena-board__place num">{String(index + 1).padStart(2, '0')}</span>
                      <Tangyuan outfit={entry.pet} size={38} idle={false} />
                      <span className="arena-board__person">
                        <b>
                          {entry.name} {entry.isYou && game.founder && <FounderBadge />}
                        </b>
                        <small>
                          {rankFor(entry.rp).rank.name} · {entry.isYou ? 'you' : 'sample'}
                        </small>
                      </span>
                      <strong className="arena-board__score num">
                        {entry.rp} <small>RP</small>
                      </strong>
                    </li>
                  ))}
                </ol>
                <button type="button" className="btn arena-board__go" onClick={start} disabled={questions.length < ROUNDS}>
                  <Swords /> Play a Speed Round
                </button>
              </section>
            </div>

            <div className="arena-panel" role="tabpanel" id="arena-panel-hall" aria-labelledby="arena-tab-hall" hidden={tab !== 'hall'}>
              <StudyHall hall={hall} onChallenge={challenge} visible={tab === 'hall'} />
            </div>
          </>
        )}

        {phase === 'finding' && (
          <div className="arena__finding">
            <div className="pens-spin" aria-hidden="true">
              {RANKS.slice(0, 4).map((r) => (
                <RankEmblem key={r.id} rank={r.id} size={64} />
              ))}
            </div>
            <p className="title">Finding a rival near {game.arena.rp} RP…</p>
          </div>
        )}

        {phase === 'versus' && (
          <div className="arena__versus">
            <div className="vs-side vs-side--you">
              <Tangyuan outfit={game.outfit} size={130} mood="happy" />
              <b className="title">You</b>
              <span>{rank.name}</span>
            </div>
            <span className="display vs-mark">VS</span>
            <div className="vs-side vs-side--them">
              <Tangyuan outfit={rival.pet} size={130} mood="think" />
              <b className="title">{rival.name}</b>
              <span>
                {rival.rank.name} <span className="hand">· sample rival</span>
              </span>
            </div>
          </div>
        )}

        {phase === 'result' && (
          <Result
            onAgain={() => {
              setMatchSeed((value) => value + 1)
              setPhase('lobby')
            }}
          />
        )}
      </div>
    </GameShell>
  )
}

// ---------------------------------------------------------------------------

type RivalInfo = { name: string; pet: (typeof SAMPLE_RIVALS)[number]['pet']; accuracy: number; rank: { name: string } }

let lastMatch: { you: number; them: number; won: boolean; rpBefore: number; rival: string } | null = null

function Round({ questions, rival, onDone }: { questions: Question[]; rival: RivalInfo; onDone: () => void }) {
  const day = useToday()
  const [at, setAt] = useState(0)
  const [picked, setPicked] = useState<Letter | null>(null)
  const [left, setLeft] = useState(SECONDS)
  const [you, setYou] = useState(0)
  const [them, setThem] = useState(0)
  const themRef = useRef(0)
  const youRef = useRef(0)
  const [rivalDone, setRivalDone] = useState(false)
  const rivalScores = () => {
    themRef.current += 1
    setThem(themRef.current)
  }
  const [log, setLog] = useState<Array<boolean | null>>(() => questions.map(() => null))
  const rand = useRef(seeded(hash(`rival-play:${day}:${questions[0]?.id}`)))
  const q = questions[at]

  // the rival answers somewhere between 7 and 22 seconds in
  const rivalAt = useMemo(() => 7 + Math.floor(rand.current() * 16), [at])
  const rivalRight = useMemo(() => rand.current() < rival.accuracy, [at, rival.accuracy])

  useEffect(() => {
    if (picked) return
    const timer = window.setInterval(() => setLeft((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [picked, at])

  useEffect(() => {
    if (!rivalDone && SECONDS - left >= rivalAt) {
      setRivalDone(true)
      if (rivalRight) rivalScores()
    }
    if (left <= 5 && left > 0 && !picked) play('tick')
    if (left <= 0 && !picked) answer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  const answer = (letter: Letter | null) => {
    if (picked) return
    const correct = letter === q.answer
    setPicked(letter ?? ('none' as Letter))
    setLog((list) => list.map((value, i) => (i === at ? correct : value)))
    buzz(correct ? 14 : [10, 40, 10])
    play(correct ? 'right' : 'wrong')
    if (correct) {
      youRef.current += 1
      setYou(youRef.current)
    }
    updateGame((state) => {
      const next = recordAnswer(state, q.skill, correct)
      return correct ? next : fileMiss(next, q.id, q.skill, day)
    })
    // the rival finishes this question too, if they hadn't yet
    if (!rivalDone) {
      setRivalDone(true)
      if (rivalRight) rivalScores()
    }
    window.setTimeout(advance, 1300)
  }

  const advance = () => {
    if (at + 1 >= questions.length) {
      const finalYou = youRef.current
      const finalThem = themRef.current
      // a tie goes to you if you scored at all: speed matters less than showing up
      const won = finalYou > finalThem || (finalYou === finalThem && finalYou > 0)
      const rpBefore = getGame().arena.rp
      updateGame((state) => settleSpeedRound(state, won))
      lastMatch = { you: finalYou, them: finalThem, won, rpBefore, rival: rival.name }
      onDone()
      return
    }
    setAt(at + 1)
    setPicked(null)
    setLeft(SECONDS)
    setRivalDone(false)
  }

  return (
    <div className="speedround">
      <header className="sr-bar">
        <div className="sr-player">
          <Tangyuan outfit={getGame().outfit} size={44} idle={false} />
          <b>You</b>
          <span className="sr-score display num">{you}</span>
        </div>
        <div className="sr-mid">
          <span className={`sr-clock num ${left <= 8 ? 'is-low' : ''}`}>
            <Timer size={18} /> 0:{String(Math.max(0, left)).padStart(2, '0')}
          </span>
          <ol className="sr-log">
            {log.map((value, i) => (
              <li key={i} className={value === null ? (i === at ? 'is-here' : '') : value ? 'is-right' : 'is-wrong'} />
            ))}
          </ol>
          <span className="sr-clockbar" style={{ ['--value' as string]: Math.max(0, left) / SECONDS }} />
        </div>
        <div className="sr-player sr-player--them">
          <span className="sr-score display num">{them}</span>
          <b>{rival.name}</b>
          <Tangyuan outfit={rival.pet} size={44} idle={false} mood={rivalDone ? 'wink' : 'think'} />
          <span className={`sr-typing ${rivalDone ? 'is-done' : ''}`}>{rivalDone ? 'answered' : 'thinking…'}</span>
        </div>
      </header>
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
              <span className="tag tag--quiet">{SKILL_SHORT[q.skill]}</span>
            </div>
          }
        />
      </article>
    </div>
  )
}

function Result({ onAgain }: { onAgain: () => void }) {
  const game = useGame()
  const match = lastMatch
  useEffect(() => {
    if (match) play(match.won ? 'win' : 'lose')
  }, [match])
  if (!match) {
    return (
      <div className="arena__result">
        <button type="button" className="btn" onClick={onAgain}>
          Back to the lobby
        </button>
      </div>
    )
  }
  const delta = game.arena.rp - match.rpBefore
  const { rank } = rankFor(game.arena.rp)
  return (
    <div className="arena__result">
      <Tangyuan outfit={game.outfit} mood={match.won ? 'wow' : 'sad'} size={140} />
      <span className={`stamp stamp--big is-landing ${match.won ? '' : 'stamp--miss'}`}>{match.won ? 'Win' : 'Close one'}</span>
      <p className="display arena__final num">
        {match.you} – {match.them}
      </p>
      <p className="arena__delta">
        <Trophy size={18} /> <b className="num">{delta >= 0 ? `+${delta}` : delta} RP</b> · now {rank.name}, {game.arena.rp} RP
      </p>
      {!match.won && <p className="hand">Every miss from this round is waiting in your Mistake Notebook.</p>}
      <div className="arena__actions">
        <button type="button" className="btn btn--lg" onClick={onAgain}>
          <Swords /> Play again
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => go('/notebook')}>
          Open Mistake Notebook <ArrowRight />
        </button>
      </div>
    </div>
  )
}
