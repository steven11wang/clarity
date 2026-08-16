import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Clock, Dot, Trash2 } from 'lucide-react'

import {
  dueWords,
  sortWords,
  wordCounts,
  wordStageLabel,
  wordStatus,
  type WordBankEntry,
  type WordStatus,
} from '../../dictionary/wordBank.ts'
import { formatDueIn } from '../../review/vault.ts'
import { STAGE_LABELS } from '../../review/schedule.ts'
import {
  getWordBankEntries,
  now,
  removeWord,
  subscribeStorageChanges,
} from '../../storage/index.ts'
import {
  WordDrill,
  isDrillFinished,
  recordDrillAnswer,
  startWordDrill,
  type Drill,
} from './WordDrill.tsx'
import './wordBank.css'

type WordBankProps = {
  onBack: () => void
}

type Filter = WordStatus | 'all'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'due', label: 'Due now' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'retired', label: 'Retired' },
  { key: 'all', label: 'Everything' },
]

export function WordBank({ onBack }: WordBankProps) {
  // The bank is read straight from storage: it is written from inside the exam
  // runner, so a version counter is the simplest way to stay in step with it.
  const [version, setVersion] = useState(0)
  const [filter, setFilter] = useState<Filter>('due')
  const [drill, setDrill] = useState<Drill | null>(null)

  useEffect(() => {
    return subscribeStorageChanges(() => {
      setVersion((value) => value + 1)
    })
  }, [])

  const snapshot = useMemo(() => {
    void version
    return { entries: getWordBankEntries(), at: now() }
  }, [version])

  const entries = useMemo(
    () => sortWords(snapshot.entries, snapshot.at),
    [snapshot],
  )
  const counts = useMemo(() => wordCounts(entries, snapshot.at), [entries, snapshot.at])
  const due = useMemo(() => dueWords(entries, snapshot.at), [entries, snapshot.at])
  const active =
    filter === 'all' ? entries : entries.filter((entry) => wordStatus(entry, snapshot.at) === filter)

  function startDrill(queue: WordBankEntry[]) {
    const next = startWordDrill(queue)
    if (next) setDrill(next)
  }

  function answerCard(knewIt: boolean) {
    setDrill((current) => {
      if (!current) return current
      const next = recordDrillAnswer(current, knewIt)
      setVersion((value) => value + 1)
      return next
    })
  }

  function forget(entry: WordBankEntry) {
    removeWord(entry.id)
    setVersion((value) => value + 1)
  }

  if (drill && isDrillFinished(drill)) {
    return (
      <section className="wordbank wordbank--drill" aria-label="Word drill complete">
        <div className="wordbank__card wordbank__card--done">
          <p className="wordbank__eyebrow">DRILL COMPLETE</p>
          <h1>
            {drill.knew} of {drill.queue.length} recalled.
          </h1>
          <p className="wordbank__lede">
            The ones you knew move a rung up the ladder. The rest come back tomorrow.
          </p>
          <button
            className="console-button console-button--primary"
            type="button"
            onClick={() => setDrill(null)}
          >
            Back to the word bank
          </button>
        </div>
      </section>
    )
  }

  if (drill) {
    return (
      <WordDrill
        drill={drill}
        onReveal={() => setDrill((current) => (current ? { ...current, revealed: true } : current))}
        onAnswer={answerCard}
        onExit={() => setDrill(null)}
      />
    )
  }

  return (
    <section className="wordbank" aria-label="Word bank">
      <header className="wordbank__head">
        <button className="wordbank__back" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Back
        </button>
        <p className="wordbank__eyebrow">PASSAGE VOCABULARY · WORD BANK</p>
        <h1>Every word you<br />had to look up.</h1>
        <p className="wordbank__lede">
          Words you saved from a passage, each kept with the sentence you met it in.
          They come back as flashcards on the same widening schedule as your misses -
          {' '}{STAGE_LABELS.join(', then ')}. Four clean recalls and a word retires.
        </p>

        <div className="wordbank__actions">
          <button
            className="console-button console-button--primary"
            type="button"
            disabled={due.length === 0}
            onClick={() => startDrill(due)}
          >
            {due.length > 0 ? `Review due words (${due.length})` : 'Nothing due right now'}
          </button>
          <button
            className="console-button console-button--secondary"
            type="button"
            disabled={entries.length === 0}
            onClick={() => startDrill(entries)}
          >
            Drill every word ({entries.length})
          </button>
        </div>

        <dl className="wordbank__stats">
          <div><dt>{counts.due}</dt><dd>DUE NOW</dd></div>
          <div><dt>{counts.scheduled}</dt><dd>SCHEDULED</dd></div>
          <div><dt>{counts.retired}</dt><dd>RETIRED</dd></div>
        </dl>
      </header>

      <nav className="wordbank__filters" aria-label="Filter saved words">
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
        <p className="wordbank__empty">
          {entries.length === 0
            ? 'Nothing saved yet. Turn on Dictionary during a practice exam, click a word you don’t know, and save it here.'
            : 'Nothing in this drawer right now.'}
        </p>
      ) : (
        <ol className="wordbank__list">
          {active.map((entry) => {
            const status = wordStatus(entry, snapshot.at)
            return (
              <li className={`wordbank__row wordbank__row--${status}`} key={entry.id}>
                <span className="wordbank__row-mark" aria-hidden="true">
                  {status === 'retired'
                    ? <Check size={14} strokeWidth={1.75} absoluteStrokeWidth />
                    : status === 'due'
                      ? <Clock size={14} strokeWidth={1.5} absoluteStrokeWidth />
                      : <Dot size={14} strokeWidth={1.5} absoluteStrokeWidth />}
                </span>
                <div className="wordbank__row-copy">
                  <strong>
                    {entry.word} <em>{entry.partOfSpeech}</em>
                  </strong>
                  <p>{entry.definition}</p>
                  <q>{entry.sentence}</q>
                </div>
                <div className="wordbank__row-state">
                  <b>{status === 'retired' ? 'Retired' : formatDueIn(entry.dueAt - snapshot.at)}</b>
                  <small>
                    {status === 'retired'
                      ? `${entry.clears} clean recalls`
                      : `Next return: ${wordStageLabel(entry)}`}
                  </small>
                  <button
                    className="wordbank__forget"
                    type="button"
                    onClick={() => forget(entry)}
                    aria-label={`Remove ${entry.word} from the word bank`}
                  >
                    <Trash2 size={14} strokeWidth={1.6} absoluteStrokeWidth />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
