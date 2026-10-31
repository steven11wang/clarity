// The Mistake Notebook. Every miss is a slip clipped to the page: what
// skill, what trap, when it comes back, and how many times it has been beaten.
// State is a mark, not a colour: a red clip means due, a highlighter swipe
// means cleared, the four dots count the beats.

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Play } from 'lucide-react'

import type { Question, TrapType } from '../../types.ts'
import { COMEBACK_DAYS, SKILL_SHORT, TRAPS, domainOf } from '../game/content.ts'
import { daysBetween, dueComebacks, type MissEntry } from '../game/engine.ts'
import { byId, loadBank } from '../game/questions.ts'
import { useGame, useToday } from '../game/store.ts'
import { go } from '../router.ts'
import { GameShell } from '../components/GameShell.tsx'
import { ClipGlyph, INK_VAR, TrapGlyph } from '../components/Glyphs.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'

type Filter = 'all' | TrapType

function when(day: string, today: string) {
  const gap = daysBetween(today, day)
  if (gap <= 0) return 'Due today'
  if (gap === 1) return 'Tomorrow'
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', gap < 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' })
}

export function Notebook() {
  const game = useGame()
  const day = useToday()
  const [filter, setFilter] = useState<Filter>('all')
  const [bank, setBank] = useState<Question[]>([])
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    void loadBank().then(setBank)
  }, [])

  const entries = Object.values(game.misses)
  const due = dueComebacks(game, day)
  const live = entries.filter((entry) => !entry.cleared).sort((a, b) => a.dueDay.localeCompare(b.dueDay))
  const cleared = entries.filter((entry) => entry.cleared)
  const shown = live.filter((entry) => filter === 'all' || entry.trap === filter)

  const counts = useMemo(() => {
    const map: Partial<Record<TrapType, number>> = {}
    entries.forEach((entry) => {
      if (entry.trap) map[entry.trap] = (map[entry.trap] ?? 0) + 1
    })
    return map
  }, [entries])
  const worst = TRAPS.reduce<{ id: TrapType; n: number } | null>((top, trap) => {
    const n = counts[trap.id] ?? 0
    return n > (top?.n ?? 0) ? { id: trap.id, n } : top
  }, null)

  return (
    <GameShell active="notebook">
      <div className="notebook">
        <header className="notebook__head">
          <div>
            <h1 className="display">
              Mistake Notebook
            </h1>
            <p>
              <b className="num">{live.length}</b> clipped · <b className="num">{due.length}</b> due today · <b className="num">{cleared.length}</b> cleared for good
            </p>
          </div>
          {due.length > 0 && (
            <button type="button" className="btn btn--lg btn--red" onClick={() => go('/play/comebacks')}>
              <Play /> Beat {due.length} comeback{due.length === 1 ? '' : 's'}
            </button>
          )}
        </header>

        {entries.length === 0 ? (
          <div className="notebook__empty sheet sheet--ruled">
            <Tangyuan mood="happy" size={110} />
            <div>
              <h2 className="title">An empty notebook — for now.</h2>
              <p>
                Miss a question and it’s clipped in here, set to come back in {COMEBACK_DAYS[0]} day. Beat it at {COMEBACK_DAYS.join(', ')} days and it’s cleared.
              </p>
              <button type="button" className="btn" onClick={() => go('/today')}>
                Play a page <ArrowRight />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="trap-filter" role="tablist" aria-label="Filter by trap">
              <button type="button" role="tab" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                All <span className="num">{live.length}</span>
              </button>
              {TRAPS.map((trap) => (
                <button key={trap.id} type="button" role="tab" className="chip" aria-pressed={filter === trap.id} onClick={() => setFilter(trap.id)}>
                  <TrapGlyph trap={trap.id} size={18} /> {trap.name} <span className="num">{counts[trap.id] ?? 0}</span>
                </button>
              ))}
            </div>

            {worst && worst.n >= 2 && (
              <p className="notebook__insight">
                <span className="hl hl--pink">{TRAPS.find((t) => t.id === worst.id)?.name}</span> has caught you {worst.n} times. {TRAPS.find((t) => t.id === worst.id)?.tell}
              </p>
            )}

            <div className="notebook__page sheet sheet--ruled">
              <ul className="slips slips--full">
                {shown.map((entry) => (
                  <SlipRow key={entry.qid} entry={entry} today={day} question={byId(bank, entry.qid)} open={open === entry.qid} onToggle={() => setOpen(open === entry.qid ? null : entry.qid)} />
                ))}
                {shown.length === 0 && <li className="empty">Nothing clipped under this trap.</li>}
              </ul>
            </div>

            {cleared.length > 0 && (
              <section className="cleared">
                <h2 className="title">Cleared for good</h2>
                <ul>
                  {cleared.map((entry) => (
                    <li key={entry.qid}>
                      <span className="hl hl--green">{SKILL_SHORT[entry.skill]}</span>
                      <span className="stamp stamp--sm">4/4</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </GameShell>
  )
}

function SlipRow({ entry, today, question, open, onToggle }: { entry: MissEntry; today: string; question?: Question; open: boolean; onToggle: () => void }) {
  const isDue = daysBetween(entry.dueDay, today) >= 0
  const domain = domainOf(entry.skill)
  return (
    <li className={`slip slip--full ${isDue ? 'is-due' : ''} ${open ? 'is-open' : ''}`}>
      <button type="button" className="slip__row" onClick={onToggle} aria-expanded={open}>
        <span className="slip__clip">
          <ClipGlyph size={34} color={isDue ? 'var(--red)' : 'var(--ink-3)'} />
        </span>
        <span className="slip__body">
          <span className="slip__skill">
            <span className="tag" style={{ ['--mark' as string]: INK_VAR[domain.ink] }}>
              {SKILL_SHORT[entry.skill]}
            </span>
          </span>
          <span className="slip__trap">
            {entry.trap ? (
              <>
                <TrapGlyph trap={entry.trap} size={20} /> {TRAPS.find((t) => t.id === entry.trap)?.name}
              </>
            ) : (
              <span className="hand">trap not named</span>
            )}
          </span>
        </span>
        <span className="slip__beats" aria-label={`Beaten ${entry.beats} of ${COMEBACK_DAYS.length}`}>
          {COMEBACK_DAYS.map((_, i) => (
            <span key={i} className={i < entry.beats ? 'is-on' : ''} />
          ))}
        </span>
        <span className={`slip__due ${isDue ? 'is-due' : ''}`}>{when(entry.dueDay, today)}</span>
      </button>
      {open && question && (
        <div className="slip__peek">
          <p className="slip__prompt">{question.prompt}</p>
          <p className="slip__passage">{question.passage.length > 260 ? `${question.passage.slice(0, 260)}…` : question.passage}</p>
          <p className="hand">The answer stays hidden until it comes back. That’s the point.</p>
        </div>
      )}
    </li>
  )
}
