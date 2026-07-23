import type { Question, TableData } from '../../types.ts'
import { segmentSentences } from './sentence.ts'
import './passage.css'

type PassageProps = {
  question: Question
  // Underline mode (Step 3.5a): sentences become tappable evidence selectors.
  selectable?: boolean
  selected?: number[]
  onToggle?: (index: number) => void
  // Sentences the official reasoning quotes — shown as reinforcement only after
  // the student has committed their own evidence.
  referenced?: number[]
}

function DataTable({ headers, rows }: TableData) {
  return (
    <table className="passage__table">
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Passage({
  question,
  selectable = false,
  selected = [],
  onToggle,
  referenced = [],
}: PassageProps) {
  const sentences = segmentSentences(question.passage)
  const selectedSet = new Set(selected)
  const referencedSet = new Set(referenced)

  return (
    <section className="passage" aria-label="Passage">
      <p className={`passage__text ${selectable ? 'passage__text--selectable' : ''}`}>
        {sentences.map((sentence, index) => {
          const classes = [
            'passage__sentence',
            selectedSet.has(index) ? 'passage__sentence--selected' : '',
            referencedSet.has(index) ? 'passage__sentence--referenced' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const lead = index > 0 ? ' ' : ''

          if (selectable) {
            return (
              <span key={`${index}-${sentence}`}>
                {lead}
                <button
                  type="button"
                  className={classes}
                  aria-pressed={selectedSet.has(index)}
                  onClick={() => onToggle?.(index)}
                >
                  {sentence}
                </button>
              </span>
            )
          }

          return (
            <span className={classes} key={`${index}-${sentence}`}>
              {lead}{sentence}
            </span>
          )
        })}
      </p>
      {question.table ? (
        <DataTable {...question.table} />
      ) : question.image ? (
        <figure className="passage__figure">
          <img
            src={question.image.startsWith('/') ? question.image : `/${question.image}`}
            alt={question.figure_description}
          />
        </figure>
      ) : null}
    </section>
  )
}
