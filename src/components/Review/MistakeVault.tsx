import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Clock, Dot } from 'lucide-react'

import { STAGE_LABELS, stageLabel } from '../../review/schedule.ts'
import {
  REASON_LABELS,
  buildVault,
  formatDueIn,
  vaultCounts,
  type VaultEntry,
  type VaultStatus,
} from '../../review/vault.ts'
import type { Question, ReviewItem } from '../../types.ts'
import './mistakeVault.css'

type MistakeVaultProps = {
  questions: Question[]
  reviews: Record<string, ReviewItem>
  now: number
  onStart: (questions: Question[]) => void
  onBack: () => void
}

type Filter = VaultStatus | 'all'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'due', label: 'Due now' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'retired', label: 'Retired' },
  { key: 'all', label: 'Everything' },
]

export function MistakeVault({ questions, reviews, now, onStart, onBack }: MistakeVaultProps) {
  const [filter, setFilter] = useState<Filter>('due')
  const [openId, setOpenId] = useState<string | null>(null)

  const entries = useMemo(() => buildVault(questions, reviews, now), [questions, reviews, now])
  const counts = useMemo(() => vaultCounts(entries), [entries])
  const active = filter === 'all' ? entries : entries.filter((entry) => entry.status === filter)
  const dueQuestions = entries.filter((entry) => entry.status === 'due').map((entry) => entry.question)
  const openQuestions = entries
    .filter((entry) => entry.status !== 'retired')
    .map((entry) => entry.question)

  return (
    <section className="vault" aria-label="Mistake vault">
      <header className="vault__head">
        <button className="vault__back" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Back
        </button>
        <p className="vault__eyebrow">SPACED RETURN · MISTAKE VAULT</p>
        <h1>Every miss you<br />haven’t beaten yet.</h1>
        <p className="vault__lede">
          A question you got wrong is filed here and handed back to you on a widening
          schedule - {STAGE_LABELS.join(', then ')} after you clear it. Four clean returns
          and it retires for good.
        </p>

        <div className="vault__actions">
          <button
            className="console-button console-button--primary"
            type="button"
            disabled={dueQuestions.length === 0}
            onClick={() => onStart(dueQuestions)}
          >
            {dueQuestions.length > 0
              ? `Start due set (${dueQuestions.length})`
              : 'Nothing due right now'}
          </button>
          <button
            className="console-button console-button--secondary"
            type="button"
            disabled={openQuestions.length === 0}
            onClick={() => onStart(openQuestions)}
          >
            Drill everything open ({openQuestions.length})
          </button>
        </div>

        <dl className="vault__stats">
          <div><dt>{counts.due}</dt><dd>DUE NOW</dd></div>
          <div><dt>{counts.scheduled}</dt><dd>SCHEDULED</dd></div>
          <div><dt>{counts.retired}</dt><dd>RETIRED</dd></div>
        </dl>
      </header>

      <nav className="vault__filters" aria-label="Filter mistakes">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            className={filter === entry.key ? 'is-active' : undefined}
            type="button"
            aria-pressed={filter === entry.key}
            onClick={() => setFilter(entry.key)}
          >
            {entry.label}
            <span>{entry.key === 'all' ? entries.length : counts[entry.key]}</span>
          </button>
        ))}
      </nav>

      {active.length === 0 ? (
        <p className="vault__empty">
          {entries.length === 0
            ? 'Nothing filed yet. Miss a question and it lands here automatically.'
            : 'Nothing in this drawer right now.'}
        </p>
      ) : (
        <ol className="vault__list">
          {active.map((entry) => (
            <VaultRow
              key={entry.question.id}
              entry={entry}
              open={openId === entry.question.id}
              onToggle={() =>
                setOpenId((current) => (current === entry.question.id ? null : entry.question.id))
              }
              onStart={() => onStart([entry.question])}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function VaultRow({
  entry,
  open,
  onToggle,
  onStart,
}: {
  entry: VaultEntry
  open: boolean
  onToggle: () => void
  onStart: () => void
}) {
  const { question, item, status } = entry
  const cleared = status === 'retired' ? STAGE_LABELS.length : item.stage

  return (
    <li className={`vault__row vault__row--${status}`}>
      <button
        className="vault__row-main"
        type="button"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="vault__row-mark" aria-hidden="true">
          {status === 'retired'
            ? <Check size={14} strokeWidth={1.75} absoluteStrokeWidth />
            : status === 'due'
              ? <Clock size={14} strokeWidth={1.5} absoluteStrokeWidth />
              : <Dot size={14} strokeWidth={1.5} absoluteStrokeWidth />}
        </span>
        <span className="vault__row-copy">
          <strong>{question.prompt}</strong>
          <small>
            {question.domain} · {question.skill} · {question.difficulty}
          </small>
        </span>
        <span className="vault__row-state">
          <b>{status === 'retired' ? 'Retired' : formatDueIn(entry.dueInMs)}</b>
          <small>{REASON_LABELS[item.reason]}</small>
        </span>
      </button>

      {open && (
        <div className="vault__row-detail">
          <div className="vault__ladder" aria-label="Return schedule">
            {STAGE_LABELS.map((label, index) => (
              <span
                key={label}
                className={index < cleared ? 'is-cleared' : index === cleared ? 'is-next' : undefined}
              >
                {label}
              </span>
            ))}
          </div>
          <p>
            {status === 'retired'
              ? 'Cleared four times in a row. It will not come back unless you miss it again.'
              : `Next return: ${stageLabel(item.stage)} after the last clean pass. ${item.clears} clean ${
                  item.clears === 1 ? 'return' : 'returns'
                } so far - miss it again and it restarts at ${STAGE_LABELS[0]}.`}
          </p>
          <button className="console-button console-button--secondary" type="button" onClick={onStart}>
            Redo this one now
          </button>
        </div>
      )}
    </li>
  )
}
