import { assetPath } from '../../lib/assetPath.ts'
import type { Question, TableData } from '../../types.ts'
import { segmentSentences } from './sentence.ts'
import './passage.css'

type PassageProps = {
  question: Question
  // Underline mode (Step 3.5a): sentences become tappable evidence selectors.
  selectable?: boolean
  selected?: number[]
  onToggle?: (index: number) => void
  // Sentences the official reasoning quotes - shown as reinforcement only after
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

// Cross-Text Connection passages are stored as one string with inline "Text 1"
// / "Text 2" markers (e.g. "Text 1 Although food writing is ... Text 2 With
// her ..."). Split on those markers so each text renders as its own labeled
// block instead of running together as undifferentiated prose.
const TEXT_LABEL = /^(Text\s+\d+)\s+(.*)$/s

type Block = { label: string | null; sentences: { index: number; text: string }[] }

function splitIntoBlocks(sentences: string[]): Block[] {
  const blocks: Block[] = [{ label: null, sentences: [] }]

  sentences.forEach((sentence, index) => {
    const match = sentence.match(TEXT_LABEL)
    if (match) {
      blocks.push({ label: match[1], sentences: [{ index, text: match[2] }] })
    } else {
      blocks[blocks.length - 1].sentences.push({ index, text: sentence })
    }
  })

  return blocks.filter((block) => block.sentences.length > 0)
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
  const blocks = splitIntoBlocks(sentences)

  return (
    <section className="passage" aria-label="Passage">
      {blocks.map((block, blockIndex) => (
        <div key={blockIndex}>
          {block.label && <h3 className="passage__label">{block.label}</h3>}
          <p className={`passage__text ${selectable ? 'passage__text--selectable' : ''}`}>
            {block.sentences.map(({ index, text }, position) => {
              const classes = [
                'passage__sentence',
                selectedSet.has(index) ? 'passage__sentence--selected' : '',
                referencedSet.has(index) ? 'passage__sentence--referenced' : '',
              ]
                .filter(Boolean)
                .join(' ')
              const lead = position > 0 ? ' ' : ''

              if (selectable) {
                return (
                  <span key={`${index}-${text}`}>
                    {lead}
                    <button
                      type="button"
                      className={classes}
                      aria-pressed={selectedSet.has(index)}
                      onClick={() => onToggle?.(index)}
                    >
                      {text}
                    </button>
                  </span>
                )
              }

              return (
                <span className={classes} key={`${index}-${text}`}>
                  {lead}{text}
                </span>
              )
            })}
          </p>
        </div>
      ))}
      {question.notes && question.notes.length > 0 && (
        <ul className="passage__notes">
          {question.notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      )}
      {question.table ? (
        <DataTable {...question.table} />
      ) : question.image ? (
        <figure className="passage__figure">
          <img
            src={assetPath(question.image)}
            alt={question.figure_description}
          />
        </figure>
      ) : null}
    </section>
  )
}
