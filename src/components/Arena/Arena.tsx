import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import {
  ARENA_AVATARS,
  QUESTIONS_PER_BATTLE,
  QUEUE_TIMEOUT_MS,
  type ArenaMode,
} from '../../arena/config.ts'
import {
  applyRankChange,
  battleOutcome,
  battleReducer,
  botIdentity,
  botProfileFor,
  drawQuestions,
  filterPool,
  initialBattle,
  modeConfig,
  pointsFor,
  questionsByIds,
  rankLabel,
  rankScore,
  settleMatch,
  type ArenaOpponent,
  type MatchSession,
} from '../../arena/model.ts'
import {
  botTransport,
  hostInvite,
  isLiveArenaAvailable,
  joinInvite,
  joinQueue,
  liveTransport,
  newInviteCode,
  type MatchTransport,
} from '../../arena/matchmaking.ts'
import {
  loadArenaHistory,
  loadArenaProfile,
  recordArenaMatch,
  saveArenaProfile,
} from '../../arena/storage.ts'
import { useAuthProfile } from '../../auth/AuthContext.tsx'
import { now } from '../../storage/index.ts'
import type { ChoiceLetter } from '../../review/ordering.ts'
import type { Question } from '../../types.ts'
import { ArenaBattle } from './ArenaBattle.tsx'
import { ArenaLobby } from './ArenaLobby.tsx'
import { ArenaResult } from './ArenaResult.tsx'
import { ArenaSearching } from './ArenaSearching.tsx'
import { ArenaVersus } from './ArenaVersus.tsx'
import './arena.css'

export type ArenaAnswer = {
  question: Question
  chosen: string
  correct: boolean
  elapsedMs: number
}

type Stage = 'lobby' | 'searching' | 'versus' | 'battle' | 'result'

type Search = { kind: 'queue' | 'invite'; code?: string; seen: number }

type ActiveMatch = {
  session: MatchSession
  questions: Question[]
  transport: MatchTransport
  mode: ArenaMode
}

// The Arena is a five-stage machine - lobby, searching, versus, battle, result -
// and every stage owns exactly one screen. The match itself is peer-to-peer over
// Realtime: no server scores a battle, both sides score their own board from a
// shared seed, and a missing rival degrades to a scripted training opponent.
export function Arena({
  questions,
  onExit,
  onOpenReviews,
  onBattleComplete,
}: {
  questions: Question[]
  onExit: () => void
  onOpenReviews: () => void
  onBattleComplete: (matchId: string, answers: ArenaAnswer[]) => void
}) {
  const auth = useAuthProfile()
  const [profile, setProfile] = useState(() => loadArenaProfile(now()))
  const [history, setHistory] = useState(() => loadArenaHistory())
  const [stage, setStage] = useState<Stage>('lobby')
  const [mode, setMode] = useState<ArenaMode>('ranked')
  const [domain, setDomain] = useState('Mixed')
  const [difficulty, setDifficulty] = useState('Mixed')
  const [search, setSearch] = useState<Search | null>(null)
  const [match, setMatch] = useState<ActiveMatch | null>(null)
  const [battle, dispatch] = useReducer(battleReducer, initialBattle(QUESTIONS_PER_BATTLE))
  const [settled, setSettled] = useState<{
    xpGained: number
    change: ReturnType<typeof applyRankChange>
    profile: typeof profile
    missed: number
  } | null>(null)
  // Whatever cancels the search in flight - a queue subscription or a timer.
  const cancelSearch = useRef(() => {})
  // Settling is idempotent: the reducer can reach `complete` from either side.
  const settling = useRef(false)

  const selfId = auth.profileId ?? `local-${auth.displayName}`
  const avatarId = auth.avatarId ?? ARENA_AVATARS[0].id
  const domains = useMemo(
    () => [...new Set(questions.map((question) => question.domain))].sort(),
    [questions],
  )

  const config = useMemo(
    () => modeConfig(mode, domain, difficulty, QUESTIONS_PER_BATTLE),
    [difficulty, domain, mode],
  )
  const poolCount = useMemo(() => filterPool(questions, config).length, [config, questions])
  const pickQuestionIds = useCallback(
    (seed: string) => drawQuestions(questions, config, seed).map((question) => question.id),
    [config, questions],
  )

  const startBotMatch = useCallback(() => {
    const matchId = `bot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const drawn = drawQuestions(questions, config, matchId)
    if (drawn.length === 0) return

    const identity = botIdentity(matchId)
    const opponent: ArenaOpponent = {
      id: `bot:${matchId}`,
      name: identity.name,
      avatarId: ARENA_AVATARS[identity.avatarSeed % ARENA_AVATARS.length].id,
      rankLabel: rankLabel(profile.rank),
      isBot: true,
    }
    // Overreach is meant to be a stretch: the training opponent is scripted two
    // divisions above where you actually sit.
    const transport = botTransport(
      matchId,
      drawn.length,
      botProfileFor(rankScore(profile.rank) + (mode === 'overreach' ? 6 : 0)),
    )

    setMatch({
      session: {
        matchId,
        seed: matchId,
        questionIds: drawn.map((question) => question.id),
        config,
        opponent,
        role: 'host',
      },
      questions: drawn,
      transport,
      mode,
    })
    dispatch({ type: 'reset', total: drawn.length })
    setSearch(null)
    setStage('versus')
  }, [config, mode, profile.rank, questions])

  const startLiveMatch = useCallback(
    (session: MatchSession) => {
      const drawn = questionsByIds(questions, session.questionIds)
      // The host drew from its own bank; if ours can't produce the same set,
      // there is no shared board to play on.
      if (drawn.length === 0) {
        startBotMatch()
        return
      }
      setMatch({ session, questions: drawn, transport: liveTransport(session.matchId, selfId), mode })
      dispatch({ type: 'reset', total: drawn.length })
      setSearch(null)
      setStage('versus')
    },
    [mode, questions, selfId, startBotMatch],
  )

  useEffect(() => {
    if (stage === 'versus' && match) {
      settling.current = false
      setSettled(null)
    }
  }, [match, stage])

  const findOpponent = useCallback(() => {
    if (poolCount < QUESTIONS_PER_BATTLE) return
    setSearch({ kind: 'queue', seen: 0 })
    setStage('searching')

    if (!isLiveArenaAvailable()) {
      const timer = setTimeout(startBotMatch, 1600)
      cancelSearch.current = () => clearTimeout(timer)
      return
    }

    const pending = joinQueue({
      config,
      me: { id: selfId, name: auth.displayName, avatarId, rankLabel: rankLabel(profile.rank) },
      pickQuestionIds,
      onWaiting: (seen) => setSearch((current) => current && { ...current, seen }),
    })
    // Nobody should stare at a queue: after the timeout the training opponent
    // takes the slot.
    const timer = setTimeout(() => {
      pending.cancel()
      startBotMatch()
    }, QUEUE_TIMEOUT_MS)
    cancelSearch.current = () => {
      clearTimeout(timer)
      pending.cancel()
    }
    pending.promise.then((session) => {
      clearTimeout(timer)
      if (session) startLiveMatch(session)
    })
  }, [
    auth.displayName,
    avatarId,
    config,
    pickQuestionIds,
    poolCount,
    profile.rank,
    selfId,
    startBotMatch,
    startLiveMatch,
  ])

  const invite = useCallback(() => {
    if (!isLiveArenaAvailable() || poolCount < QUESTIONS_PER_BATTLE) return
    const code = newInviteCode()
    setSearch({ kind: 'invite', code, seen: 0 })
    setStage('searching')
    // An invite has no timeout - the host waits as long as they like.
    const pending = hostInvite({
      code,
      config,
      me: { id: selfId, name: auth.displayName, avatarId, rankLabel: rankLabel(profile.rank) },
      pickQuestionIds,
    })
    cancelSearch.current = () => pending.cancel()
    pending.promise.then((session) => {
      if (session) startLiveMatch(session)
    })
  }, [auth.displayName, avatarId, config, pickQuestionIds, poolCount, profile.rank, selfId, startLiveMatch])

  // Arriving on ?arena=CODE means someone sent an invite link. Consume the code
  // from the URL so a reload doesn't try to rejoin a finished match.
  useEffect(() => {
    if (typeof window === 'undefined' || !isLiveArenaAvailable()) return
    const code = new URLSearchParams(window.location.search).get('arena')
    if (!code) return
    window.history.replaceState({}, '', window.location.pathname)
    setSearch({ kind: 'invite', code, seen: 0 })
    setStage('searching')
    const pending = joinInvite(code, {
      id: selfId,
      name: auth.displayName,
      avatarId,
      rankLabel: rankLabel(profile.rank),
    })
    cancelSearch.current = () => pending.cancel()
    pending.promise.then((session) => {
      if (session) startLiveMatch(session)
    })
    // Deliberately once, on mount: this is a one-shot read of the landing URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!match) return
    const unsubscribe = match.transport.subscribe((message) => {
      if (message.type === 'answer') {
        dispatch({
          type: 'opponent-answer',
          index: message.index,
          correct: message.correct,
          points: message.points,
        })
      } else if (message.type === 'finished') {
        dispatch({ type: 'opponent-finished' })
      } else {
        dispatch({ type: 'forfeit' })
      }
    })
    return () => {
      unsubscribe()
      match.transport.leave()
    }
  }, [match])

  useEffect(() => () => cancelSearch.current(), [])

  const finishBattle = useCallback(() => {
    if (!match || settling.current) return
    settling.current = true

    const outcome = battleOutcome(battle)
    const at = now()
    const result = settleMatch(profile, {
      outcome,
      points: battle.mine.points,
      correct: battle.mine.correct,
      at,
    })
    // Overreach pays double on a win: one star from the match, one for the
    // handicap.
    const change =
      match.mode === 'overreach' && outcome === 'win'
        ? applyRankChange(result.change.rank, 'win')
        : result.change
    const nextProfile = { ...result.profile, rank: change.rank }

    const answers: ArenaAnswer[] = battle.records.flatMap((record) => {
      const question = match.questions.find((entry) => entry.id === record.questionId)
      return question
        ? [
            {
              question,
              chosen: record.choice ?? '',
              correct: record.correct,
              elapsedMs: record.elapsedMs,
            },
          ]
        : []
    })
    const missed = answers.filter((answer) => !answer.correct).length

    saveArenaProfile(nextProfile)
    recordArenaMatch({
      matchId: match.session.matchId,
      finishedAt: at,
      domain: match.session.config.domain,
      difficulty: match.session.config.difficulty,
      outcome,
      points: battle.mine.points,
      opponentPoints: battle.theirs.points,
      correct: battle.mine.correct,
      opponentCorrect: battle.theirs.correct,
      opponentName: match.session.opponent.name,
      opponentIsBot: match.session.opponent.isBot,
      xpGained: result.xpGained,
      rankLabel: rankLabel(nextProfile.rank),
    })
    if (answers.length > 0) onBattleComplete(match.session.matchId, answers)

    setProfile(nextProfile)
    setHistory(loadArenaHistory())
    setSettled({ xpGained: result.xpGained, change, profile: nextProfile, missed })
    match.transport.leave()
    setStage('result')
  }, [battle, match, onBattleComplete, profile])

  useEffect(() => {
    if (stage === 'battle' && battle.phase === 'complete') finishBattle()
  }, [battle.phase, finishBattle, stage])

  // Once your answers are locked there is no reason to sit through the rest of
  // a scripted opponent's pace.
  useEffect(() => {
    if (battle.phase === 'standby') match?.transport.rush?.()
  }, [battle.phase, match])

  function answer(choice: ChoiceLetter | null, elapsedMs: number) {
    if (!match) return
    const question = match.questions[battle.index]
    if (!question) return
    const correct = choice === question.answer
    const index = battle.index
    dispatch({ type: 'answer', questionId: question.id, choice, correct, elapsedMs })
    // Only the verdict crosses the wire, never the choice: there is nothing for
    // an opponent to read off it.
    match.transport.send({ type: 'answer', index, correct, points: pointsFor(correct, elapsedMs) })
    if (index + 1 >= match.questions.length) match.transport.send({ type: 'finished' })
  }

  function leaveMatch() {
    match?.transport.leave()
    setMatch(null)
    setStage('lobby')
  }

  if (stage === 'searching') {
    return (
      <ArenaSearching
        kind={search?.kind ?? 'queue'}
        code={search?.code}
        opponentsSeen={search?.seen ?? 0}
        timeoutMs={QUEUE_TIMEOUT_MS}
        live={isLiveArenaAvailable()}
        onCancel={() => {
          cancelSearch.current()
          setSearch(null)
          setStage('lobby')
        }}
      />
    )
  }

  if (stage === 'versus' && match) {
    return (
      <ArenaVersus
        me={{
          name: auth.displayName,
          avatarId,
          rank: profile.rank,
          rankLabel: rankLabel(profile.rank),
        }}
        rival={match.session.opponent}
        rivalRank={profile.rank}
        config={match.session.config}
        onDone={() => {
          dispatch({ type: 'countdown-done' })
          match.transport.begin()
          setStage('battle')
        }}
      />
    )
  }

  if (stage === 'battle' && match) {
    if (battle.mine.finished) {
      return (
        <section className="arena-shell arena-standby">
          <p className="arena-standby__eyebrow">Answers locked</p>
          <h1>You’re done. {match.session.opponent.name} is still going.</h1>
          <p className="arena-standby__score">
            {battle.mine.points} points / {battle.mine.correct} of {battle.mine.answered} correct
          </p>
          <p className="arena-standby__wait">
            Holding for the final score. {battle.theirs.answered} of {battle.total} answered.
          </p>
        </section>
      )
    }
    return (
      <ArenaBattle
        question={match.questions[Math.min(battle.index, match.questions.length - 1)]}
        index={battle.index}
        total={battle.total}
        seed={match.session.seed}
        mine={battle.mine}
        theirs={battle.theirs}
        myName={auth.displayName}
        myAvatarId={avatarId}
        rivalName={match.session.opponent.name}
        rivalAvatarId={match.session.opponent.avatarId}
        onAnswer={answer}
        onLeave={leaveMatch}
      />
    )
  }

  if (stage === 'result' && match && settled) {
    return (
      <ArenaResult
        outcome={battleOutcome(battle)}
        mine={battle.mine}
        theirs={battle.theirs}
        rivalName={match.session.opponent.name}
        rivalIsBot={match.session.opponent.isBot}
        xpGained={settled.xpGained}
        profile={settled.profile}
        change={settled.change}
        missed={settled.missed}
        onRematch={() => {
          setMatch(null)
          findOpponent()
        }}
        onReview={onOpenReviews}
        onExit={onExit}
      />
    )
  }

  return (
    <ArenaLobby
      profile={profile}
      history={history}
      domains={domains}
      mode={mode}
      domain={domain}
      difficulty={difficulty}
      poolCount={poolCount}
      liveAvailable={isLiveArenaAvailable()}
      onModeChange={setMode}
      onDomainChange={setDomain}
      onDifficultyChange={setDifficulty}
      onStart={findOpponent}
      onInvite={invite}
    />
  )
}
