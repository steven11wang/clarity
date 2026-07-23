import type { Question } from '../../types.ts'

type QuestionInteractionProps = {
  question: Question
  selectedChoice: string | null
  checked: boolean
  onSelect: (choice: string) => void
  onCheck: () => void
  onNext: () => void
  onPrevious: () => void
}

export function QuestionInteraction({ question, selectedChoice, checked, onSelect, onCheck, onNext, onPrevious }: QuestionInteractionProps) {
  return (
    <section className="question-panel" aria-labelledby="question-prompt">
      <h1 id="question-prompt">{question.prompt}</h1>
      <div className="choice-list" role="radiogroup" aria-label="Answer choices">
        {Object.entries(question.choices).map(([letter, choice]) => {
          const isSelected = selectedChoice === letter
          const isCorrect = checked && letter === question.answer
          const isIncorrect = checked && isSelected && letter !== question.answer
          const classes = ['choice', isSelected ? 'choice--selected' : '', isCorrect ? 'choice--correct' : '', isIncorrect ? 'choice--incorrect' : ''].filter(Boolean).join(' ')
          return <button className={classes} key={letter} type="button" role="radio" aria-checked={isSelected} disabled={checked} onClick={() => onSelect(letter)}><span className="choice-letter">{letter}</span><span>{choice}</span></button>
        })}
      </div>
      {checked && <aside className={`result ${selectedChoice === question.answer ? 'result--correct' : 'result--incorrect'}`} aria-live="polite"><strong>{selectedChoice === question.answer ? 'That’s right.' : `The best answer is ${question.answer}.`}</strong><p>{question.rationale}</p></aside>}
      <div className="question-actions"><button className="button button--quiet" type="button" onClick={onPrevious}>Previous</button>{checked ? <button className="button" type="button" onClick={onNext}>Next question</button> : <button className="button" type="button" disabled={!selectedChoice} onClick={onCheck}>Check answer</button>}</div>
    </section>
  )
}
