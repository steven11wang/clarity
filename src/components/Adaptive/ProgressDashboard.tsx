import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import {
  DOMAIN_PRESENTATION,
  SAT_DOMAINS,
  type CharacterStage,
  type Level,
  type SatDomain,
} from '../../progression/config.ts'
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
  libraryPanel: ReactNode
  insightsPanel: ReactNode
  cards: DomainCardView[]
  onSelectDomain: (domain: SatDomain) => void
  onUpdateScore: () => void
  onOpenPractice: () => void
  onOpenLibrary: () => void
  onOpenInsights: () => void
}

type ConsoleSelection =
  | { kind: 'today' }
  | { kind: 'domain'; domain: SatDomain }
  | { kind: 'reviews' }
  | { kind: 'trophies' }

const TILE_MARKS = ['◎', '◇', '≋', '▥']
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
  onSelectDomain: (domain: SatDomain) => void,
  onOpenLibrary: () => void,
  onOpenInsights: () => void,
  onUpdateScore: () => void,
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
  if (selection.kind === 'reviews') {
    return {
      kicker: 'SPACED RETURN · REVIEW QUEUE',
      title: 'Every miss comes back in disguise.',
      body: 'Choices are reshuffled and the wording changes, so recognition cannot carry you. Revisit the ideas that need another pass.',
      primary: 'Open review library',
      secondary: 'Return to today',
      primaryAction: onOpenLibrary,
      secondaryAction: () => setSelection({ kind: 'today' }),
    }
  }
  if (selection.kind === 'trophies') {
    return {
      kicker: 'INSIGHTS · PROGRESS',
      title: `${securedSkills} skills secured so far.`,
      body: 'See your calibration, accuracy, review history, and the patterns behind your strongest sessions.',
      primary: 'Open learning insights',
      secondary: 'Update score report',
      primaryAction: onOpenInsights,
      secondaryAction: onUpdateScore,
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
  libraryPanel,
  insightsPanel,
  cards,
  onSelectDomain,
  onUpdateScore,
  onOpenPractice,
  onOpenLibrary,
  onOpenInsights,
}: ProgressDashboardProps) {
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
    onSelectDomain,
    onOpenLibrary,
    onOpenInsights,
    onUpdateScore,
    setSelection,
  ), [
    cards,
    heroSelection,
    onOpenInsights,
    onOpenLibrary,
    onSelectDomain,
    onUpdateScore,
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

  const rail: Array<{
    label: string
    mark: string
    selection: ConsoleSelection
    card?: DomainCardView
  }> = [
    { label: 'Today', mark: '⌂', selection: { kind: 'today' } },
    ...cards.map((card, index) => ({
      label: DOMAIN_PRESENTATION[card.domain].shortName,
      mark: TILE_MARKS[index],
      selection: { kind: 'domain', domain: card.domain } as ConsoleSelection,
      card,
    })),
    { label: 'Due reviews', mark: '◷', selection: { kind: 'reviews' } },
    { label: 'Trophies', mark: '♜', selection: { kind: 'trophies' } },
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
            ⌕
          </button>
          <SettingsPopover onScoreUpdate={onUpdateScore} />
          <button
            className="console-avatar"
            type="button"
            aria-label="Update learner profile"
            onClick={onUpdateScore}
            data-ui-sound="true"
            data-ui-sound-hover="hover"
            data-ui-sound-click="open"
          >
            ⌁
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
            const accent =
              item.card ? DOMAIN_PRESENTATION[item.card.domain].accent : '#2b5bc7'
            return (
              <button
                className={[
                  'console-tile',
                  selected ? 'console-tile--selected' : '',
                  item.card ? 'console-tile--game' : 'console-tile--utility',
                ].filter(Boolean).join(' ')}
                style={{ '--tile-accent': accent } as CSSProperties}
                type="button"
                key={item.label}
                onClick={() => setSelection(item.selection)}
                aria-pressed={selected}
                aria-label={item.label}
                data-ui-sound="true"
                data-ui-sound-hover="hover"
                data-ui-sound-click={item.card ? 'select' : 'open'}
              >
                <span className="console-tile__layers" aria-hidden="true" />
                <span className="console-tile__mark" aria-hidden="true">{item.mark}</span>
                {item.card && (
                  <span className="console-tile__badge" aria-hidden="true">
                    {item.card.completedSkills === item.card.totalSkills ? '✓' : item.card.completedSkills}
                  </span>
                )}
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
          onClick={onOpenLibrary}
          data-ui-sound="true"
          data-ui-sound-hover="hover"
          data-ui-sound-click="open"
        >
          <span>◷</span> Review practice
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
          <span>♙</span> Checkpoint progress
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
                <span>{DOMAIN_PRESENTATION[card.domain].shortName} — {card.checkpointStatus}</span>
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
          library: libraryPanel,
          insights: insightsPanel,
        }}
      />
    </main>
  )
}
