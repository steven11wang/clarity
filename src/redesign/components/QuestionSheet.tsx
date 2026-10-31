// One SAT question laid out on the notebook: passage in reading serif, the
// blank drawn as a pencil box, and the choices as scantron bubbles. It never
// reveals anything on its own — the parent decides when the red pen comes out.

import { Fragment, type ReactNode } from 'react'

import { renderFormattedText } from '../../lib/formatText.tsx'
import type { Question } from '../../types.ts'
import { LETTERS } from '../game/questions.ts'
import { play } from '../sound.ts'
import { PenMark } from './Glyphs.tsx'

type Letter = (typeof LETTERS)[number]

/** Exam text carries <u>…</u> for "the underlined word"; anything else tag-shaped is dropped. */
export function Rich({ text }: { text: string }) {
  return <>{renderFormattedText(text.replace(/<(?!\/?u>)[^>]*>/g, ''))}</>
}

export function Blanks({ text }: { text: string }) {
  const parts = text.split(/_{3,}/)
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          <Rich text={part} />
          {index < parts.length - 1 && <span className="passage__blank" aria-label="blank" />}
        </Fragment>
      ))}
    </>
  )
}

export function Passage({ text, notes }: { text: string; notes?: string[] }) {
  // paired passages arrive as one string: "Text 1 … Text 2 …"
  const paired = /^Text 1\b/.test(text) && /\bText 2\b/.test(text)
  const blocks = paired
    ? text
        .split(/\b(?=Text 2\b)/)
        .map((block) => ({ label: block.slice(0, 6), body: block.slice(6).trim() }))
    : [{ label: '', body: text }]
  return (
    <div className="passage">
      {blocks.map((block) => (
        <p key={block.label || 'only'}>
          {block.label && <b className="passage__label">{block.label}</b>}
          <Blanks text={block.body} />
        </p>
      ))}
      {notes && notes.length > 0 && (
        <ul className="passage__notes">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Props = {
  question: Question
  picked: Letter | null
  onPick?: (letter: Letter) => void
  /** once graded, the red pen marks the picked choice */
  graded?: boolean
  /** and, when this is on too, ticks the right answer — off until the student has had their own go */
  revealAnswer?: boolean
  struck?: Letter[]
  onStrike?: (letter: Letter) => void
  disabledLetters?: Letter[]
  layout?: 'split' | 'stack'
  header?: ReactNode
}

export function QuestionSheet({ question, picked, onPick, graded = false, revealAnswer = true, struck = [], onStrike, disabledLetters = [], layout = 'split', header }: Props) {
  return (
    <div className={`qsheet qsheet--${layout}`}>
      <div className="qsheet__read">
        {header}
        <Passage text={question.passage} notes={question.notes} />
      </div>
      <div className="qsheet__answer">
        <p className="qsheet__prompt">
          <Rich text={question.prompt} />
        </p>
        <div className="choices" role="radiogroup" aria-label="Answer choices">
          {LETTERS.map((letter) => {
            const isPicked = picked === letter
            const isAnswer = question.answer === letter && (revealAnswer || isPicked)
            const isStruck = struck.includes(letter)
            const mark = graded && (isPicked || isAnswer)
            return (
              <div
                key={letter}
                className={[
                  'choice',
                  isPicked ? 'is-picked' : '',
                  isStruck ? 'is-struck' : '',
                  graded && isAnswer ? 'is-answer' : '',
                  graded && isPicked && !isAnswer ? 'is-wrong' : '',
                ].join(' ')}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={isPicked}
                  className="choice__hit"
                  disabled={graded || disabledLetters.includes(letter) || !onPick}
                  onClick={() => {
                    play('pick')
                    onPick?.(letter)
                  }}
                >
                  <span className="bubble">{letter}</span>
                  <span className="choice__text">
                    <Rich text={question.choices[letter]} />
                  </span>
                </button>
                {onStrike && !graded && (
                  <button
                    type="button"
                    className="choice__strike"
                    aria-label={isStruck ? `Bring back choice ${letter}` : `Cross out choice ${letter}`}
                    aria-pressed={isStruck}
                    onClick={() => onStrike(letter)}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M3 10 H17" />
                    </svg>
                  </button>
                )}
                {mark && (
                  <span className="choice__mark">
                    <PenMark kind={isAnswer ? 'check' : 'cross'} size={34} delay={isAnswer && !isPicked ? 420 : 0} />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
