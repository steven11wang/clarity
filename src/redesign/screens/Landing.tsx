// The redesigned front door. The first viewport is a working notebook page: a
// visitor answers a real SAT question, watches the red pen grade it, and — if
// they miss — sees it clipped into the Mistake Notebook to come back. Then they press Play.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Check, ClipboardList, ExternalLink, Gift, Play, Repeat, RotateCcw, Route, Shirt, Swords, Timer } from 'lucide-react'

import skillIndex from '../../content/skillLessonIndex.json' with { type: 'json' }
import type { Confidence, TrapType } from '../../types.ts'
import {
  ALL_SKILLS,
  COMEBACK_DAYS,
  DOMAINS,
  OUTFITS,
  REWARDS,
  RANKS,
  STICKERS,
  SKILL_SHORT,
  TRAPS,
  domainOf,
  type OutfitId,
  type Sticker,
} from '../game/content.ts'
import { addDays, drawSticker, fileMiss, freshState, gain, hash, nameTrap, recordAnswer, seeded } from '../game/engine.ts'
import { LETTERS, STARTER } from '../game/questions.ts'
import { updateGame, useToday } from '../game/store.ts'
import { ClipGlyph, INK_VAR, InkGlyph, PenMark, RankEmblem, StreakGlyph, TapeGlyph, TrapGlyph } from '../components/Glyphs.tsx'
import { buzz, useCountUp, useReveal } from '../components/hooks.ts'
import { QuestionSheet } from '../components/QuestionSheet.tsx'
import { Radar } from '../components/Radar.tsx'
import { StickerView } from '../components/StickerView.tsx'
import { Tangyuan, type Mood } from '../components/Tangyuan.tsx'
import { Logo } from '../components/Logo.tsx'
import { go } from '../router.ts'
import { play } from '../sound.ts'

type Letter = (typeof LETTERS)[number]

const CONFIDENCE: Array<{ id: Confidence; label: string }> = [
  { id: 'sure', label: 'Sure' },
  { id: 'leaning', label: 'Leaning' },
  { id: 'guessing', label: 'Guessing' },
]

const COLLEGES = [
  ['princeton', 'Princeton University', 1530],
  ['mit', 'Massachusetts Institute of Technology', 1560],
  ['harvard', 'Harvard University', 1550],
  ['stanford', 'Stanford University', 1530],
  ['yale', 'Yale University', 1540],
  ['columbia', 'Columbia University', 1540],
  ['penn', 'University of Pennsylvania', 1540],
  ['brown', 'Brown University', 1540],
  ['cornell', 'Cornell University', 1540],
  ['dartmouth', 'Dartmouth College', 1520],
  ['chicago', 'University of Chicago', 1540],
  ['jhu', 'Johns Hopkins University', 1550],
  ['duke', 'Duke University', 1550],
  ['northwestern', 'Northwestern University', 1540],
  ['berkeley', 'University of California, Berkeley', 1410],
] as const

function weekday(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
}

// ---------------------------------------------------------------------------

function LiveDemo() {
  const day = useToday()
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<Letter | null>(null)
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  const [phase, setPhase] = useState<'answer' | 'graded' | 'explained'>('answer')
  const [trap, setTrap] = useState<TrapType | null>(null)
  const [earned, setEarned] = useState(0)
  const question = STARTER[index % STARTER.length]
  const correct = picked === question.answer
  const ink = useCountUp(earned)

  const turnIn = (level: Confidence) => {
    if (!picked) return
    setConfidence(level)
    setPhase('graded')
    buzz(picked === question.answer ? 14 : [10, 60, 10])
    play(picked === question.answer ? 'right' : 'wrong')
    window.setTimeout(() => play(picked === question.answer ? 'stamp' : 'clip'), 380)
    updateGame((state) => {
      let next = recordAnswer(state, question.skill, picked === question.answer)
      if (picked === question.answer) next = gain(next, 10, REWARDS.firstTryInk)
      else next = fileMiss(next, question.id, question.skill, day)
      return next
    })
    setEarned((value) => value + (picked === question.answer ? REWARDS.firstTryInk : 0))
    if (picked === question.answer) window.setTimeout(() => setPhase('explained'), 1100)
  }

  const chooseTrap = (id: TrapType) => {
    setTrap(id)
    updateGame((state) => gain(nameTrap(state, question.id, id), 3))
    window.setTimeout(() => setPhase('explained'), 350)
  }

  const next = () => {
    setIndex((value) => value + 1)
    setPicked(null)
    setConfidence(null)
    setTrap(null)
    setPhase('answer')
  }

  const mood: Mood = phase === 'answer' ? (picked ? 'think' : 'happy') : correct ? 'wow' : 'sad'
  const say =
    phase === 'answer'
      ? picked
        ? 'How sure are you? Pick one and the red pen comes out.'
        : 'Try one. Nobody’s watching but me.'
      : correct
        ? 'Clean. That one’s yours.'
        : trap
          ? `Clipped. It comes back ${weekday(addDays(day, COMEBACK_DAYS[0]))}, choices shuffled.`
          : 'Got you. What tricked you?'

  return (
    <div className="demo">
      <div className="demo__stack" aria-hidden="true">
        <span />
        <span />
      </div>
      <article className={`demo__sheet sheet sheet--ruled ${phase !== 'answer' && !correct ? 'is-missed' : ''}`} aria-label="Try a real SAT question">
        <header className="demo__head">
          <span className="tag" style={{ ['--mark' as string]: INK_VAR[domainOf(question.skill).ink] }}>
            {question.skill}
          </span>
          <span className="demo__count num">Q{(index % STARTER.length) + 1} of {STARTER.length}</span>
          <span className="demo__ink num" aria-label={`${ink} drops earned`}>
            <InkGlyph size={18} />+{ink}
          </span>
        </header>

        <QuestionSheet
          question={question}
          picked={picked}
          onPick={phase === 'answer' ? setPicked : undefined}
          graded={phase !== 'answer'}
          revealAnswer={correct || phase === 'explained'}
          layout="stack"
        />

        {phase === 'answer' && (
          <div className={`demo__confidence ${picked ? 'is-open' : ''}`} aria-hidden={!picked}>
            <span className="demo__confidence-label">How sure?</span>
            {CONFIDENCE.map((level) => (
              <button key={level.id} type="button" className="chip" tabIndex={picked ? 0 : -1} onClick={() => turnIn(level.id)}>
                {level.label}
              </button>
            ))}
          </div>
        )}

        {phase !== 'answer' && (
          <>
            <span className={`stamp is-landing demo__stamp ${correct ? '' : 'stamp--miss'}`}>{correct ? `+10 XP` : 'Clipped'}</span>
            {!correct && (
              <div className="demo__clip">
                <ClipGlyph size={46} />
                <span className="demo__due">Back {weekday(addDays(day, COMEBACK_DAYS[0]))}</span>
              </div>
            )}
          </>
        )}

        {phase !== 'answer' && (
          <div className="demo__verdict">
            {!correct && phase === 'graded' && (
              <div className="demo__traps" role="group" aria-label="Name the trap">
                {TRAPS.map((item) => (
                  <button key={item.id} type="button" className="chip" aria-pressed={trap === item.id} onClick={() => chooseTrap(item.id)}>
                    {item.name}
                  </button>
                ))}
              </div>
            )}
            {phase === 'explained' && (
              <div className="demo__why">
                <p>
                  <strong>{correct ? 'Why it works. ' : `It was ${question.answer}. `}</strong>
                  {question.rationale}
                </p>
                <div className="demo__actions">
                  <button type="button" className="btn btn--sm" onClick={next}>
                    Next question <ArrowRight />
                  </button>
                  <button type="button" className="btn btn--sm btn--hl" onClick={() => go('/start')}>
                    Play a full page
                  </button>
                </div>
              </div>
            )}
            {confidence && <span className="demo__conf hand">you said: {confidence}</span>}
          </div>
        )}
      </article>
      <div className="demo__mascot">
        <div className="speech speech--below" aria-live="polite">
          {say}
        </div>
        <Tangyuan mood={mood} size={96} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function StepFrames() {
  return (
    <ol className="steps">
      <li className="step reveal">
        <div className="step__art sheet">
          <div className="mini-bubbles" aria-hidden="true">
            {['B', 'D', 'A', 'C', 'B'].map((letter, i) => (
              <span key={i} className="mini-row">
                {LETTERS.map((l) => (
                  <span key={l} className={`bubble bubble--mini ${l === letter ? 'is-filled' : ''}`} />
                ))}
              </span>
            ))}
          </div>
          <span className="chip chip--static" aria-pressed="true">Leaning</span>
        </div>
        <h3 className="title">Answer the whole page.</h3>
        <p>No hints, no green ticks mid-way. Pick an answer and say how sure you are.</p>
      </li>
      <li className="step reveal" data-delay="120">
        <div className="step__art sheet">
          <div className="mini-grades" aria-hidden="true">
            {(['check', 'check', 'cross', 'check', 'cross'] as const).map((kind, i) => (
              <span key={i} className="mini-grade">
                <span className="mini-line" />
                <PenMark kind={kind} size={26} delay={i * 180} />
              </span>
            ))}
          </div>
          <span className="stamp step__stamp">3/5</span>
        </div>
        <h3 className="title">The red pen grades it all at once.</h3>
        <p>One sweep, the way a teacher marks a quiz. Then you see what you missed.</p>
      </li>
      <li className="step reveal" data-delay="240">
        <div className="step__art sheet">
          <div className="mini-traps" aria-hidden="true">
            {TRAPS.slice(0, 3).map((item, i) => (
              <span key={item.id} className={`mini-trap ${i === 1 ? 'is-on' : ''}`}>
                <TrapGlyph trap={item.id} size={30} />
                {item.name}
              </span>
            ))}
          </div>
        </div>
        <h3 className="title">Name the trap that got you.</h3>
        <p>Too extreme, half right, out of scope. You call it before the explanation shows.</p>
      </li>
      <li className="step reveal" data-delay="360">
        <div className="step__art sheet">
          <div className="mini-due" aria-hidden="true">
            <ClipGlyph size={40} />
            <div className="mini-days">
              {COMEBACK_DAYS.map((gap, i) => (
                <span key={gap} className={i === 0 ? 'is-next' : ''}>
                  +{gap}d
                </span>
              ))}
            </div>
          </div>
        </div>
        <h3 className="title">It comes back. Shuffled.</h3>
        <p>Day 1, 3, 7, 21 — new letter order every time. Beat it four times and it’s gone.</p>
      </li>
    </ol>
  )
}

// ---------------------------------------------------------------------------

type Slip = { id: string; skill: string; trap: TrapType; due: string; beats: number }

const SLIPS: Slip[] = [
  { id: 's1', skill: 'Transitions', trap: 'opposite', due: 'Due today', beats: 1 },
  { id: 's2', skill: 'Inferences', trap: 'out-of-scope', due: 'Due today', beats: 0 },
  { id: 's3', skill: 'Boundaries', trap: 'half-right', due: 'Sat', beats: 2 },
  { id: 's4', skill: 'Words in Context', trap: 'too-extreme', due: 'Nov 9', beats: 3 },
]

function NotebookDemo() {
  const [beaten, setBeaten] = useState<string[]>([])
  const [ink, setInk] = useState(0)
  const shown = useCountUp(ink, 600)
  return (
    <div className="nbdemo">
      <div className="nbdemo__spread sheet sheet--ruled">
        <header className="nbdemo__head">
          <span className="title">
            My Mistake Notebook
          </span>
          <span className="nbdemo__ink num">
            <InkGlyph size={18} /> +{shown}
          </span>
        </header>
        <ul className="slips">
          {SLIPS.map((slip) => {
            const done = beaten.includes(slip.id)
            const due = slip.due === 'Due today'
            const beats = slip.beats + (done ? 1 : 0)
            return (
              <li key={slip.id} className={`slip ${done ? 'is-beaten' : ''} ${due ? 'is-due' : ''}`}>
                <span className="slip__clip">
                  <ClipGlyph size={34} color={due ? 'var(--red)' : 'var(--ink-3)'} />
                </span>
                <span className="slip__body">
                  <span className={`slip__skill ${done ? 'hl hl--green' : ''}`}>{slip.skill}</span>
                  <span className="slip__trap">
                    <TrapGlyph trap={slip.trap} size={20} />
                    {TRAPS.find((t) => t.id === slip.trap)?.name}
                  </span>
                </span>
                <span className="slip__beats" aria-label={`Beaten ${beats} of 4`}>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={i < beats ? 'is-on' : ''} />
                  ))}
                </span>
                {due && !done ? (
                  <button
                    type="button"
                    className="btn btn--sm btn--red"
                    onClick={() => {
                      setBeaten((list) => [...list, slip.id])
                      setInk((value) => value + 10)
                      buzz(14)
                      play('beat')
                    }}
                  >
                    Beat it
                  </button>
                ) : (
                  <span className={`slip__due ${done ? 'is-done' : ''}`}>{done ? 'Beaten' : slip.due}</span>
                )}
                {done && <span className="stamp is-landing slip__stamp">{beats}/4</span>}
              </li>
            )
          })}
        </ul>
        {beaten.length > 0 && (
          <button type="button" className="nbdemo__reset" onClick={() => { setBeaten([]); setInk(0) }}>
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>
      <p className="nbdemo__note hand">sample notebook — yours fills up as you play</p>
    </div>
  )
}

// ---------------------------------------------------------------------------

function SkillsDemo() {
  const [focus, setFocus] = useState<string | null>('Transitions')
  const values = useMemo(() => {
    const rand = seeded(hash('landing-radar'))
    return Object.fromEntries(ALL_SKILLS.map((skill) => [skill, 0.3 + rand() * 0.62]))
  }, [])
  const lesson = (skillIndex as Array<{ skill: string; nutshell: string; oneMove: string }>).find((item) => item.skill === focus)
  const domain = focus ? domainOf(focus) : null
  return (
    <div className="skills">
      <div className="skills__radar">
        <Radar values={values} focus={focus} onFocus={(skill) => skill && setFocus(skill)} size={460} />
        <p className="skills__note hand">sample radar</p>
      </div>
      <div className="skills__side">
        <div className="stars-grid" role="list" aria-label="Thirty skill stars">
          {ALL_SKILLS.map((skill) => (
            <button
              key={skill}
              type="button"
              role="listitem"
              className={`stars-row ${focus === skill ? 'is-focus' : ''}`}
              onPointerEnter={() => setFocus(skill)}
              onFocus={() => setFocus(skill)}
              style={{ ['--mark' as string]: INK_VAR[domainOf(skill).ink] }}
            >
              <span className="stars-row__name">{SKILL_SHORT[skill]}</span>
              <span className="stars-row__stars" aria-label={`${Math.round(values[skill] * 3)} of 3 stars`}>
                {[0, 1, 2].map((i) => (
                  <svg key={i} viewBox="0 0 20 20" className={i < Math.round(values[skill] * 3) ? 'is-lit' : ''} aria-hidden="true">
                    <path d="M10 1.8 L12.5 7 L18.2 7.6 L13.9 11.4 L15.1 17.2 L10 14.3 L4.9 17.2 L6.1 11.4 L1.8 7.6 L7.5 7Z" />
                  </svg>
                ))}
              </span>
            </button>
          ))}
        </div>
        {lesson && domain && (
          <div className="skills__card sheet" key={lesson.skill}>
            <h3 className="title">
              <span className="hl" style={{ ['--mark' as string]: INK_VAR[domain.ink] }}>
                {lesson.skill}
              </span>
            </h3>
            <p>{lesson.nutshell}</p>
            <p className="skills__move">
              <span className="hl">The one move:</span> {lesson.oneMove}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function RewardsDemo() {
  const [outfit, setOutfit] = useState<OutfitId>('scholar')
  const [pack, setPack] = useState<{ sticker: Sticker; key: number } | null>(null)
  const [tearing, setTearing] = useState(false)
  const sim = useRef(freshState('2026-01-01'))
  const rand = useRef(seeded(hash('landing-pack')))

  const open = () => {
    if (tearing) return
    setTearing(true)
    buzz([8, 40, 16])
    play('rip')
    window.setTimeout(() => {
      const result = drawSticker({ ...sim.current, packs: 5 }, rand.current)
      sim.current = result.state
      play(result.sticker.rarity === 'holo' ? 'holo' : 'reveal')
      setPack({ sticker: result.sticker, key: Date.now() })
      setTearing(false)
    }, 520)
  }

  return (
    <div className="rewards">
      <div className="rewards__pack">
        <button type="button" className={`pack ${tearing ? 'is-tearing' : ''}`} onClick={open} aria-label="Open a sticker pack">
          <span className="pack__top" />
          <span className="pack__body">
            <Gift />
            <span>Sticker pack</span>
            <span className="pack__hint">tap to tear</span>
          </span>
        </button>
        <div className="rewards__reveal" aria-live="polite">
          {pack ? (
            <div className="reveal-pop" key={pack.key}>
              <StickerView sticker={pack.sticker} size={150} />
              <p>
                <strong>{pack.sticker.name}</strong> · {pack.sticker.rarity === 'holo' ? 'Holo foil' : pack.sticker.rarity === 'gloss' ? 'Gloss' : 'Plain'}
              </p>
            </div>
          ) : (
            <div className="rewards__shelf">
              {STICKERS.filter((s) => s.rarity === 'holo').slice(0, 2).concat(STICKERS[0], STICKERS[7]).map((sticker) => (
                <StickerView key={sticker.id} sticker={sticker} size={96} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="rewards__wardrobe">
        <div className="wardrobe-stage">
          <Tangyuan outfit={outfit} size={190} mood="wink" />
        </div>
        <div className="wardrobe-rack" role="radiogroup" aria-label="Dress 汤圆">
          {OUTFITS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={outfit === item.id}
              className="rack-item"
              onClick={() => {
                setOutfit(item.id)
                play('pick')
              }}
            >
              <Tangyuan outfit={item.id} size={52} idle={false} />
              <span>{item.name}</span>
              <span className="rack-item__price num">
                <InkGlyph size={14} /> {item.price}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="rewards__streak sheet">
        <div className="streak-row" aria-label="Sample streak with one day covered by correction tape">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className={`streak-day ${i === 3 ? 'is-taped' : i < 6 ? 'is-done' : 'is-today'}`}>
              <span className="streak-day__d">{d}</span>
              {i === 3 ? <TapeGlyph size={26} /> : i < 6 ? <StreakGlyph size={24} /> : <StreakGlyph size={24} lit={false} />}
            </span>
          ))}
        </div>
        <p>
          <strong>One page a day keeps the streak.</strong> Miss a day and a roll of correction tape covers it. Every seven days earns another roll.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/** A numbered note: jumps to its line in “Important information”. */
function Note({ n }: { n: number }) {
  return (
    <a className="fnref" href={`#fn-${n}`} aria-label={`Note ${n}`}>
      {n}
    </a>
  )
}

/** The four things a student gets beyond the game loop. Honest about where each lives. */
const FEATURES = [
  {
    id: 'path',
    n: '01',
    ink: 'var(--yellow)',
    Icon: Route,
    kicker: 'Paced path',
    title: 'Know what to work on next.',
    points: [
      { text: 'A guided path through all four domains and ten skills, so you never guess which weakness to chase.' },
      { text: 'Every star you earn stays saved as you move on.' },
      { text: 'Start from your score report: upload or enter it and Clarity picks where to begin.', note: 2, original: true },
    ],
    cta: { label: 'Open the path', to: '/path' },
  },
  {
    id: 'tools',
    n: '02',
    ink: 'var(--blue)',
    Icon: ClipboardList,
    kicker: 'Exams and study tools',
    title: 'Study everything in one place.',
    points: [
      { text: 'Full-length practice exams: two timed modules in a calm, test-day room, with a scaled score at the end.', note: 4 },
      { text: 'A lesson for every skill, then practice it right away.' },
      { text: 'Your study guide, saved words and misses next to your practice.', original: true },
    ],
    cta: { label: 'See the exams', to: '/exams' },
  },
  {
    id: 'dictionary',
    n: '03',
    ink: 'var(--green)',
    Icon: BookOpen,
    kicker: 'Dictionary',
    title: 'Understand every word in context.',
    points: [
      { text: 'Look a word up inside the passage, without leaving the question.', note: 5, original: true },
      { text: 'The digital SAT tests words in context, so that is where you learn them.' },
      { text: 'Saved words come back on a schedule, so they stick.', note: 6, original: true },
    ],
    cta: { label: 'Open the dictionary', href: '/app/' },
  },
  {
    id: 'loop',
    n: '04',
    ink: 'var(--pink)',
    Icon: Repeat,
    kicker: 'Return loop',
    title: 'Never lose a missed question again.',
    points: [
      { text: 'Every miss is filed the moment you make it, with the trap that caught you.' },
      { text: 'It comes back at 1, 3, 7 and 21 days, around when people forget.', note: 6 },
      { text: 'Nothing sits in an error log. Today’s comebacks are already on today’s page.' },
    ],
    cta: { label: 'Open the Mistake Notebook', to: '/notebook' },
  },
] as const

const REASONS = [
  'A clear, straightforward page: five questions, about four minutes.',
  'Guidance that moves as your score does: the radar and the path point at the next skill.',
  'Practice, exams, lessons and your misses in one place.',
  'Learning is free, at every step.',
] as const

export function Landing() {
  const root = useRef<HTMLDivElement>(null)
  useReveal(root)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // the app routes on the hash, so in-page links (#how, #fn-1) scroll rather than navigate
  useEffect(() => {
    const node = root.current
    if (!node) return
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a')
      const href = link?.getAttribute('href') ?? ''
      if (!href.startsWith('#') || href.startsWith('#/')) return
      const target = document.getElementById(href.slice(1))
      if (!target) return
      event.preventDefault()
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
      if (target instanceof HTMLElement && href.startsWith('#fn-')) target.focus({ preventScroll: true })
    }
    node.addEventListener('click', onClick)
    return () => node.removeEventListener('click', onClick)
  }, [])

  return (
    <div className="landing" ref={root}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <nav className={`lnav ${scrolled ? 'is-scrolled' : ''}`} aria-label="Main">
        <a className="lnav__brand" href="#/" aria-label="Clarity home">
          <Logo />
        </a>
        <div className="lnav__links">
          <a href="#how">How it plays</a>
          <a href="#notebook">
            Mistake Notebook
          </a>
          <a href="#features">Features</a>
          <a href="#speed">Speed Round</a>
          <a href="#why-clarity">Why Clarity</a>
          <a href="/plans">Plans</a>
          <a href="/app/">Original site</a>
        </div>
        <div className="lnav__actions">
          <a className="lnav__signin" href="#/signin">
            Sign in
          </a>
          <button type="button" className="btn btn--sm" onClick={() => go('/start')}>
            Play free
          </button>
        </div>
      </nav>

      <main id="main">
        <section className="hero">
          <div className="hero__copy">
            <h1 className="display hero__title">
              <span className="hero__line">Miss it.</span>
              <span className="hero__line">
                It <span className="hl hl--pink hl--wrap" data-swipe="load" data-delay="350">comes back.</span>
              </span>
              <span className="hero__line">
                <span className="pen-circle" data-draw="load" data-delay="700">
                  Beat it.
                  <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                    <path pathLength={1} d="M70 4 C40 -1 6 6 4 21 C2 36 52 40 82 33 C100 28 99 9 74 5 C60 3 40 6 30 9" />
                  </svg>
                </span>
              </span>
            </h1>
            <p className="hero__lead">
              SAT Reading &amp; Writing, played like a game. Every question you miss is clipped into your Mistake Notebook and comes
              back on the day you’d forget it, until you beat it for good.
            </p>
            <div className="hero__cta">
              <button type="button" className="btn btn--lg" onClick={() => go('/start')}>
                <Play /> Play your first page
              </button>
              <span className="hero__free">
                Free. No fees, no credit card.
                <Note n={1} /> No sign-up for your first page.
              </span>
            </div>
            <p className="hero__facts">
              <span>
                <b className="num">1,647</b> SAT-format questions
              </span>
              <span>
                <b className="num">10</b> skills, <b className="num">30</b> stars
              </span>
              <span>
                Misses return at <b className="num">1 · 3 · 7 · 21</b> days
              </span>
            </p>
          </div>
          <LiveDemo />
        </section>

        <section className="band band--paper" id="how">
          <div className="band__inner">
            <h2 className="display band__title reveal">
              How a <span className="hl" data-swipe>page</span> plays
            </h2>
            <p className="band__lead reveal">Five questions, about four minutes. The game is built around the part other apps skip: what you got wrong.</p>
            <StepFrames />
          </div>
        </section>

        <section className="band band--pink" id="notebook">
          <div className="band__inner band__inner--split">
            <div className="band__copy">
              <h2 className="display band__title reveal">
                Your Mistake Notebook fights back.
              </h2>
              <p className="band__lead reveal">
                Every miss is clipped in with the trap that caught you. When it’s due, it’s back on your page — new letter order, same question. Beat it four times, spaced
                out, and it’s cleared for good.
              </p>
              <ul className="facts reveal">
                <li>
                  <b>A comeback pays double.</b> +20 XP and +2 drops, against +10 and +1 for a first try.
                </li>
                <li>
                  <b>Nothing sits in a log.</b> Today’s comebacks are already on today’s page.
                </li>
              </ul>
            </div>
            <NotebookDemo />
          </div>
        </section>

        <section className="band band--violet" id="speed">
          <div className="band__inner">
            <div className="speed">
              <div className="speed__copy">
                <h2 className="display band__title reveal">Speed Round.</h2>
                <p className="band__lead reveal">Five questions, one rival, thirty seconds each. Win to climb the writing kit, from Pencil to the 800 Club.</p>
                <button type="button" className="btn btn--lg btn--hl reveal" onClick={() => go('/arena')}>
                  <Swords /> Play a Speed Round
                </button>
              </div>
              <div className="versus sheet reveal" data-delay="120">
                <div className="versus__side">
                  <Tangyuan outfit="headband" size={88} mood="happy" />
                  <b>You</b>
                  <span className="versus__rank">Ballpoint</span>
                  <span className="versus__score num">4</span>
                </div>
                <div className="versus__mid">
                  <span className="display">VS</span>
                  <span className="versus__clock num">
                    <Timer size={16} /> 0:18
                  </span>
                </div>
                <div className="versus__side">
                  <Tangyuan outfit="specs" size={88} mood="think" />
                  <b>Mina K.</b>
                  <span className="versus__rank">Gel Pen</span>
                  <span className="versus__score num">3</span>
                </div>
                <span className="versus__sample hand">sample rival</span>
              </div>
            </div>
            <ol className="ranks reveal" aria-label="Speed Round ranks">
              {RANKS.map((rank) => (
                <li key={rank.id} style={{ ['--mark' as string]: INK_VAR[rank.ink] }}>
                  <RankEmblem rank={rank.id} size={84} />
                  <b>{rank.name}</b>
                  <span className="num">{rank.min}+ RP</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="band band--green" id="skills">
          <div className="band__inner">
            <h2 className="display band__title reveal">Light up all thirty stars.</h2>
            <p className="band__lead reveal">
              Ten skills, three difficulties each. Score four out of five on a page and that star is yours. The radar shows where you’re strong and where the next page
              should go.
            </p>
            <SkillsDemo />
          </div>
        </section>

        <section className="band band--paper" id="features" aria-labelledby="features-title">
          <div className="band__inner">
            <h2 className="display band__title reveal" id="features-title">
              Everything <span className="hl hl--blue" data-swipe>around</span> the game.
            </h2>
            <p className="band__lead reveal">
              The pages are the fun part. These are the tools that make them count. A few still live in the original app while the beta catches up, and say so.
            </p>
            <ol className="features">
              {FEATURES.map(({ id, n, ink, Icon, kicker, title, points, cta }) => (
                <li key={id} className="fcard sheet reveal" style={{ ['--mark' as string]: ink }}>
                  <span className="fcard__n num">{n}</span>
                  <span className="fcard__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <p className="fcard__kicker">{kicker}</p>
                  <h3 className="fcard__title">{title}</h3>
                  <ul className="fcard__points">
                    {points.map((point) => (
                      <li key={point.text}>
                        <Check size={16} aria-hidden="true" />
                        <span>
                          {point.text}
                          {'note' in point && point.note ? <Note n={point.note} /> : null}
                          {'original' in point && point.original ? <span className="fcard__orig">in the original app</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {'href' in cta ? (
                    <a className="btn btn--sm btn--paper fcard__cta" href={cta.href}>
                      {cta.label} <ExternalLink />
                    </a>
                  ) : (
                    <button type="button" className="btn btn--sm btn--paper fcard__cta" onClick={() => go(cta.to)}>
                      {cta.label} <ArrowRight />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="band band--blue" id="rewards">
          <div className="band__inner">
            <h2 className="display band__title reveal">Stickers, drops, and a rice ball with a wardrobe.</h2>
            <p className="band__lead reveal">
              Every page turns in a sticker pack. Water drops buy outfits for <span className="zh">汤圆</span> and rolls of correction tape: earn them by playing, or top
              up at 10 drops for $1. Sticker packs are never for sale, and holo foil is guaranteed by your tenth pack.
            </p>
            <RewardsDemo />
          </div>
        </section>

        <section className="band band--paper" id="why">
          <div className="band__inner">
            <h2 className="display band__title reveal">
              Why the <span className="hl hl--orange" data-swipe>1550</span>?
            </h2>
            <p className="band__lead reveal">
              At a top-30 US university, the middle of the admitted class scores around 1550.
              <Note n={3} /> Reading &amp; Writing is half of that number.
            </p>
          </div>
          <div className="colleges" aria-label="Median SAT scores at top universities">
            <div className="colleges__track">
              {[...COLLEGES, ...COLLEGES].map(([id, name, score], i) => (
                <div className="college" key={`${id}-${i}`} aria-hidden={i >= COLLEGES.length}>
                  <img src={`/brand/colleges/${id}.svg`} alt={name} loading="lazy" />
                  <span>
                    Median <b className="num">{score}</b>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="band band--yellow" id="why-clarity" aria-labelledby="why-clarity-title">
          <div className="band__inner band__inner--split why2">
            <div>
              <h2 className="display band__title reveal" id="why-clarity-title">
                Why choose Clarity?
              </h2>
              <p className="band__lead reveal">
                One idea runs through everything here: the questions you miss are the most useful ones you have. A simple, steady routine puts them back in front of you.
              </p>
              <ul className="why2__list reveal">
                {REASONS.map((reason, i) => (
                  <li key={reason}>
                    <PenMark kind="check" size={22} />
                    <span>
                      {reason}
                      {i === REASONS.length - 1 && <Note n={1} />}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <aside className="why2__start sheet reveal" data-delay="120">
              <Tangyuan size={96} mood="think" />
              <h3>Not sure where to start?</h3>
              <p>Tell us your target score and how long you have each day, and Clarity picks your first page. Have a score report? The original app reads it and sets your path.</p>
              <div className="why2__actions">
                <button type="button" className="btn" onClick={() => go('/start')}>
                  <Play /> Find my first page
                </button>
                <a className="btn btn--ghost btn--sm" href="/app/">
                  Use my score report <ExternalLink />
                </a>
              </div>
            </aside>
          </div>
        </section>

        <section className="finale">
          <Tangyuan outfit="scholar" size={150} mood="happy" />
          <h2 className="display finale__title">
            Your first page takes <span className="hl hl--paper" data-swipe>four minutes.</span>
          </h2>
          <button type="button" className="btn btn--lg" onClick={() => go('/start')}>
            <Play /> Play now — it’s free
          </button>
          <div className="finale__list">
            {DOMAINS.map((domain) => (
              <span key={domain.id} className="tag" style={{ ['--mark' as string]: INK_VAR[domain.ink] }}>
                <Check size={14} /> {domain.name}
              </span>
            ))}
          </div>
        </section>
      </main>

      <section className="fineprint" id="important" aria-labelledby="important-title">
        <div className="fineprint__inner">
          <h2 id="important-title">Important information</h2>
          <p>
            Studying takes effort, and results vary. Your score may go up, stay the same, or go down on test day. Clarity does not guarantee a score or admission to any
            college.
          </p>
          <p>Clarity is a study tool. The information on this page is general and is not admissions, financial aid, legal or tax advice.</p>
          <p>
            SAT® is a registered trademark of the College Board, which is not affiliated with, and does not endorse, Clarity. College names and logos belong to their
            owners, appear for reference only, and do not imply endorsement.
          </p>
          <p>
            The images, demos and characters on this page are illustrations. Rivals, radars and notebooks marked “sample” are not real players or results. The 汤圆
            portraits were generated for Clarity.
          </p>
          <ol className="fineprint__notes">
            <li id="fn-1" tabIndex={-1}>
              Learning on Clarity is free: no account fees, subscriptions or hidden charges, and no credit card. Optional water drops (10 drops = $1) buy only cosmetic
              outfits and streak savers; they never unlock questions, explanations or scores, and buying them is off during the beta. Features and availability may change.
            </li>
            <li id="fn-2" tabIndex={-1}>
              The paced path is a study guide, not a prediction of your score. Starting from an uploaded or entered score report is available in the original app.
            </li>
            <li id="fn-3" tabIndex={-1}>
              Median SAT figures are approximate, shown for illustration, and may be out of date. Check each college’s admissions site for current ranges. Admission
              depends on the whole application, not a score alone.
            </li>
            <li id="fn-4" tabIndex={-1}>
              Practice exams follow the digital SAT format. They are practice material, not official College Board tests, and a practice score is an estimate.
            </li>
            <li id="fn-5" tabIndex={-1}>Word definitions come from published dictionaries and are shown for study.</li>
            <li id="fn-6" tabIndex={-1}>Review timing follows a spaced repetition schedule. How well it works varies from learner to learner.</li>
          </ol>
        </div>
      </section>

      <footer className="lfoot">
        <div className="lfoot__brand">
          <Logo />
          <span>Free SAT Reading &amp; Writing practice.</span>
        </div>
        <nav className="lfoot__cols" aria-label="Footer">
          <div>
            <p className="lfoot__head">Learn</p>
            <ul>
              <li>
                <a href="#features">Paced path</a>
              </li>
              <li>
                <a href="#features">Practice and exams</a>
              </li>
              <li>
                <a href="#features">Dictionary</a>
              </li>
              <li>
                <a href="#notebook">Return loop</a>
              </li>
            </ul>
          </div>
          <div>
            <p className="lfoot__head">Clarity</p>
            <ul>
              <li>
                <a href="#why">Why the SAT</a>
              </li>
              <li>
                <a href="#why-clarity">Why Clarity</a>
              </li>
              <li>
                <a href="/plans">Plans</a>
              </li>
              <li>
                <a href="/app/">Original site</a>
              </li>
              <li>
                <a href="#important">Important information</a>
              </li>
            </ul>
          </div>
          <div>
            <p className="lfoot__head">Your game</p>
            <ul>
              <li>
                <a href="#/start">Get started</a>
              </li>
              <li>
                <a href="#/signin">Sign in</a>
              </li>
              <li>
                <a href="#/me">
                  <Shirt size={14} /> Wardrobe
                </a>
              </li>
              <li>
                <a href="https://github.com/wresearch" target="_blank" rel="noreferrer">
                  wresearch on GitHub <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </div>
        </nav>
        <span className="lfoot__note">Clarity is built at wresearch. © 2026 wresearch. All rights reserved. Beta: some features still live in the original app.</span>
      </footer>
    </div>
  )
}
