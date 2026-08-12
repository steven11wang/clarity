import { LookupText, type TextLookupRequest } from '../../dictionary/LookupText.tsx'
import type { ExamQuestion } from './examData.ts'

/**
 * The written breakdown for one question: the reasoning that gets you to the
 * key, then a line per choice saying why it works or where it fails. Shared by
 * the fix pass and the review table so both read identically.
 */
export function ExamExplanation({
  question,
  chosen,
  dictionary = false,
  onLookup,
}: {
  question: ExamQuestion
  chosen?: string | undefined
  dictionary?: boolean
  onLookup?: (request: TextLookupRequest) => void
}) {
  const explanation = question.explanation

  // Every exam in the programme ships a bank today, but a question that slips
  // through without one should say so rather than leave the panel blank under a
  // heading promising a breakdown.
  if (!explanation) {
    return (
      <section className="exam-explain exam-explain--bare">
        <h3 className="exam-explain__title">
          {question.answer ? `${question.answer} is the answer` : 'No key for this one'}
        </h3>
        <p className="exam-explain__summary">
          This exam’s source publishes no written explanation. Work out why the key
          beats the choice you crossed to — that reasoning is the point of the review.
        </p>
      </section>
    )
  }

  return (
    <section className="exam-explain">
      <h3 className="exam-explain__title">
        {question.answer ? `Why ${question.answer} is the answer` : 'The reasoning'}
      </h3>
      {explanation.summary.split(/\n{2,}/).map((paragraph, index) => (
        <p className="exam-explain__summary" key={index}>
          <LookupText text={paragraph} dictionary={dictionary} onLookup={onLookup} />
        </p>
      ))}
      <ul className="exam-explain__list">
        {question.choices.map((choice) => {
          const isKey = question.answer === choice.letter
          const isChosen = chosen === choice.letter
          const text = explanation.choices[choice.letter]
          if (!text) return null
          return (
            <li
              className={[
                'exam-explain__item',
                isKey ? 'exam-explain__item--key' : '',
                isChosen && !isKey ? 'exam-explain__item--miss' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={choice.letter}
            >
              <span className="exam-explain__letter">{choice.letter}</span>
              <div>
                <p className="exam-explain__choice">
                  <LookupText text={choice.text} dictionary={dictionary} onLookup={onLookup} />
                </p>
                <p className="exam-explain__why">
                  <LookupText text={text} dictionary={dictionary} onLookup={onLookup} />
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
