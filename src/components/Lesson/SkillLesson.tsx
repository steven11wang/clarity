import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'

import {
  buildLessonTabs,
  type BriefItem,
  type BriefSection,
  type LessonBrief,
  type LessonTabs,
} from '../../content/lessonBrief.ts'
import {
  loadSkillLesson,
  type LessonExample,
  type LessonTable,
  type SkillLesson as SkillLessonContent,
  type SkillLessonSummary,
} from '../../content/skillLessons.ts'
import './lesson.css'

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const
type ChoiceLetter = (typeof CHOICE_LETTERS)[number]

type TabId = 'lesson' | 'example' | 'tips' | 'practice'

const TABS: { id: TabId; label: string }[] = [
  { id: 'lesson', label: 'Lesson' },
  { id: 'example', label: 'Worked example' },
  { id: 'tips', label: 'Tips' },
  { id: 'practice', label: 'Practice' },
]

type SkillLessonProps = {
  /** Always available synchronously; the article pages stream in behind it. */
  summary: SkillLessonSummary
  /** Copy for the final button, e.g. "Start the mini quiz". */
  finishLabel: string
  /** Called when the student finishes (or skips) the lesson. */
  onFinish: () => void
  /** Called when the student backs out entirely. */
  onExit: () => void
  /** Shown instead of "First time on this skill" when re-reading. */
  eyebrow?: string
  /** Render inside the persistent console instead of mounting another shell. */
  embedded?: boolean
}

export function SkillLesson({
  summary,
  finishLabel,
  onFinish,
  onExit,
  eyebrow,
  embedded = false,
}: SkillLessonProps) {
  const [lesson, setLesson] = useState<SkillLessonContent | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [tab, setTab] = useState<TabId>('lesson')
  const topRef = useRef<HTMLDivElement>(null)

  // Start fetching the article the moment the lesson opens.
  useEffect(() => {
    let live = true
    setLesson(null)
    setLoadFailed(false)
    setTab('lesson')
    loadSkillLesson(summary.skill)
      .then((loaded) => {
        if (!live) return
        if (loaded) setLesson(loaded)
        else setLoadFailed(true)
      })
      .catch(() => {
        if (live) setLoadFailed(true)
      })
    return () => {
      live = false
    }
  }, [summary.skill])

  const tabs: LessonTabs | null = useMemo(
    () => (lesson ? buildLessonTabs(lesson) : null),
    [lesson],
  )

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [tab])

  const position = TABS.findIndex((entry) => entry.id === tab)
  const previous = position > 0 ? TABS[position - 1] : null
  // Practice is the last tab, so the forward button stops there.
  const next = position >= 0 && position < TABS.length - 1 ? TABS[position + 1] : null

  const Shell = embedded ? 'section' : 'main'

  return (
    <Shell
      className={
        embedded
          ? 'lesson-reader lesson-reader--embedded'
          : 'adaptive-shell lesson-shell lesson-reader'
      }
    >
      <div ref={topRef} aria-hidden="true" />

      {embedded ? (
        <button
          className="lesson-reader__back"
          type="button"
          onClick={onExit}
          data-ui-sound="true"
          data-ui-sound-hover="hover"
          data-ui-sound-click="back"
        >
          <ChevronLeft aria-hidden="true" strokeWidth={1.7} />
          All lessons
        </button>
      ) : (
        <header className="adaptive-header">
          <button
            className="wordmark wordmark--button"
            type="button"
            onClick={onExit}
            aria-label="Leave this lesson"
          >
            clarity<span>.</span>
          </button>
          <div className="lesson-header__actions">
            <button className="link-button" type="button" onClick={onExit}>
              ← All skills
            </button>
          </div>
        </header>
      )}

      <div className="lesson-title">
        {(eyebrow ?? summary.unit) && (
          <p className="eyebrow">{eyebrow ?? summary.unit}</p>
        )}
        <h1>{summary.skill}</h1>
        <p className="lesson-title__summary">{summary.nutshell}</p>
      </div>

      <nav className="lesson-tabs" role="tablist" aria-label="Lesson sections">
        {TABS.map((entry, index) => (
          <button
            className={`lesson-tab ${entry.id === tab ? 'is-active' : ''}`}
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === tab}
            onClick={() => setTab(entry.id)}
          >
            <span className="lesson-tab__index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="lesson-tab__label">{entry.label}</span>
          </button>
        ))}
      </nav>

      <div className="lesson-panel-wrap" role="tabpanel">
        {loadFailed ? (
          <LessonUnavailable onFinish={onFinish} finishLabel={finishLabel} />
        ) : tabs === null ? (
          <article className="lesson-page" aria-busy="true">
            <p className="eyebrow">Loading</p>
            <h2 className="lesson-page__head">Getting the lesson…</h2>
          </article>
        ) : tab === 'lesson' ? (
          <LessonPanel tabs={tabs} />
        ) : tab === 'example' ? (
          <ExamplePanel tabs={tabs} oneMove={summary.oneMove} />
        ) : tab === 'tips' ? (
          <TipsPanel tabs={tabs} />
        ) : (
          <PracticePanel
            skill={summary.skill}
            brief={tabs.briefs[0]?.brief ?? null}
            finishLabel={finishLabel}
            onFinish={onFinish}
          />
        )}
      </div>

      <footer className="lesson-actions">
        {previous ? (
          <button className="link-button" type="button" onClick={() => setTab(previous.id)}>
            ← {previous.label}
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button className="button" type="button" onClick={() => setTab(next.id)}>
            Next: {next.label} →
          </button>
        ) : (
          <span />
        )}
      </footer>
    </Shell>
  )
}

// --- 01 Lesson --------------------------------------------------------------

function LessonPanel({ tabs }: { tabs: LessonTabs }) {
  return (
    <>
      {tabs.briefs.map((block, index) => (
        <BriefArticle
          key={block.partTitle ?? `brief-${index}`}
          partTitle={block.partTitle}
          partSubtitle={block.partSubtitle}
          brief={block.brief}
        />
      ))}
    </>
  )
}

function BriefArticle({
  partTitle,
  partSubtitle,
  brief,
}: {
  partTitle: string | null
  partSubtitle: string | null
  brief: LessonBrief
}) {
  const longVersion = [
    ...brief.asks.extra,
    ...brief.think.flatMap((section) => section.extra),
    ...brief.methodExtra,
    ...brief.method.flatMap((step) => step.extra),
  ]

  return (
    <article className="lesson-page">
      {partTitle && (
        <div className="lesson-part-banner">
          <p className="eyebrow">{partTitle}</p>
          {partSubtitle && <p>{partSubtitle}</p>}
        </div>
      )}

      {brief.asks.keep.length > 0 && (
        <section className="lesson-section">
          <p className="lesson-section__label">What these questions ask</p>
          <Items items={brief.asks.keep} />
        </section>
      )}

      {brief.think.length > 0 && (
        <section className="lesson-section">
          <p className="lesson-section__label">How to think about them</p>
          {brief.think.map((section, index) => (
            <div className="lesson-idea" key={section.heading ?? `idea-${index}`}>
              {section.heading && <h3>{section.heading}</h3>}
              <Items items={section.keep} />
            </div>
          ))}
        </section>
      )}

      {brief.method.length > 0 && (
        <section className="lesson-section">
          <p className="lesson-section__label">
            The {numberWord(brief.method.length)}-step method
          </p>
          <ol className="lesson-steps">
            {brief.method.map((step) => (
              <li className="lesson-step" key={step.n}>
                <span className="lesson-step__n" aria-hidden="true">
                  {String(step.n).padStart(2, '0')}
                </span>
                <div className="lesson-step__body">
                  <h3>{step.title}</h3>
                  <Items items={step.body} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {longVersion.length > 0 && (
        <details className="lesson-more">
          <summary>The long version — worked-through detail on each point</summary>
          {longVersion.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </details>
      )}
    </article>
  )
}

function Items({ items }: { items: BriefItem[] }) {
  return (
    <>
      {items.map((item, index) =>
        item.kind === 'p' ? (
          <p key={index}>{item.text}</p>
        ) : (
          <div key={index}>
            {item.intro && <p>{item.intro}</p>}
            <ul className="lesson-list">
              {item.items.map((entry, entryIndex) => (
                <li key={entryIndex}>{entry}</li>
              ))}
            </ul>
          </div>
        ),
      )}
    </>
  )
}

function numberWord(count: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][count] ?? String(count)
}

// --- 02 Worked example ------------------------------------------------------

function ExamplePanel({ tabs, oneMove }: { tabs: LessonTabs; oneMove: string }) {
  // One example, deliberately. Two or three in a row turns a lesson into a
  // problem set; the practice quiz on the next tab is where volume belongs.
  const entry = tabs.examples[0]

  if (!entry) {
    return (
      <article className="lesson-page">
        <p className="eyebrow">Worked example</p>
        <h2 className="lesson-page__head">No worked example for this skill yet.</h2>
        <p>Head to Practice — the method on the Lesson tab is enough to start.</p>
      </article>
    )
  }

  return (
    <article className="lesson-page">
      <p className="eyebrow">
        Worked example{entry.partTitle ? ` · ${entry.partTitle}` : ''}
      </p>
      <p className="lesson-page__intro">
        Work this one yourself before revealing the explanation. Cross out choices as
        you rule them out — the same move you will make on the real test.
      </p>

      <WorkedExample key={entry.key} example={entry.example} oneMove={oneMove} />
    </article>
  )
}

/**
 * The example is gated behind writing a test phrase. Committing to a prediction
 * before seeing the choices is the single habit these lessons are trying to
 * build, so the choices stay blurred until the student writes one or skips.
 */
function WorkedExample({ example, oneMove }: { example: LessonExample; oneMove: string }) {
  const [phrase, setPhrase] = useState('')
  const [gateOpen, setGateOpen] = useState(false)
  const [chosen, setChosen] = useState<ChoiceLetter | null>(null)
  const [struck, setStruck] = useState<ChoiceLetter[]>([])
  const [revealed, setRevealed] = useState(false)
  const correct = chosen === example.answer
  const hint = testPhraseHint(oneMove)

  function toggleStrike(letter: ChoiceLetter) {
    setStruck((current) =>
      current.includes(letter)
        ? current.filter((entry) => entry !== letter)
        : [...current, letter],
    )
    setChosen((current) => (current === letter ? null : current))
  }

  return (
    <div className="lesson-worked">
      <section className="lesson-worked__passage">
        {example.figure && <Figure description={example.figure} />}
        {example.table && <DataTable rows={example.table} />}
        {example.passage.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        {example.notes && example.notes.length > 0 && (
          <ul className="lesson-list">
            {example.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="lesson-worked__question">
        <p className="lesson-section__label">Question</p>
        <p className="lesson-example__prompt">{example.prompt}</p>

        {!gateOpen && (
          <div className="lesson-gate">
            <p className="lesson-gate__title">Write your test phrase</p>
            <p className="lesson-gate__hint">
              Compress the claim into a handful of words before you look at the choices.
            </p>
            <input
              className="lesson-gate__input"
              type="text"
              value={phrase}
              placeholder={hint}
              aria-label="Your test phrase"
              onChange={(event) => setPhrase(event.target.value)}
            />
            <div className="lesson-gate__actions">
              <button className="button" type="button" onClick={() => setGateOpen(true)}>
                Show the choices
              </button>
              <button
                className="link-button"
                type="button"
                onClick={() => setGateOpen(true)}
              >
                Skip this step
              </button>
            </div>
          </div>
        )}

        {gateOpen && phrase.trim().length > 0 && (
          <p className="lesson-gate__echo">
            Your test phrase: <strong>{phrase.trim()}</strong>
          </p>
        )}

        <div
          className={`lesson-choices ${gateOpen ? '' : 'is-locked'}`}
          role="group"
          aria-label="Answer choices"
          aria-hidden={!gateOpen}
        >
          {CHOICE_LETTERS.map((letter) => {
            const text = example.choices[letter]
            if (!text) return null
            const isChosen = chosen === letter
            const isAnswer = example.answer === letter
            const isStruck = struck.includes(letter)
            return (
              <div className="lesson-choice-row" key={letter}>
                <button
                  className={[
                    'lesson-choice',
                    isChosen ? 'is-chosen' : '',
                    isStruck ? 'is-struck' : '',
                    revealed && isAnswer ? 'is-correct' : '',
                    revealed && isChosen && !isAnswer ? 'is-wrong' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  type="button"
                  aria-pressed={isChosen}
                  disabled={revealed || !gateOpen}
                  onClick={() => setChosen(letter)}
                >
                  <span className="lesson-choice__letter" aria-hidden="true">
                    {letter}
                  </span>
                  <span>{text}</span>
                </button>
                <button
                  className={`lesson-strike ${isStruck ? 'is-on' : ''}`}
                  type="button"
                  disabled={revealed || !gateOpen}
                  aria-label={`${isStruck ? 'Restore' : 'Cross out'} choice ${letter}`}
                  onClick={() => toggleStrike(letter)}
                >
                  {letter}
                </button>
              </div>
            )
          })}
        </div>

        {gateOpen &&
          (!revealed ? (
            <div className="lesson-example__actions">
              <button
                className="button"
                type="button"
                disabled={chosen === null}
                onClick={() => setRevealed(true)}
              >
                {chosen === null ? 'Pick an answer' : 'Check my answer'}
              </button>
              <button
                className="link-button"
                type="button"
                onClick={() => setRevealed(true)}
              >
                Show the explanation
              </button>
            </div>
          ) : (
            <div
              className={`lesson-explanation ${
                chosen === null
                  ? 'lesson-explanation--neutral'
                  : correct
                    ? 'lesson-explanation--right'
                    : 'lesson-explanation--wrong'
              }`}
            >
              <p className="lesson-explanation__verdict">
                {chosen === null
                  ? `The answer is ${example.answer}.`
                  : correct
                    ? `Correct — ${example.answer}.`
                    : `Not quite. You chose ${chosen}; the answer is ${example.answer}.`}
              </p>
              {example.explanation.map((block, index) =>
                block.type === 'li' ? (
                  <ul className="lesson-list" key={index}>
                    <li>{block.text}</li>
                  </ul>
                ) : (
                  <p key={index}>{block.text}</p>
                ),
              )}
              <button
                className="link-button"
                type="button"
                onClick={() => {
                  setRevealed(false)
                  setChosen(null)
                  setStruck([])
                }}
              >
                Reset this example
              </button>
            </div>
          ))}
      </section>
    </div>
  )
}

/** The one-move line usually carries a quoted specimen phrase; borrow it. */
function testPhraseHint(oneMove: string): string {
  const quoted = /[“"']([^”"']{4,48})[”"']/.exec(oneMove)
  return quoted ? `e.g. ${quoted[1]}` : 'A handful of words, in your own wording'
}

// --- 03 Tips ----------------------------------------------------------------

function TipsPanel({ tabs }: { tabs: LessonTabs }) {
  const cards = tabs.tips.filter((section) => section.heading !== null || section.keep.length > 0)

  return (
    <article className="lesson-page">
      <p className="eyebrow">Top tips</p>
      <p className="lesson-page__intro">
        Secondary strategies. Expect one or two to earn their keep on any given
        question — the method on the Lesson tab is the main approach.
      </p>

      {cards.length > 0 ? (
        <div className="lesson-tip-grid">
          {cards.map((section, index) => (
            <TipCard
              key={section.heading ?? `tip-${index}`}
              number={index + 1}
              section={section}
            />
          ))}
        </div>
      ) : (
        <p>No skill-specific tips for this one. The general tips below still apply.</p>
      )}

      {tabs.generalTips.length > 0 && (
        <details className="lesson-more">
          <summary>Tips that work on any Reading &amp; Writing question</summary>
          {tabs.generalTips.map((section, index) => (
            <div key={index}>
              {section.heading && <h3>{section.heading}</h3>}
              <Items items={section.keep} />
              {section.extra.map((text, extraIndex) => (
                <p key={extraIndex}>{text}</p>
              ))}
            </div>
          ))}
        </details>
      )}

      <p className="lesson-tip-outro">
        Can you use any of the tips above on the worked example? Try it yourself
        first, then click “Show the explanation” to see how we do it.
      </p>
    </article>
  )
}

function TipCard({ number, section }: { number: number; section: BriefSection }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="lesson-tip">
      <span className="lesson-tip__n" aria-hidden="true">
        {String(number).padStart(2, '0')}
      </span>
      {section.heading && <h3>{section.heading}</h3>}
      <Items items={section.keep} />
      {section.extra.length > 0 && (
        <>
          {open && section.extra.map((text, index) => <p key={index}>{text}</p>)}
          <button className="link-button" type="button" onClick={() => setOpen(!open)}>
            {open ? 'Less' : 'More on this'}
          </button>
        </>
      )}
    </section>
  )
}

// --- 04 Practice ------------------------------------------------------------

function PracticePanel({
  skill,
  brief,
  finishLabel,
  onFinish,
}: {
  skill: string
  brief: LessonBrief | null
  finishLabel: string
  onFinish: () => void
}) {
  return (
    <article className="lesson-page lesson-practice">
      <p className="eyebrow">You’re ready</p>
      <h2 className="lesson-page__head">Practice: {skill}</h2>
      <p className="lesson-page__intro">
        Take the method with you. Before you look at the choices on any question, run
        the steps:
      </p>

      {brief && brief.method.length > 0 && (
        <ol className="lesson-recap">
          {brief.method.map((step) => (
            <li key={step.n}>
              <span aria-hidden="true">{String(step.n).padStart(2, '0')}</span>
              {step.title}
            </li>
          ))}
        </ol>
      )}

      <div className="lesson-practice__actions">
        <button className="button" type="button" onClick={onFinish}>
          {finishLabel} →
        </button>
      </div>
    </article>
  )
}

function LessonUnavailable({
  finishLabel,
  onFinish,
}: {
  finishLabel: string
  onFinish: () => void
}) {
  return (
    <article className="lesson-page">
      <p className="eyebrow">Lesson unavailable</p>
      <h2 className="lesson-page__head">We couldn’t load this lesson.</h2>
      <p>
        Check your connection and try again. Your practice questions still work.
      </p>
      <button className="button" type="button" onClick={onFinish}>
        {finishLabel} →
      </button>
    </article>
  )
}

// --- Shared bits ------------------------------------------------------------

function Figure({ description }: { description: string }) {
  return (
    <figure className="lesson-figure">
      <span className="lesson-figure__tag" aria-hidden="true">
        Figure
      </span>
      <figcaption>{description}</figcaption>
    </figure>
  )
}

function DataTable({ rows }: { rows: LessonTable }) {
  const [head, ...body] = rows
  return (
    <div className="lesson-table-wrap">
      <table className="lesson-table">
        <thead>
          <tr>
            {head.map((cell, index) => (
              <th key={`${cell}-${index}`} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
