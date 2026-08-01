import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  BookOpen,
  Flag,
  GitMerge,
  GraduationCap,
  House,
  RotateCcw,
  Search,
  Type as TypeIcon,
  UserRound,
} from 'lucide-react'

import {
  DOMAIN_PRESENTATION,
  SAT_DOMAINS,
  type CharacterStage,
  type Level,
  type SatDomain,
} from '../../progression/config.ts'
import { useAuthProfile } from '../../auth/AuthContext.tsx'
import { SettingsPopover } from '../Settings/SettingsPopover.tsx'
import { PrimaryViewTransition } from './PrimaryViewTransition.tsx'
import type { PrimaryConsoleView } from './primaryViewTransition.ts'

export type DomainCardView = {
  domain: SatDomain
  characterStage: CharacterStage
  currentLevel: Level
  completedSkills: number
  totalSkills: number
  checkpointStatus: string
  recommended: boolean
  chosen: boolean
  finished: boolean
}

type ProgressDashboardProps = {
  activeView: PrimaryConsoleView
  lessonsPanel: ReactNode
  reviewsPanel: ReactNode
  libraryPanel: ReactNode
  insightsPanel: ReactNode
  cards: DomainCardView[]
  dueCount?: number
  onSelectDomain: (domain: SatDomain) => void
  onUpdateScore: () => void
  onOpenPractice: () => void
  onOpenLessons: () => void
  onOpenReviews: () => void
  onOpenLibrary: () => void
  onOpenInsights: () => void
}

type ConsoleSelection =
  | { kind: 'today' }
  | { kind: 'domain'; domain: SatDomain }
  | { kind: 'lessons' }
  | { kind: 'reviews' }

// One icon family (Lucide) at one stroke weight, instead of Unicode glyphs.
// Glyphs came from whichever symbol font the OS happened to have, so the rail
// rendered at four different optical weights and shifted between platforms.
const TILE_ICON_SIZE = 26
const TILE_ICONS = [Search, BookOpen, GitMerge, TypeIcon]
const LESSON_TILE_ACCENT = '#8cb4ff'
const HERO_BACKGROUND_LEAD_MS = 180
const HERO_TEXT_SETTLE_MS = 320

function selectionsMatch(left: ConsoleSelection, right: ConsoleSelection) {
  if (left.kind !== right.kind) return false
  return left.kind !== 'domain' || right.kind !== 'domain' || left.domain === right.domain
}

function buildHero(
  selection: ConsoleSelection,
  cards: DomainCardView[],
  totalSkills: number,
  securedSkills: number,
  dueCount: number,
  onSelectDomain: (domain: SatDomain) => void,
  onOpenLessons: () => void,
  onOpenReviews: () => void,
  onOpenLibrary: () => void,
  setSelection: (selection: ConsoleSelection) => void,
) {
  if (selection.kind === 'today') {
    const next = cards.find((card) => card.recommended) ?? cards[0]
    return {
      kicker: 'TODAY · YOUR NEXT MOVE',
      title: `${totalSkills - securedSkills} skills are waiting for you.`,
      body: `${DOMAIN_PRESENTATION[next.domain].shortName} is the strongest place to continue. Your path, completed skills, and checkpoint progress are all saved.`,
      primary: 'Continue recommended path',
      secondary: 'Browse practice library',
      primaryAction: () => onSelectDomain(next.domain),
      secondaryAction: onOpenLibrary,
    }
  }
  if (selection.kind === 'lessons') {
    return {
      kicker: 'LESSONS · CLASSROOM',
      title: 'Learn the move before you drill it.',
      body: 'Four lesson halls, one per domain. Step inside, pick the skill you want to understand, and read the Foundations lesson before the questions come at you.',
      primary: 'Enter classroom',
      primaryAction: onOpenLessons,
    }
  }
  if (selection.kind === 'reviews') {
    return {
      kicker: 'SPACED RETURN · MISTAKE VAULT',
      title:
        dueCount > 0
          ? `${dueCount} ${dueCount === 1 ? 'miss is' : 'misses are'} ready to come back.`
          : 'Every miss comes back in disguise.',
      body: 'Wrong answers are filed in the vault and handed back on a widening schedule - 1 day, 3 days, a week, a month. Clear all four and the question retires.',
      primary: 'Open the mistake vault',
      primaryAction: onOpenReviews,
    }
  }
  const card = cards.find((entry) => entry.domain === selection.domain) ?? cards[0]
  const presentation = DOMAIN_PRESENTATION[card.domain]
  const remaining = Math.max(0, card.totalSkills - card.completedSkills)
  return {
    kicker: `${presentation.shortName.toUpperCase()} · ${
      card.finished ? 'MASTERED' : `${card.currentLevel.toUpperCase()} TRAINING`
    }`,
    title: card.domain,
    body: presentation.description,
    primary: card.finished ? 'Visit completed path' : 'Open this path',
    secondary:
      remaining === 0
        ? card.checkpointStatus
        : `${remaining} ${remaining === 1 ? 'skill' : 'skills'} until checkpoint`,
    primaryAction: () => onSelectDomain(card.domain),
    secondaryAction: () => onSelectDomain(card.domain),
  }
}

export function ProgressDashboard({
  activeView,
  lessonsPanel,
  reviewsPanel,
  libraryPanel,
  insightsPanel,
  cards,
  dueCount = 0,
  onSelectDomain,
  onUpdateScore,
  onOpenPractice,
  onOpenLessons,
  onOpenReviews,
  onOpenLibrary,
  onOpenInsights,
}: ProgressDashboardProps) {
  const { openAccount } = useAuthProfile()
  const firstDomain =
    cards.find((card) => card.chosen)?.domain ??
    cards.find((card) => card.recommended)?.domain ??
    SAT_DOMAINS[0]
  const [selection, setSelection] = useState<ConsoleSelection>({
    kind: 'domain',
    domain: firstDomain,
  })
  const [heroSelection, setHeroSelection] = useState<ConsoleSelection>({
    kind: 'domain',
    domain: firstDomain,
  })
  const [heroTransitionState, setHeroTransitionState] = useState<'idle' | 'switching'>('idle')
  const [heroMotionKey, setHeroMotionKey] = useState(0)
  const transitionTimers = useRef<number[]>([])

  const totalSkills = cards.reduce((sum, card) => sum + card.totalSkills, 0)
  const securedSkills = cards.reduce((sum, card) => sum + card.completedSkills, 0)
  const mastery = totalSkills ? Math.round((securedSkills / totalSkills) * 100) : 0
  const selectedCard =
    selection.kind === 'domain'
      ? cards.find((card) => card.domain === selection.domain) ?? cards[0]
      : null

  const hero = useMemo(() => buildHero(
    heroSelection,
    cards,
    totalSkills,
    securedSkills,
    dueCount,
    onSelectDomain,
    onOpenLessons,
    onOpenReviews,
    onOpenLibrary,
    setSelection,
  ), [
    cards,
    dueCount,
    heroSelection,
    onOpenLessons,
    onOpenLibrary,
    onOpenReviews,
    onSelectDomain,
    securedSkills,
    totalSkills,
  ])

  useEffect(() => {
    if (cards.length === 0) return
    if (selectionsMatch(selection, heroSelection)) return

    setHeroTransitionState('switching')
    setHeroMotionKey((value) => value + 1)
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer))
    transitionTimers.current = [
      window.setTimeout(() => {
        setHeroSelection(selection)
      }, HERO_BACKGROUND_LEAD_MS),
      window.setTimeout(() => {
        setHeroTransitionState('idle')
      }, HERO_BACKGROUND_LEAD_MS + HERO_TEXT_SETTLE_MS),
    ]

    return () => {
      transitionTimers.current.forEach((timer) => window.clearTimeout(timer))
      transitionTimers.current = []
    }
  }, [cards.length, heroSelection, selection])

  useEffect(() => () => {
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  // Domains and Lessons are the "game" tiles - the things you actually go and
  // play. Today and reviews stay utility marks. Insights left the rail; it is a
  // nav tab beside Library now.
  const rail: Array<{
    label: string
    Mark: typeof House
    selection: ConsoleSelection
    game: boolean
    accent?: string
    card?: DomainCardView
  }> = [
    { label: 'Today', Mark: House, selection: { kind: 'today' }, game: false },
    ...cards.map((card, index) => ({
      label: DOMAIN_PRESENTATION[card.domain].shortName,
      Mark: TILE_ICONS[index] ?? Search,
      selection: { kind: 'domain', domain: card.domain } as ConsoleSelection,
      game: true,
      accent: DOMAIN_PRESENTATION[card.domain].accent,
      card,
    })),
    {
      label: 'Lessons',
      Mark: GraduationCap,
      selection: { kind: 'lessons' },
      game: true,
      accent: LESSON_TILE_ACCENT,
    },
    { label: 'Due reviews', Mark: RotateCcw, selection: { kind: 'reviews' }, game: false },
  ]

  const activeRailIndex = rail.findIndex((item) => {
    if (item.selection.kind !== selection.kind) return false
    return (
      item.selection.kind !== 'domain' ||
      (selection.kind === 'domain' && item.selection.domain === selection.domain)
    )
  })
  const activeRail = rail[Math.max(0, activeRailIndex)]

  return (
    <main
      className={`console-dashboard ${
        activeView === 'practice'
          ? selectedCard
            ? `console-dashboard--domain-${SAT_DOMAINS.indexOf(selectedCard.domain)}`
            : `console-dashboard--${selection.kind}`
          : 'console-dashboard--today'
      }`}
    >
      <div
        key={`wash-${heroMotionKey}`}
        className={`console-hero-wash ${
          heroTransitionState === 'switching' ? 'console-hero-wash--switching' : ''
        }`}
        aria-hidden="true"
      >
        <span />
        <i />
      </div>

      <header className="console-header">
        <button
          className="console-wordmark"
          type="button"
          aria-label="Open Practice home"
          onClick={() => {
            setSelection({ kind: 'today' })
            onOpenPractice()
          }}
        >
          clarity<span>.</span>
        </button>
        <nav className="console-nav" aria-label="Main navigation">
          <button
            className={activeView === 'practice' ? 'console-nav__active' : undefined}
            type="button"
            aria-current={activeView === 'practice' ? 'page' : undefined}
            onClick={() => {
              setSelection({ kind: 'today' })
              onOpenPractice()
            }}
            data-ui-sound="true"
            data-ui-sound-hover="hover"
            data-ui-sound-click="select"
          >
            Practice
          </button>
          <button
            className={activeView === 'library' ? 'console-nav__active' : undefined}
            type="button"
            aria-current={activeView === 'library' ? 'page' : undefined}
            onClick={onOpenLibrary}
            data-ui-sound="true"
            data-ui-sound-hover="hover"
            data-ui-sound-click="select"
          >
            Library
          </button>
          <button
            className={activeView === 'insights' ? 'console-nav__active' : undefined}
            type="button"
            aria-current={activeView === 'insights' ? 'page' : undefined}
            onClick={onOpenInsights}
            data-ui-sound="true"
            data-ui-sound-hover="hover"
            data-ui-sound-click="select"
          >
            Insights
          </button>
        </nav>
        <div className="console-header__actions">
          <button
            type="button"
            aria-label="Search practice library"
            onClick={onOpenLibrary}
            data-ui-sound="true"
            data-ui-sound-hover="hover"
            data-ui-sound-click="open"
          >
            <Search size={19} strokeWidth={1.5} absoluteStrokeWidth />
          </button>
          <SettingsPopover onScoreUpdate={onUpdateScore} />
          <button
            className="console-avatar"
            type="button"
            aria-label="Update learner profile"
            onClick={openAccount}
            data-ui-sound="true"
            data-ui-sound-hover="hover"
            data-ui-sound-click="open"
          >
            <UserRound size={18} strokeWidth={1.5} absoluteStrokeWidth />
          </button>
        </div>
      </header>

      <PrimaryViewTransition
        activeView={activeView}
        panels={{
          practice: (
            <>
      <section className="console-rail-section" aria-label="Practice areas">
        <div className="console-rail">
          {rail.map((item, index) => {
            const selected = index === activeRailIndex
            const accent = item.accent ?? '#2b5bc7'
            return (
              <button
                className={[
                  'console-tile',
                  selected ? 'console-tile--selected' : '',
                  item.game ? 'console-tile--game' : 'console-tile--utility',
                ].filter(Boolean).join(' ')}
                style={{ '--tile-accent': accent } as CSSProperties}
                type="button"
                key={item.label}
                onClick={() => setSelection(item.selection)}
                aria-pressed={selected}
                aria-label={item.label}
                data-ui-sound="true"
                data-ui-sound-hover="hover"
                data-ui-sound-click={item.game ? 'select' : 'open'}
              >
                <span className="console-tile__layers" aria-hidden="true" />
                <span className="console-tile__mark" aria-hidden="true">
                  <item.Mark size={TILE_ICON_SIZE} strokeWidth={1.5} absoluteStrokeWidth />
                </span>
              </button>
            )
          })}
        </div>
        <p className="console-rail-label">{activeRail?.label}</p>
      </section>

      <section className="console-hero">
        <div
          key={heroMotionKey}
          className={`console-hero__copy ${
            heroTransitionState === 'switching' ? 'console-hero__copy--switching' : 'console-hero__copy--settled'
          }`}
        >
          <p>{hero.kicker}</p>
          <h1>{hero.title}</h1>
          <span>{hero.body}</span>
          <div className="console-hero__actions">
            <button
              className="console-button console-button--primary"
              type="button"
              onClick={hero.primaryAction}
              data-ui-sound="true"
              data-ui-sound-hover="hover"
              data-ui-sound-click="select"
            >
              {hero.primary}
            </button>
            {hero.secondary && hero.secondaryAction ? (
              <button
                className="console-button console-button--secondary"
                type="button"
                onClick={hero.secondaryAction}
                data-ui-sound="true"
                data-ui-sound-hover="hover"
                data-ui-sound-click="open"
              >
                {hero.secondary}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="console-status-row" aria-label="Current progress">
        <div className="console-mastery">
          <span
            className="console-mastery__ring"
            style={{ '--mastery': `${mastery * 3.6}deg` } as CSSProperties}
            aria-hidden="true"
          ><i>✓</i></span>
          <strong>{mastery}%</strong>
        </div>
        <span className="console-status-divider" />
        <strong className="console-growth">+12%</strong>
        <button
          type="button"
          onClick={onOpenReviews}
          data-ui-sound="true"
          data-ui-sound-hover="hover"
          data-ui-sound-click="open"
        >
          <span><RotateCcw size={17} strokeWidth={1.5} absoluteStrokeWidth /></span> Review practice
          {dueCount > 0 ? ` · ${dueCount} due` : ''}
        </button>
        <button
          className="console-status-row__gate"
          type="button"
          onClick={() => {
            const ready = cards.find((card) => card.checkpointStatus === 'Ready')
            onSelectDomain((ready ?? cards[0]).domain)
          }}
          data-ui-sound="true"
          data-ui-sound-hover="hover"
          data-ui-sound-click="open"
        >
          <span><Flag size={17} strokeWidth={1.5} absoluteStrokeWidth /></span> Checkpoint progress
        </button>
      </section>

      <section className="console-widget-grid">
        <div className="console-widget-stack">
          <article className="console-widget console-session-widget">
            <h2>Session</h2>
            <div className="console-session-widget__body">
              <div><strong>Focus session · choose your next set</strong><p>Your next focused activity is ready whenever you are.</p></div>
            </div>
            <div className="console-energy"><span>ENERGY</span><b>{Math.max(40, 100 - (totalSkills - securedSkills) * 2)}%</b></div>
            <div className="console-energy__bar"><i /></div>
          </article>
          <article className="console-widget console-review-widget">
            <h2>Path status</h2>
            {cards.slice(0, 3).map((card) => (
              <button type="button" onClick={() => onSelectDomain(card.domain)} key={card.domain}>
                <span>{DOMAIN_PRESENTATION[card.domain].shortName}</span>
                <b>{card.completedSkills}/{card.totalSkills}</b>
              </button>
            ))}
          </article>
        </div>

        <div className="console-widget-stack">
          <article className="console-widget console-friends-widget">
            <h2>Study guide</h2>
            <div><span className="console-friend-dot console-friend-dot--blue" /><p><strong>{securedSkills} skills are secured</strong><small>Completed work stays safe as you advance.</small></p></div>
            <div><span className="console-friend-dot console-friend-dot--gold" /><p><strong>{totalSkills - securedSkills} skills remain</strong><small>Keep building toward the next mixed challenge.</small></p></div>
          </article>
          <article className="console-widget console-trophy-widget">
            <h2>Trophies</h2>
            <p><strong>{cards.filter((card) => card.finished).length}</strong> / {cards.length}</p>
            <div><span>Platinum {cards.filter((card) => card.finished).length}</span><span>Gold {cards.filter((card) => card.completedSkills === card.totalSkills && !card.finished).length}</span></div>
            <small>Next: secure every skill in a path.</small>
          </article>
        </div>

        <div className="console-widget-stack">
          <article className="console-widget console-checkpoint-widget">
            <h2>Next checkpoint</h2>
            <h3>{(cards.find((card) => card.checkpointStatus === 'Ready') ?? cards.find((card) => card.recommended) ?? cards[0]).domain}</h3>
            <p>Complete every current-level skill to open the mixed challenge. Your secured progress is never reset.</p>
            {cards.map((card) => (
              <button type="button" onClick={() => onSelectDomain(card.domain)} key={card.domain}>
                <i className={card.completedSkills === card.totalSkills ? 'is-done' : ''}>
                  {card.completedSkills === card.totalSkills ? '✓' : card.totalSkills - card.completedSkills}
                </i>
                <span>{DOMAIN_PRESENTATION[card.domain].shortName} - {card.checkpointStatus}</span>
              </button>
            ))}
          </article>
          <article className="console-widget console-capacity-widget">
            <h2>Mastery capacity</h2>
            <div><span>Secured</span><strong>{securedSkills} / {totalSkills}</strong></div>
            <div className="console-capacity-widget__bar"><i style={{ width: `${mastery}%` }} /></div>
            <p><span /> Secured <span /> In progress</p>
          </article>
        </div>
      </section>
            </>
          ),
          lessons: lessonsPanel,
          reviews: reviewsPanel,
          library: libraryPanel,
          insights: insightsPanel,
        }}
      />
    </main>
  )
}
