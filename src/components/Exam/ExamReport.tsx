import { formatClock, type PracticeExam } from './examData.ts'
import type { ExamResult } from './ExamRunner.tsx'

type ExamReportProps = {
  exam: PracticeExam
  result: ExamResult
  onRetake: () => void
  onExit: () => void
}

export function ExamReport({ exam, result, onRetake, onExit }: ExamReportProps) {
  const modules = exam.modules.map((module) => {
    const scored = module.questions.filter((question) => question.answer !== null)
    const correct = scored.filter(
      (question) => result.answers[question.id] === question.answer,
    ).length
    return { module, scored: scored.length, correct }
  })
  const correct = modules.reduce((sum, entry) => sum + entry.correct, 0)
  const scored = modules.reduce((sum, entry) => sum + entry.scored, 0)
  const answeredCount = exam.modules.reduce(
    (sum, module) =>
      sum + module.questions.filter((question) => result.answers[question.id]).length,
    0,
  )
  const total = exam.modules.reduce((sum, module) => sum + module.questions.length, 0)

  return (
    <div className="exam-root exam-root--report">
      <main className="exam-report">
        <header className="exam-report__head">
          <p className="exam-report__eyebrow">{exam.title} · {exam.subject}</p>
          <h1>{correct} of {scored} correct</h1>
          <p className="exam-report__lead">
            You answered {answeredCount} of {total} questions.
            {exam.answerKeySource === 'derived'
              ? ' Scored against Clarity’s own key - it ships with this mock exam and is not an official College Board key.'
              : ''}
          </p>
        </header>

        <section className="exam-report__modules">
          {modules.map(({ module, correct: moduleCorrect, scored: moduleScored }) => (
            <article key={module.id}>
              <h2>{module.label}</h2>
              <strong>{moduleCorrect}/{moduleScored}</strong>
              <p>
                {result.timeLeft[module.id] !== undefined
                  ? `${formatClock(result.timeLeft[module.id])} left on the clock`
                  : 'Time expired'}
              </p>
            </article>
          ))}
        </section>

        {exam.modules.map((module) => (
          <section className="exam-report__table" key={module.id}>
            <h2>{module.label}</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Your answer</th>
                  <th scope="col">Key</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {module.questions.map((question) => {
                  const chosen = result.answers[question.id]
                  const isCorrect = chosen !== undefined && chosen === question.answer
                  return (
                    <tr
                      className={isCorrect ? 'is-correct' : chosen ? 'is-wrong' : 'is-blank'}
                      key={question.id}
                    >
                      <th scope="row">
                        {question.number}
                        {result.flagged.includes(question.id) ? (
                          <span className="exam-report__flag" title="Marked for review">⚑</span>
                        ) : null}
                      </th>
                      <td>{chosen ?? '—'}</td>
                      <td>{question.answer ?? '—'}</td>
                      <td>{isCorrect ? 'Correct' : chosen ? 'Incorrect' : 'Omitted'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        ))}

        <div className="exam-report__actions">
          <button className="exam-button exam-button--primary" type="button" onClick={onRetake}>
            Retake the exam
          </button>
          <button className="exam-button exam-button--ghost" type="button" onClick={onExit}>
            Back to practice exams
          </button>
        </div>
      </main>
    </div>
  )
}
