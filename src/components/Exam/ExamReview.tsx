import { useMemo, useState } from 'react'
import {
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { LookupText } from '../../dictionary/LookupText.tsx'
import { resolveChoiceContext } from '../../dictionary/context.ts'
import { useWordLookup } from '../../dictionary/useWordLookup.ts'
import { ExamPassage } from './ExamPassage.tsx'
import { ExamExplanation } from './ExamExplanation.tsx'
import { ExamFigure } from './ExamFigure.tsx'
import { ExamTable } from './ExamTable.tsx'
import { WordLookupPopover } from './WordLookupPopover.tsx'
import {
  DIFFICULTY_LABEL,
  formatClock,
  type ExamModule,
  type ExamQuestion,
  type PracticeExam,
} from './examData.ts'
import { scaledScore, skillBreakdown } from './examScore.ts'
import { DictionaryToggle } from '../QuestionInteraction/ChoiceStrikeout.tsx'
import type { ExamResult } from './ExamRunner.tsx'

type Status = 'correct' | 'incorrect' | 'omitted' | 'unscored'

type Entry = {
  module: ExamModule
  question: ExamQuestion
  chosen: string | undefined
  flagged: boolean
  seconds: number
  status: Status
}

type SortKey = 'number' | 'topic' | 'subtopic' | 'difficulty' | 'seconds'

const STATUS_LABEL: Record<Status, string> = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  omitted: 'Omitted',
  unscored: 'No key for this one',
}

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'extreme']

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'number', label: 'Question' },
  { key: 'topic', label: 'Topic' },
  { key: 'subtopic', label: 'Subtopic' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'seconds', label: 'Time Spent' },
]

function statusOf(question: ExamQuestion, chosen: string | undefined): Status {
  if (question.answer === null) return 'unscored'
  if (chosen === undefined) return 'omitted'
  return chosen === question.answer ? 'correct' : 'incorrect'
}

function tallyClass(correct: number, scored: number): string {
  if (scored === 0) return 'exam-tally--empty'
  if (correct === scored) return 'exam-tally--full'
  return 'exam-tally--partial'
}

export function ExamReview({
  exam,
  result,
  onUpdateResult,
}: {
  exam: PracticeExam
  result: ExamResult
  onUpdateResult?: (result: ExamResult) => void
}) {
  const entries = useMemo<Entry[]>(
    () =>
      exam.modules.flatMap((module) =>
        module.questions.map((question) => {
          const chosen = result.answers[question.id]
          return {
            module,
            question,
            chosen,
            flagged: result.flagged.includes(question.id),
            seconds: result.questionSeconds?.[question.id] ?? 0,
            status: statusOf(question, chosen),
          }
        }),
      ),
    [exam, result],
  )

  const domains = useMemo(
    () => skillBreakdown(exam, result.answers),
    [exam, result.answers],
  )

  const scored = entries.filter((entry) => entry.status !== 'unscored')
  const correct = scored.filter((entry) => entry.status === 'correct').length
  const score = scaledScore(scored.length - correct)

  const [openDomains, setOpenDomains] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(domains.map((domain) => [domain.name, true])),
  )
  const [moduleId, setModuleId] = useState(exam.modules[0]?.id ?? '')
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({
    key: 'number',
    ascending: true,
  })
  const [reviewed, setReviewed] = useState<Record<string, boolean>>(
    () => result.reviewedQuestions ?? {},
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const [dictionary, setDictionary] = useState(false)

  const wordLookup = useWordLookup()

  const inModule = entries.filter((entry) => entry.module.id === moduleId)
  const rows = [...inModule].sort((left, right) => {
    const direction = sort.ascending ? 1 : -1
    switch (sort.key) {
      case 'number':
        return (left.question.number - right.question.number) * direction
      case 'seconds':
        return (left.seconds - right.seconds) * direction
      case 'difficulty':
        return (
          (DIFFICULTY_ORDER.indexOf(left.question.difficulty ?? '') -
            DIFFICULTY_ORDER.indexOf(right.question.difficulty ?? '')) *
          direction
        )
      default:
        return (
          (left.question[sort.key] ?? '').localeCompare(
            right.question[sort.key] ?? '',
          ) * direction
        )
    }
  })

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, ascending: !current.ascending }
        : { key, ascending: true },
    )
  }

  function openQuestion(id: string) {
    setOpenId(id)
    setReviewed((current) => {
      if (current[id]) return current
      const next = { ...current, [id]: true }
      onUpdateResult?.({ ...result, reviewedQuestions: next })
      return next
    })
  }

  const open = rows.find((entry) => entry.question.id === openId)
  const position = open
    ? rows.findIndex((entry) => entry.question.id === open.question.id)
    : -1

  function step(delta: number) {
    const next = rows[position + delta]
    if (next) openQuestion(next.question.id)
  }

  return (
    <div className="exam-review-page">
      <section className="exam-score-summary">
        <div className="exam-score-summary__head">
          <h2>Score Summary</h2>
          <span className="exam-score-summary__timing">{result.timingLabel}</span>
        </div>
        <div className="exam-score-summary__figures">
          <p>
            <strong className="exam-score-summary__score">{score}</strong>
            <span>{exam.subject}</span>
          </p>
          <p>
            <strong>
              {correct}/{scored.length}
            </strong>
            <span>Questions Correct</span>
          </p>
        </div>
        <p className="exam-score-summary__note">
          The scaled score is Clarity’s approximation of the CookSAT curve, not an
          official College Board conversion.
        </p>
      </section>

      <section className="exam-skills">
        <h2>Skill Breakdown</h2>
        <p className="exam-skills__eyebrow">{exam.subject}</p>
        {domains.map((domain) => {
          const isOpen = openDomains[domain.name] ?? true
          return (
            <div className="exam-skills__domain" key={domain.name}>
              <button
                className="exam-skills__row exam-skills__row--domain"
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpenDomains((current) => ({
                    ...current,
                    [domain.name]: !isOpen,
                  }))
                }
              >
                <ChevronDown
                  className={`exam-skills__chevron ${isOpen ? '' : 'exam-skills__chevron--closed'}`}
                  size={16}
                />
                <span className="exam-skills__name">{domain.name}</span>
                <span className="exam-skills__bar">
                  <span
                    className="exam-skills__fill"
                    style={{
                      width: `${domain.scored ? (domain.correct / domain.scored) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span
                  className={`exam-tally exam-tally--pill ${tallyClass(domain.correct, domain.scored)}`}
                >
                  {domain.correct}/{domain.scored}
                </span>
              </button>

              {isOpen ? (
                <div className="exam-skills__subskills">
                  {domain.subskills.map((subskill) => (
                    <div className="exam-skills__row" key={subskill.name}>
                      <span className="exam-skills__name">{subskill.name}</span>
                      <span className="exam-skills__bar">
                        <span
                          className="exam-skills__fill exam-skills__fill--muted"
                          style={{
                            width: `${subskill.scored ? (subskill.correct / subskill.scored) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <span
                        className={`exam-tally ${tallyClass(subskill.correct, subskill.scored)}`}
                      >
                        {subskill.correct}/{subskill.scored}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </section>

      <section className="exam-breakdown">
        <h2>Section Breakdown</h2>

        <div className="exam-breakdown__tabs" role="tablist" aria-label="Modules">
          {exam.modules.map((module) => (
            <button
              className={`exam-breakdown__tab ${module.id === moduleId ? 'exam-breakdown__tab--on' : ''}`}
              type="button"
              role="tab"
              aria-selected={module.id === moduleId}
              key={module.id}
              onClick={() => {
                setModuleId(module.id)
                setOpenId(null)
              }}
            >
              {exam.subject} {module.label}
            </button>
          ))}
        </div>

        {open ? (
          <article className="exam-review-detail">
            <header className="exam-review-detail__head">
              <div>
                <p className="exam-review-detail__eyebrow">
                  {open.module.label} · Question {open.question.number}
                  {open.flagged ? (
                    <span className="exam-review-detail__flag">
                      <Bookmark size={14} strokeWidth={1.8} fill="currentColor" /> Marked
                    </span>
                  ) : null}
                </p>
                <p className={`exam-review-verdict exam-review-verdict--${open.status}`}>
                  {STATUS_LABEL[open.status]}
                  {open.status === 'incorrect'
                    ? ` — you chose ${open.chosen}, the key is ${open.question.answer}`
                    : ''}
                  {open.status === 'omitted' && open.question.answer
                    ? ` — the key is ${open.question.answer}`
                    : ''}
                </p>
              </div>
              <div className="exam-review-detail__steps">
                <DictionaryToggle active={dictionary} onToggle={() => setDictionary((d) => !d)} />
                <button
                  className="exam-button exam-button--muted"
                  type="button"
                  onClick={() => step(-1)}
                  disabled={position <= 0}
                  aria-label="Previous question"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {position + 1} of {rows.length}
                </span>
                <button
                  className="exam-button exam-button--muted"
                  type="button"
                  onClick={() => step(1)}
                  disabled={position >= rows.length - 1}
                  aria-label="Next question"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  className="exam-button exam-button--ghost"
                  type="button"
                  onClick={() => setOpenId(null)}
                >
                  Back to the table
                </button>
              </div>
            </header>

            {open.question.figure ? <ExamFigure figure={open.question.figure} /> : null}
            {open.question.table ? <ExamTable table={open.question.table} /> : null}

            <ExamPassage
              paragraphs={open.question.passage}
              highlights={[]}
              annotate={false}
              onHighlightChange={() => {}}
              dictionary={dictionary}
              onLookup={(req) =>
                wordLookup.open({ ...req, source: { examId: open.module.id, questionId: open.question.id } })
              }
            />

            <p className="exam-stem">
              <LookupText
                text={open.question.stem}
                dictionary={dictionary}
                onLookup={(req) =>
                  wordLookup.open({ ...req, source: { examId: open.module.id, questionId: open.question.id } })
                }
              />
            </p>

            <ul className="exam-choices exam-choices--review">
              {open.question.choices.map((choice) => {
                const isKey = open.question.answer === choice.letter
                const isChosen = open.chosen === choice.letter
                return (
                  <li key={choice.letter}>
                    <div
                      className={[
                        'exam-choice',
                        isKey ? 'exam-choice--key' : '',
                        isChosen && !isKey ? 'exam-choice--miss' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className="exam-choice__letter">{choice.letter}</span>
                      <span className="exam-choice__text">
                        <LookupText
                          text={choice.text}
                          dictionary={dictionary}
                          onLookup={(req) =>
                            wordLookup.open({
                              ...req,
                              sentence: resolveChoiceContext({
                                choiceText: choice.text,
                                word: req.word,
                                requestSentence: req.sentence,
                                passage: open.question.passage,
                                prompt: open.question.stem,
                              }),
                              source: { examId: open.module.id, questionId: open.question.id },
                            })
                          }
                        />
                      </span>
                      {isKey || isChosen ? (
                        <span className="exam-choice__tag">
                          {isKey && isChosen
                            ? 'Your answer · correct'
                            : isKey
                              ? 'Correct answer'
                              : 'Your answer'}
                        </span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>

            <ExamExplanation
              question={open.question}
              chosen={open.chosen}
              dictionary={dictionary}
              onLookup={(req) =>
                wordLookup.open({ ...req, source: { examId: open.module.id, questionId: open.question.id } })
              }
            />
          </article>
        ) : (
          <>
            <p className="exam-breakdown__legend">
              <Bookmark size={14} strokeWidth={1.8} fill="currentColor" /> Flagged for
              Review
            </p>

            <div className="exam-breakdown__scroll">
              <table className="exam-breakdown__table">
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <th scope="col" key={column.key}>
                        <button type="button" onClick={() => toggleSort(column.key)}>
                          {column.label}
                          <ArrowUp
                            className={[
                              'exam-breakdown__sort',
                              sort.key === column.key ? 'exam-breakdown__sort--on' : '',
                              sort.key === column.key && !sort.ascending
                                ? 'exam-breakdown__sort--down'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            size={14}
                          />
                        </button>
                      </th>
                    ))}
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr
                      className={[
                        `exam-breakdown__row--${entry.status}`,
                        entry.flagged ? 'exam-breakdown__row--flagged' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={entry.question.id}
                    >
                      <th scope="row">{entry.question.number}</th>
                      <td>{entry.question.topic ?? '—'}</td>
                      <td>{entry.question.subtopic ?? '—'}</td>
                      <td>
                        {entry.question.difficulty
                          ? DIFFICULTY_LABEL[entry.question.difficulty]
                          : '—'}
                      </td>
                      <td>{entry.seconds ? formatClock(entry.seconds) : '—'}</td>
                      <td>
                        <button
                          className={`exam-breakdown__review ${reviewed[entry.question.id] ? 'exam-breakdown__review--done' : ''}`}
                          type="button"
                          onClick={() => openQuestion(entry.question.id)}
                        >
                          {reviewed[entry.question.id] ? (
                            <>
                              <Check size={14} /> Reviewed
                            </>
                          ) : (
                            'Review'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <WordLookupPopover
        state={wordLookup.state}
        onClose={wordLookup.close}
        onToggleSave={wordLookup.toggleSave}
        onRetry={wordLookup.retry}
      />
    </div>
  )
}
