import { ArrowRight, BookOpen, ClipboardCheck, Gift, PenLine, Play, Swords } from 'lucide-react'

import { DOMAINS, PATH, SKILL_SHORT, domainOf } from '../game/content.ts'
import { currentNode, dueComebacks, pagesGoal, pagesOn, upcomingComebacks } from '../game/engine.ts'
import { bestResult, useExams } from '../game/exams.ts'
import { useGame, useToday } from '../game/store.ts'
import { go } from '../router.ts'
import { GameShell } from '../components/GameShell.tsx'
import { ClipGlyph, INK_VAR } from '../components/Glyphs.tsx'
import { League, PackOpener, Quests, WeeklyCard } from '../components/Panels.tsx'
import { Tangyuan, type Mood } from '../components/Tangyuan.tsx'

export function Today() {
  const game = useGame()
  const day = useToday()
  const exams = useExams()
  const best = bestResult()
  const node = currentNode(game)
  const due = dueComebacks(game, day)
  const upcoming = upcomingComebacks(game, day)
  const domain = DOMAINS.find((item) => item.id === node.domainId) ?? DOMAINS[0]
  const studied = game.streak.lastDay === day
  const goal = pagesGoal(game)
  const done = pagesOn(game, day)

  const line = (() => {
    if (due.length > 0) return `${due.length} comeback${due.length === 1 ? ' is' : 's are'} back today. Beat ${due.length === 1 ? 'it' : 'them'} before ${due.length === 1 ? 'it slips' : 'they slip'} again.`
    if (!studied && game.streak.count > 0) return `One page keeps your ${game.streak.count}-day streak alive.`
    if (!studied) return 'One page today starts a streak. Five questions, about four minutes.'
    if (done < goal) return `Streak safe. ${goal - done} more page${goal - done === 1 ? '' : 's'} hits your daily goal.`
    return 'Daily goal done. A Speed Round is a good way to spend the extra.'
  })()
  const mood: Mood = due.length > 0 ? 'think' : studied ? 'wink' : 'happy'

  const nodeIcon = node.kind === 'lesson' ? BookOpen : node.kind === 'boss' ? Swords : node.kind === 'chest' ? Gift : PenLine
  const NodeIcon = nodeIcon
  const startNode = () => {
    if (node.kind === 'lesson' && node.skill) go(`/lesson/${node.id.replace(/-lesson$/, '')}`)
    else if (node.kind === 'chest') go('/path')
    else go(`/play/${node.id}`)
  }
  const nodeIndex = PATH.findIndex((item) => item.id === node.id)

  return (
    <GameShell active="today">
      <div className="today">
        <div className="today__main">
          <div className="greet">
            <Tangyuan outfit={game.outfit} mood={mood} size={104} />
            <p className="speech greet__speech" aria-live="polite">
              {line}
            </p>
          </div>

          <article className="page-card sheet sheet--ruled" style={{ ['--mark' as string]: INK_VAR[domain.ink] }}>
            {due.length > 0 && (
              <div className="page-card__clips" aria-hidden="true">
                {due.slice(0, 3).map((entry) => (
                  <ClipGlyph key={entry.qid} size={44} />
                ))}
              </div>
            )}
            <div className="page-card__tab">{domain.name}</div>
            <div className="page-card__body">
              <h1 className="display page-card__title">{node.title}</h1>
              <p className="page-card__meta">
                <span className="page-card__stop">
                  <NodeIcon aria-hidden="true" /> Stop {nodeIndex + 1} of {PATH.length}
                </span>
                {node.kind === 'lesson'
                  ? 'A two-minute lesson with a checkpoint question.'
                  : node.kind === 'chest'
                    ? 'Chapter cleared — three sticker packs inside.'
                    : node.kind === 'boss'
                      ? `Seven hard questions across ${domain.short}. Clear it to open the chest.`
                      : `5 new questions${due.length > 0 ? ` + ${Math.min(2, due.length)} comeback${Math.min(2, due.length) === 1 ? '' : 's'}` : ''} · about 4 minutes`}
              </p>
              <div className="page-card__go">
                <button type="button" className="btn btn--lg" onClick={startNode}>
                  <Play /> {node.kind === 'lesson' ? 'Start the lesson' : node.kind === 'chest' ? 'Open the chest' : 'Play this page'}
                </button>
                <div className="goal" aria-label={`${done} of ${goal} pages today`}>
                  <span className="goal__label">
                    Daily goal <b className="num">{Math.min(done, goal)}/{goal}</b>
                  </span>
                  <span className="meter meter--thick" style={{ ['--value' as string]: Math.min(1, done / goal) }}>
                    <span />
                  </span>
                </div>
              </div>
            </div>
          </article>

          <section className="comebacks-strip" aria-labelledby="cb-title">
            <header className="panel__head">
              <h2 className="title panel__title" id="cb-title">
                Comebacks
              </h2>
              <a className="panel__link" href="#/notebook">
                Open Mistake Notebook <ArrowRight size={14} />
              </a>
            </header>
            {due.length === 0 && upcoming.length === 0 ? (
              <p className="empty">Nothing clipped yet. Miss a question and it lands here, set to come back tomorrow.</p>
            ) : (
              <div className="cb-row">
                {due.length > 0 && (
                  <button type="button" className="cb-due" onClick={() => go('/play/comebacks')}>
                    <span className="display num">{due.length}</span>
                    <span>due today</span>
                    <span className="cb-due__go">
                      Beat them <ArrowRight size={16} />
                    </span>
                  </button>
                )}
                {upcoming.slice(0, 4).map((entry) => (
                  <span key={entry.qid} className="cb-chip" style={{ ['--mark' as string]: INK_VAR[domainOf(entry.skill).ink] }}>
                    <span className="cb-chip__skill">{SKILL_SHORT[entry.skill]}</span>
                    <span className="cb-chip__due num">{entry.dueDay.slice(5).replace('-', '/')}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          <div className="today__duo">
            <section className="panel panel--card" aria-labelledby="packs-title">
              <header className="panel__head">
                <h2 className="title panel__title" id="packs-title">
                  Sticker packs
                </h2>
              </header>
              <PackOpener />
            </section>
            <WeeklyCard />
          </div>
        </div>

        <aside className="today__side">
          <Quests />
          <League />
          <button type="button" className="speed-cta" onClick={() => go('/arena')}>
            <Swords aria-hidden="true" />
            <span>
              <b>Arena</b>
              <span>Speed Rounds vs a rival or a friend</span>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
          <button type="button" className="speed-cta speed-cta--exam" onClick={() => go('/exams')}>
            <ClipboardCheck aria-hidden="true" />
            <span>
              <b>{best ? `Practice test · best ${best.scaled}` : 'Practice test'}</b>
              <span>{exams.sitting ? 'You have one open. Pick up where you left off.' : best ? 'Two modules, 64 minutes, scored' : 'Start with the diagnostic to see where you are'}</span>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
        </aside>
      </div>
    </GameShell>
  )
}
