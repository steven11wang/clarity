// A page: the two-pass loop played as a game.
//   answer  — every question, choice + confidence, no feedback (attempt before reveal)
//   grading — the red pen marks the whole page in one sweep, then the score stamp lands
//   review  — each miss: redo it, name the trap, then (only then) the explanation;
//             a right answer marked “Guessing” is shown why it was right, and clipped too
//   rewards — XP, streak, star, quests, and a sticker pack to tear open

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'

import type { Confidence, Question } from '../../types.ts'
import {
  COMEBACK_DAYS,
  DOMAINS,
  LUCKY_START_STAGE,
  PATH,
  QUEST_TEMPLATES,
  REWARDS,
  SKILL_SHORT,
  TWIN_FROM_STAGE,
  domainOf,
  trapById,
  trapsFor,
  type Difficulty,
  type TrapId,
} from '../game/content.ts'
import {
  addDays,
  awardStar,
  bumpQuest,
  completeNode,
  currentNode,
  dueComebacks,
  fileLucky,
  fileMiss,
  gain,
  levelInfo,
  logPage,
  markStudied,
  nameTrap,
  recordAnswer,
  settleComeback,
} from '../game/engine.ts'
import { FIRST_QUESTION_ID, LETTERS, STARTER, byId, disguise, loadBank, pickPage } from '../game/questions.ts'
import { getGame, updateGame, useGame, useToday } from '../game/store.ts'
import { go } from '../router.ts'
import { track } from '../game/track.ts'
import { ClipGlyph, INK_VAR, InkGlyph, PenMark, StreakGlyph, TrapGlyph } from '../components/Glyphs.tsx'
import { buzz, useCountUp } from '../components/hooks.ts'
import { PackOpener } from '../components/Panels.tsx'
import { QuestionSheet } from '../components/QuestionSheet.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'
import { play } from '../sound.ts'

type Letter = (typeof LETTERS)[number]
/** `twin`: a new question in the same skill, riding along with a late-stage comeback */
type Item = { q: Question; comeback: boolean; twin?: boolean }
type Answer = { picked: Letter; confidence: Confidence }

const CONFIDENCE: Array<{ id: Confidence; label: string; key: string }> = [
  { id: 'sure', label: 'Sure', key: '1' },
  { id: 'leaning', label: 'Leaning', key: '2' },
  { id: 'guessing', label: 'Guessing', key: '3' },
]

function weekday(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
}

/** Right first time, but marked “Guessing”. Comebacks are settled on their own ladder. */
function isLucky(entry: Item, answer: Answer | null | undefined): boolean {
  return !entry.comeback && answer?.picked === entry.q.answer && answer.confidence === 'guessing'
}

function luckyNote(count: number): string {
  if (count === 0) return ''
  return ` ${count === 1 ? 'One right answer was a guess' : `${count} right answers were guesses`}, so ${count === 1 ? 'it’s' : 'they’re'} clipped in for a check.`
}

function buildSession(bank: Question[], target: string, day: string): { items: Item[]; title: string; nodeId: string | null } {
  const game = getGame()
  const avoid = new Set(Object.keys(game.misses))
  const seed = `${target}:${day}:${game.xp}`
  // A comeback that has been beaten a couple of times may be remembered rather
  // than understood. From then on it brings a twin — a question the student has
  // never seen, same skill and difficulty — placed right after it. At most two a page.
  let twins = 0
  const comebacks = (limit: number): Item[] =>
    dueComebacks(game, day)
      .slice(0, limit)
      .flatMap((entry): Item[] => {
        const q = byId(bank, entry.qid)
        if (!q) return []
        const back: Item = { q: disguise(q, day), comeback: true }
        if (entry.stage < TWIN_FROM_STAGE || twins >= 2) return [back]
        const twin = pickPage(bank, q.skill, q.difficulty as Difficulty, 1, `${seed}:twin:${q.id}`, avoid).find((other) => other.id !== q.id)
        if (!twin) return [back]
        twins += 1
        avoid.add(twin.id)
        return [back, { q: twin, comeback: false, twin: true }]
      })

  if (target === 'comebacks') {
    return { items: comebacks(8), title: 'Comebacks', nodeId: null }
  }
  if (target === 'first') {
    // one hand-picked, easy, interesting question: a quick win before anything else
    const q = byId(bank, FIRST_QUESTION_ID) ?? STARTER[0]
    return { items: [{ q, comeback: false }], title: 'Warm-up', nodeId: null }
  }
  const node = PATH.find((item) => item.id === target)
  if (!node) return { items: [], title: 'Page', nodeId: null }
  if (node.kind === 'boss') {
    const domain = DOMAINS.find((item) => item.id === node.domainId) ?? DOMAINS[0]
    const items = Array.from({ length: 7 }, (_, i) => {
      const skill = domain.skills[i % domain.skills.length]
      return pickPage(bank, skill, i % 3 === 2 ? 'Medium' : 'Hard', 1, `${seed}:${i}`, avoid)[0]
    })
      .filter(Boolean)
      .map((q) => ({ q, comeback: false }))
    return { items, title: node.title, nodeId: node.id }
  }
  // weave due comebacks (each with its twin, if it has one) in after the 1st and 3rd fresh question
  const back = comebacks(2)
  const fresh = pickPage(bank, node.skill, node.difficulty, 5, seed, avoid).map((q): Item => ({ q, comeback: false }))
  const items: Item[] = []
  let slot = 0
  fresh.forEach((item, i) => {
    items.push(item)
    if (i % 2 === 0) {
      // a comeback and the twin that follows it go in together
      const group = back.slice(slot).findIndex((entry, at) => at > 0 && entry.comeback)
      const take = group === -1 ? back.length - slot : group
      items.push(...back.slice(slot, slot + take))
      slot += take
    }
  })
  items.push(...back.slice(slot))
  return { items, title: node.title, nodeId: node.id }
}

// ---------------------------------------------------------------------------

export function Play({ target }: { target: string }) {
  const day = useToday()
  const [bank, setBank] = useState<Question[] | null>(null)
  useEffect(() => {
    void loadBank().then(setBank)
  }, [])
  const session = useMemo(() => (bank ? buildSession(bank, target, day) : null), [bank, target, day])

  if (!session) {
    return (
      <div className="play play--loading">
        <Tangyuan mood="think" size={110} />
        <p className="hand">sharpening pencils…</p>
      </div>
    )
  }
  if (session.items.length === 0) {
    return (
      <div className="play play--loading">
        <Tangyuan mood="wink" size={110} />
        <p>Nothing due right now. Every comeback is beaten — for today.</p>
        <button type="button" className="btn" onClick={() => go('/today')}>
          Back to today
        </button>
      </div>
    )
  }
  return <Session key={`${target}:${day}`} items={session.items} title={session.title} nodeId={session.nodeId} target={target} />
}

// ---------------------------------------------------------------------------

type Outcome = {
  xp: number
  ink: number
  right: number
  beaten: number
  /** right answers marked “Guessing”, clipped in for a check */
  lucky: number
  /** misses the student was “Sure” about */
  sureWrong: number
  levelBefore: number
  streakBefore: number
  starEarned: string | null
}

function Session({ items, title, nodeId, target }: { items: Item[]; title: string; nodeId: string | null; target: string }) {
  const day = useToday()
  const [phase, setPhase] = useState<'answer' | 'grading' | 'review' | 'rewards'>('answer')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Array<Answer | null>>(() => items.map(() => null))
  const [picked, setPicked] = useState<Letter | null>(null)
  const [struck, setStruck] = useState<Letter[]>([])
  const [turning, setTurning] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const node = nodeId ? PATH.find((item) => item.id === nodeId) : null

  const item = items[index]
  const answeredCount = answers.filter(Boolean).length
  const allAnswered = answeredCount === items.length

  const goTo = (next: number) => {
    play('turn')
    setTurning(true)
    window.setTimeout(() => {
      setIndex(next)
      setPicked(answers[next]?.picked ?? null)
      setStruck([])
      setTurning(false)
    }, 180)
  }

  const commit = (confidence: Confidence) => {
    if (!picked) return
    const next = answers.map((answer, i) => (i === index ? { picked, confidence } : answer))
    setAnswers(next)
    buzz(8)
    play('commit')
    const nextOpen = next.findIndex((answer, i) => i > index && !answer)
    if (nextOpen > -1) goTo(nextOpen)
    else if (index < items.length - 1 && !next[index + 1]) goTo(index + 1)
  }

  const turnIn = () => {
    const game = getGame()
    const levelBefore = levelInfo(game.xp).level
    const streakBefore = game.streak.lastDay === day ? -1 : game.streak.count
    let xp = REWARDS.pageXp
    let ink = 0
    let right = 0
    let beaten = 0
    let sureRight = 0
    let lucky = 0
    let sureWrong = 0
    updateGame((state) => {
      let next = state
      items.forEach((entry, i) => {
        const answer = answers[i]
        const correct = answer?.picked === entry.q.answer
        next = recordAnswer(next, entry.q.skill, correct, entry.q.difficulty as Difficulty)
        if (correct) right += 1
        if (correct && answer?.confidence === 'sure') sureRight += 1
        if (!correct && answer?.confidence === 'sure') sureWrong += 1
        if (entry.comeback) {
          next = settleComeback(next, entry.q.id, correct, day)
          if (correct) {
            beaten += 1
            xp += REWARDS.comebackXp
            ink += REWARDS.comebackInk
          }
        } else if (correct) {
          xp += REWARDS.firstTryXp
          ink += REWARDS.firstTryInk
          // right, but by the student's own account a guess: it earns its reward and
          // is clipped in anyway, so a lucky hit can't hide a gap
          if (isLucky(entry, answer)) {
            if (!next.misses[entry.q.id]) lucky += 1
            next = fileLucky(next, entry.q.id, entry.q.skill, day)
          }
        } else {
          next = fileMiss(next, entry.q.id, entry.q.skill, day, answer?.confidence === 'sure')
        }
      })
      if (right === items.length) ink += REWARDS.perfectInk
      next = gain(next, xp, ink)
      next = markStudied(next, day)
      next = logPage(next, day, xp)
      next = { ...next, packs: next.packs + 1, onboarded: true, ...(target === 'first' && !state.onboarded ? { tourPending: true } : {}) }
      next = bumpQuest(next, 'turn-in-page')
      next = bumpQuest(next, 'sure-and-right', sureRight)
      next = bumpQuest(next, 'beat-comebacks', beaten)
      next = bumpQuest(next, 'earn-xp', xp)
      if (node) next = completeNode(next, node.id)
      return next
    })
    let starEarned: string | null = null
    if (node?.kind === 'page' && node.skill && node.difficulty) {
      const had = getGame().skills[node.skill]?.stars[node.difficulty]
      updateGame((state) => awardStar(state, node.skill as string, node.difficulty as Difficulty, right, items.length))
      if (!had && getGame().skills[node.skill]?.stars[node.difficulty]) starEarned = `${SKILL_SHORT[node.skill]} · ${node.difficulty}`
    }
    setOutcome({ xp, ink, right, beaten, lucky, sureWrong, levelBefore, streakBefore, starEarned })
    track('page_turn_in', {
      kind: target === 'first' ? 'warmup' : target === 'comebacks' ? 'comebacks' : (node?.kind ?? 'page'),
      total: items.length,
      right,
      beaten,
      lucky,
      sure_wrong: sureWrong,
      comebacks: items.filter((entry) => entry.comeback).length,
    })
    setPhase('grading')
  }

  // keyboard: A–D to pick, 1–3 for confidence, arrows to move
  useEffect(() => {
    if (phase !== 'answer') return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea')) return
      const letter = event.key.toUpperCase()
      if ((LETTERS as string[]).includes(letter)) setPicked(letter as Letter)
      const level = CONFIDENCE.find((c) => c.key === event.key)
      if (level && picked) commit(level.id)
      if (event.key === 'ArrowRight' && index < items.length - 1) goTo(index + 1)
      if (event.key === 'ArrowLeft' && index > 0) goTo(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // what the review walks through: every miss, then every lucky guess
  const misses = items
    .map((entry, i) => ({ entry, answer: answers[i], i }))
    .filter(({ entry, answer }) => answer?.picked !== entry.q.answer)
  const guesses = items.map((entry, i) => ({ entry, answer: answers[i], i })).filter(({ entry, answer }) => isLucky(entry, answer))
  const toReview = [
    ...misses.map(({ entry, answer }) => ({ item: entry, wrong: answer?.picked ?? null, sure: answer?.confidence === 'sure', lucky: false })),
    ...guesses.map(({ entry }) => ({ item: entry, wrong: null, sure: false, lucky: true })),
  ]

  if (phase === 'grading' && outcome) {
    return (
      <Grading
        items={items}
        answers={answers as Answer[]}
        outcome={outcome}
        title={title}
        onNext={() => setPhase(toReview.length > 0 ? 'review' : 'rewards')}
        missCount={misses.length}
        luckyCount={guesses.length}
      />
    )
  }
  if (phase === 'review') {
    return <Review misses={toReview} onDone={() => setPhase('rewards')} />
  }
  if (phase === 'rewards' && outcome) {
    return <Rewards outcome={outcome} total={items.length} target={target} />
  }

  const domain = domainOf(item.q.skill)
  const current = answers[index]

  return (
    <div className="play">
      <header className="play__bar">
        <button type="button" className="play__leave" onClick={() => go('/today')} aria-label="Leave this page">
          <X />
        </button>
        <div className="play__title">
          <b>{title}</b>
          <span className="num">
            {answeredCount}/{items.length} answered
          </span>
        </div>
        <ol className="play__dots" aria-label="Questions on this page">
          {items.map((entry, i) => (
            <li key={entry.q.id + i}>
              <button
                type="button"
                className={`bubble bubble--dot ${answers[i] ? 'is-filled' : ''} ${i === index ? 'is-here' : ''} ${entry.comeback ? 'is-comeback' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Question ${i + 1}${answers[i] ? ', answered' : ''}${entry.comeback ? ', comeback' : ''}`}
                aria-current={i === index ? 'step' : undefined}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
      </header>

      <article className={`play__sheet sheet sheet--ruled ${turning ? 'is-turning' : ''}`} key={index}>
        <QuestionSheet
          question={item.q}
          picked={picked}
          onPick={(letter) => {
            setPicked(letter)
            setStruck((list) => list.filter((l) => l !== letter))
          }}
          struck={struck}
          onStrike={(letter) => setStruck((list) => (list.includes(letter) ? list.filter((l) => l !== letter) : [...list, letter]))}
          header={
            <div className="play__tags">
              <span className="tag" style={{ ['--mark' as string]: INK_VAR[domain.ink] }}>
                {item.q.skill}
              </span>
              <span className="tag tag--quiet">{item.q.difficulty}</span>
              {item.comeback && (
                <span className="tag tag--comeback">
                  <ClipGlyph size={18} color="currentColor" /> Comeback · shuffled
                </span>
              )}
              {item.twin && <span className="tag tag--quiet">Twin · same skill, new question</span>}
            </div>
          }
        />
      </article>

      <footer className="play__foot">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ArrowLeft /> Back
        </button>
        <div className={`confidence ${picked ? 'is-open' : ''}`} role="group" aria-label="How sure are you?">
          <span className="confidence__label">{picked ? 'How sure?' : 'Pick an answer'}</span>
          {CONFIDENCE.map((level) => (
            <button
              key={level.id}
              type="button"
              className="chip"
              disabled={!picked}
              aria-pressed={current?.confidence === level.id && current.picked === picked}
              onClick={() => commit(level.id)}
            >
              {level.label}
              <kbd>{level.key}</kbd>
            </button>
          ))}
        </div>
        {allAnswered ? (
          <button type="button" className="btn btn--red" onClick={turnIn}>
            Turn in page <ArrowRight />
          </button>
        ) : (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => goTo(index + 1)} disabled={index === items.length - 1}>
            Skip <ArrowRight />
          </button>
        )}
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Grading({
  items,
  answers,
  outcome,
  title,
  onNext,
  missCount,
  luckyCount,
}: {
  items: Item[]
  answers: Answer[]
  outcome: Outcome
  title: string
  onNext: () => void
  missCount: number
  luckyCount: number
}) {
  const step = 280
  const doneAt = items.length * step + 400
  const [stamped, setStamped] = useState(false)
  // the red pen goes down the page one row at a time
  useEffect(() => {
    const timers = items.map((entry, i) =>
      window.setTimeout(() => play(answers[i]?.picked === entry.q.answer ? (entry.comeback ? 'beat' : 'right') : 'wrong'), i * step + 160),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [items, answers])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStamped(true)
      buzz([12, 50, 20])
      play('stamp')
    }, doneAt)
    return () => window.clearTimeout(timer)
  }, [doneAt])

  return (
    <div className="play play--grading">
      <article className="grade sheet sheet--ruled">
        <header className="grade__head">
          <h1 className="display">{title}</h1>
          <span className="hand grade__pen">red pen’s out…</span>
        </header>
        <ol className="grade__rows">
          {items.map((entry, i) => {
            const answer = answers[i]
            const correct = answer.picked === entry.q.answer
            return (
              <li key={entry.q.id + i} className={`grade__row ${correct ? '' : 'is-wrong'}`} style={{ animationDelay: `${i * step}ms` }}>
                <span className="grade__n num">{i + 1}</span>
                <span className="grade__skill">
                  {SKILL_SHORT[entry.q.skill]}
                  {entry.comeback && <span className="tag tag--comeback tag--xs">comeback</span>}
                  {entry.twin && <span className="tag tag--quiet tag--xs">twin</span>}
                  {isLucky(entry, answer) && <span className="tag tag--comeback tag--xs">lucky guess · clipped</span>}
                  {!correct && answer.confidence === 'sure' && <span className="tag tag--comeback tag--xs">sure, but wrong</span>}
                </span>
                <span className="grade__you">
                  <span className="bubble is-filled bubble--sm">{answer.picked}</span>
                  <span className="grade__conf">{answer.confidence}</span>
                </span>
                <span className="grade__mark">
                  <PenMark kind={correct ? 'check' : 'cross'} size={36} delay={i * step + 120} />
                </span>
              </li>
            )
          })}
        </ol>
        <div className="grade__score">
          {stamped && (
            <span className="stamp stamp--big is-landing num">
              {outcome.right}/{items.length}
            </span>
          )}
        </div>
      </article>
      <div className={`grade__after ${stamped ? 'is-in' : ''}`}>
        <Tangyuan mood={outcome.right === items.length ? 'wow' : outcome.right >= items.length - 1 ? 'happy' : 'think'} size={88} />
        <p className="speech">
          {items.length === 1
            ? outcome.right === 1
              ? 'Got it first try. Spiders really do stick to almost anything.'
              : 'Close one. Redo it and the answer will click.'
            : outcome.right === items.length
            ? `A perfect page. Five bonus drops.${luckyNote(luckyCount)}`
            : `${outcome.right} right${outcome.beaten ? `, ${outcome.beaten} comeback${outcome.beaten === 1 ? '' : 's'} beaten` : ''}. ${missCount} to fix — redo ${missCount === 1 ? 'it' : 'them'} before the answer shows.${
                outcome.sureWrong ? ` You were sure about ${outcome.sureWrong === missCount ? (missCount === 1 ? 'it' : 'all of them') : outcome.sureWrong}: ${outcome.sureWrong === 1 ? 'that one comes' : 'those come'} back first.` : ''
              }${luckyNote(luckyCount)}`}
        </p>
        <button type="button" className="btn btn--lg" onClick={onNext} disabled={!stamped}>
          {missCount > 0
            ? `Fix my ${missCount} miss${missCount === 1 ? '' : 'es'}`
            : luckyCount > 0
              ? `Check my lucky guess${luckyCount === 1 ? '' : 'es'}`
              : 'Collect rewards'}{' '}
          <ArrowRight />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

type ReviewItem = { item: Item; wrong: Letter | null; sure: boolean; lucky: boolean }

function Review({ misses, onDone }: { misses: ReviewItem[]; onDone: () => void }) {
  const day = useToday()
  const [at, setAt] = useState(0)
  // a lucky guess was right already: nothing to redo and no trap sprung, so it opens on the reason
  const [step, setStep] = useState<'redo' | 'trap' | 'why'>(misses[0].lucky ? 'why' : 'redo')
  const [wrongs, setWrongs] = useState<Letter[]>([])
  const [pick, setPick] = useState<Letter | null>(misses[0].lucky ? misses[0].item.q.answer : null)
  const [trap, setTrap] = useState<TrapId | null>(null)
  const { item, wrong, sure, lucky } = misses[at]
  const q = item.q
  const traps = trapsFor(q.skill)
  const named = trapById(trap)

  const tryLetter = (letter: Letter) => {
    if (letter === q.answer) {
      setPick(letter)
      buzz(14)
      play('right')
      window.setTimeout(() => setStep('trap'), 700)
    } else {
      setWrongs((list) => [...list, letter])
      buzz([10, 40, 10])
      play('wrong')
    }
  }

  const chooseTrap = (id: TrapId) => {
    setTrap(id)
    play('clip')
    updateGame((state) => bumpQuest(gain(nameTrap(state, q.id, id), REWARDS.trapXp), 'name-traps'))
    window.setTimeout(() => setStep('why'), 300)
  }

  const next = () => {
    if (at + 1 >= misses.length) return onDone()
    const upcoming = misses[at + 1]
    setAt(at + 1)
    setStep(upcoming.lucky ? 'why' : 'redo')
    setWrongs([])
    setPick(upcoming.lucky ? upcoming.item.q.answer : null)
    setTrap(null)
  }

  const disabled = [...(wrong ? [wrong] : []), ...wrongs]
  const back = weekday(addDays(day, lucky ? COMEBACK_DAYS[LUCKY_START_STAGE] : COMEBACK_DAYS[0]))
  const steps = lucky ? (['why'] as const) : (['redo', 'trap', 'why'] as const)

  return (
    <div className="play play--review">
      <header className="play__bar">
        <button type="button" className="play__leave" onClick={onDone} aria-label="Skip to rewards">
          <X />
        </button>
        <div className="play__title">
          <b>{lucky ? 'Lucky guesses' : 'Fix your misses'}</b>
          <span className="num">
            {at + 1} of {misses.length}
          </span>
        </div>
        <ol className="review__steps" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s} className={step === s ? 'is-here' : (steps as readonly string[]).indexOf(step) > i ? 'is-done' : ''}>
              {s === 'redo' ? 'Redo it' : s === 'trap' ? 'Name the trap' : 'See why'}
            </li>
          ))}
        </ol>
      </header>

      <article className={`play__sheet sheet sheet--ruled ${lucky ? '' : 'is-missed'}`} key={at}>
        <div className="review__clip" aria-hidden="true">
          <ClipGlyph size={56} />
        </div>
        <QuestionSheet
          question={q}
          picked={pick}
          onPick={step === 'redo' ? tryLetter : undefined}
          graded={step !== 'redo'}
          disabledLetters={disabled}
          struck={disabled}
          header={
            <div className="play__tags">
              <span className="tag" style={{ ['--mark' as string]: INK_VAR[domainOf(q.skill).ink] }}>
                {q.skill}
              </span>
              {step === 'redo' && <span className="hand review__hint">your first answer is crossed out — try again</span>}
              {lucky && <span className="hand review__hint">you got it — but you said you were guessing</span>}
            </div>
          }
        />
      </article>

      <footer className="review__foot">
        {step === 'redo' && (
          <p className="review__say">
            <Tangyuan mood="think" size={56} idle={false} />
            {sure
              ? 'You were sure about this one, so slow down. Redo it first; the explanation waits until you’ve found it yourself.'
              : 'Redo it first. The explanation waits until you’ve found it yourself.'}
          </p>
        )}
        {step === 'trap' && (
          <div className="review__traps">
            <p className="title">What tricked you the first time?</p>
            <div className="trap-grid" role="group" aria-label="Name the trap">
              {traps.map((t) => (
                <button key={t.id} type="button" className="trap-card" aria-pressed={trap === t.id} onClick={() => chooseTrap(t.id)}>
                  <TrapGlyph trap={t.id} size={34} />
                  <b>{t.name}</b>
                  <span>{t.tell}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 'why' && (
          <div className="review__why">
            <p className="review__rationale">
              <strong className="hl">Why {q.answer}:</strong> {q.rationale}
            </p>
            {named && (
              <p className="review__fix">
                <TrapGlyph trap={named.id} size={26} />
                <span>
                  <b>Next time, against “{named.name}”:</b> {named.fix}
                </span>
              </p>
            )}
            <div className="review__filed">
              <span className="stamp stamp--miss is-landing">Clipped</span>
              <span>
                {lucky ? 'A guess that lands still gets checked. ' : ''}Comes back <b>{back}</b>, choices shuffled{named ? ` — filed under “${named.name}”` : ''}.
              </span>
              <button type="button" className="btn" onClick={next}>
                {at + 1 >= misses.length ? 'Collect rewards' : misses[at + 1].lucky ? 'Next: a lucky guess' : 'Next miss'} <ArrowRight />
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Rewards({ outcome, total, target }: { outcome: Outcome; total: number; target: string }) {
  const game = useGame()
  const day = useToday()
  const level = levelInfo(game.xp)
  const leveled = level.level > outcome.levelBefore
  const xp = useCountUp(outcome.xp, 1200)
  const ink = useCountUp(outcome.ink, 1200)
  const [meter, setMeter] = useState(0)
  const next = currentNode(game)
  const firstTime = target === 'first'
  const streakNew = outcome.streakBefore !== -1
  useEffect(() => {
    const t = window.setTimeout(() => setMeter(level.progress), 250)
    return () => window.clearTimeout(t)
  }, [level.progress])
  useEffect(() => {
    const cue = window.setTimeout(() => play(leveled ? 'levelup' : streakNew ? 'streak' : 'ink'), 450)
    return () => window.clearTimeout(cue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goNext = () => {
    if (firstTime) return go('/today')
    if (next.kind === 'lesson') go(`/lesson/${next.id.replace(/-lesson$/, '')}`)
    else if (next.kind === 'chest') go('/path')
    else go(`/play/${next.id}`)
  }

  return (
    <div className="play play--rewards">
      <div className="loot">
        <div className="loot__hero">
          <Tangyuan outfit={game.outfit} mood="wow" size={120} />
          <h1 className="display">{leveled ? `Level ${level.level}!` : outcome.right === total ? 'Perfect page.' : 'Page turned in.'}</h1>
          {leveled && <span className="stamp stamp--big is-landing">Level up</span>}
        </div>

        <div className="loot__grid">
          <div className="loot__cell">
            <span className="loot__big display num">+{xp}</span>
            <span>XP</span>
            <span className="meter meter--thick" style={{ ['--value' as string]: meter }}>
              <span />
            </span>
            <span className="loot__small num">
              Lv {level.level} · {level.into}/{level.need}
            </span>
          </div>
          <div className="loot__cell">
            <span className="loot__big display num">
              <InkGlyph size={30} /> +{ink}
            </span>
            <span>drops</span>
            <span className="loot__small">{outcome.beaten > 0 ? `${outcome.beaten} comeback${outcome.beaten === 1 ? '' : 's'} paid double` : 'comebacks pay double'}</span>
          </div>
          <div className="loot__cell">
            <span className="loot__big display num">
              <StreakGlyph size={30} /> {game.streak.count}
            </span>
            <span>day streak</span>
            <span className="loot__small">{streakNew ? (game.streak.count === 1 ? 'Day one. See you tomorrow.' : 'Extended today.') : 'Already safe today.'}</span>
          </div>
          {outcome.starEarned && (
            <div className="loot__cell loot__cell--star">
              <svg viewBox="0 0 20 20" className="stop__star is-lit loot__star" aria-hidden="true">
                <path d="M10 1.8 L12.5 7 L18.2 7.6 L13.9 11.4 L15.1 17.2 L10 14.3 L4.9 17.2 L6.1 11.4 L1.8 7.6 L7.5 7Z" />
              </svg>
              <span>Star lit</span>
              <span className="loot__small">{outcome.starEarned}</span>
            </div>
          )}
        </div>

        <div className="loot__pack sheet">
          <p className="title">Your sticker pack</p>
          <PackOpener />
        </div>

        <ul className="loot__quests">
          {game.quests.items.map((quest) => (
            <li key={quest.kind} className={quest.progress >= quest.target ? 'is-done' : ''}>
              {quest.progress >= quest.target ? <Check size={16} /> : <span className="num">{quest.progress}/{quest.target}</span>}
              <span>{QUEST_TEMPLATES.find((t) => t.kind === quest.kind)?.label(quest.target)}</span>
            </li>
          ))}
        </ul>

        <div className="loot__actions">
          <button type="button" className="btn btn--lg" onClick={goNext}>
            {firstTime ? 'See my dashboard' : `Next: ${next.title}`} <ArrowRight />
          </button>
          {!firstTime && (
            <button type="button" className="btn btn--ghost" onClick={() => go('/today')}>
              Back to today
            </button>
          )}
        </div>
        <p className="loot__day hand">{day}</p>
      </div>
    </div>
  )
}
