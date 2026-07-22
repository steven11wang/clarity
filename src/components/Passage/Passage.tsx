import type { Question, TableData } from '../../types.ts'
import { segmentSentences } from './sentence.ts'
import './passage.css'

type PassageProps = {
  question: Question
}

function DataTable({ headers, rows }: TableData) {
  return (
    <table className="passage__table">
      <thead>
        <tr>
          {headers.map((header) => <th key={header} scope="col">{header}</th>)}
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

export function Passage({ question }: PassageProps) {
  const sentences = segmentSentences(question.passage)

  return (
    <section className="passage" aria-label="Passage">
      <p className="passage__text">
        {sentences.map((sentence, index) => (
          <span className="passage__sentence" key={`${index}-${sentence}`}>
            {index > 0 ? ' ' : ''}{sentence}
          </span>
        ))}
      </p>
      {question.table ? (
        <DataTable {...question.table} />
      ) : question.image ? (
        <figure className="passage__figure">
          <img src={'/' + question.image} alt={question.figure_description} />
        </figure>
      ) : null}
    </section>
  )
}
