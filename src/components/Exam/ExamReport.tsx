import { useMemo, useState } from 'react'
import { Lock } from 'lucide-react'

import { ExamFix, type FixEntry } from './ExamFix.tsx'
import { ExamReview } from './ExamReview.tsx'
import { formatClock, type PracticeExam } from './examData.ts'
import type { ExamResult } from './ExamRunner.tsx'
import { getExamRecords, saveExamRecord } from '../../storage/index.ts'

type ExamReportProps = {
  exam: PracticeExam
  result: ExamResult
  onRetake: () => void
  onChangeTiming: () => void
  onExit: () => void
  onUpdateResult?: (result: ExamResult) => void
}

type Tab = 'fix' | 'summary' | 'review'

export function ExamReport({
  exam,
  result,
  onRetake,
  onChangeTiming,
  onExit,
  onUpdateResult,
}: ExamReportProps) {
  // Every scored question the learner missed or left blank, in exam order.
  // These have to go back through the redo loop before the key is shown.
  const missed = useMemo<FixEntry[]>(
    () =>
      exam.modules.flatMap((module) =>
        module.questions
          .filter(
            (question) =>
              question.answer !== null &&
              result.answers[question.id] !== question.answer,
          )
          .map((question) => ({
            module,
            question,
            chosen: result.answers[question.id],
          })),
      ),
    [exam, result.answers],
  )

  const [fixed, setFixed] = useState<Record<string, boolean>>(() => result.fixedMisses ?? {})
  const fixesLeft = missed.filter((entry) => !fixed[entry.question.id]).length
  const locked = fixesLeft > 0

  const [tab, setTab] = useState<Tab>(locked ? 'fix' : 'summary')

  const handlePersistResult = (updatedResult: ExamResult) => {
    onUpdateResult?.(updatedResult)
    const records = getExamRecords()
    const match = records.find(
      (r) => r.examId === exam.id && r.finishedAt === result.finishedAt,
    )
    if (match) {
      saveExamRecord({ ...match, result: updatedResult })
    }
  }

  const handleUnlockAll = () => {
    const allFixed = Object.fromEntries(missed.map((entry) => [entry.question.id, true]))
    setFixed(allFixed)
    const updatedResult = { ...result, fixedMisses: allFixed }
    handlePersistResult(updatedResult)
    setTab('review')
  }

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
  const totalOvertime = Object.values(result.overtime ?? {}).reduce(
    (sum, seconds) => sum + seconds,
    0,
  )

  return (
    <div className="exam-root exam-root--report">
      <main className="exam-report">
        <header className="exam-report__head">
          <p className="exam-report__eyebrow">{exam.title} · {exam.subject}</p>
          <h1>{correct} of {scored} correct</h1>
          <p className="exam-report__lead">
            You answered {answeredCount} of {total} questions · {result.timingLabel}.
            {result.untimed
              ? ` You spent ${formatClock(totalOvertime)} on it.`
              : totalOvertime > 0
                ? ` You kept working ${formatClock(totalOvertime)} past the clock.`
                : ''}
            {exam.answerKeySource === 'derived'
              ? ' Scored against Clarity’s own key - it ships with this mock exam and is not an official College Board key.'
              : ''}
          </p>
        </header>

        <div className="exam-report__tabs" role="tablist" aria-label="Report views">
          {missed.length > 0 ? (
            <button
              className={`exam-report__tab ${tab === 'fix' ? 'exam-report__tab--on' : ''}`}
              type="button"
              role="tab"
              aria-selected={tab === 'fix'}
              onClick={() => setTab('fix')}
            >
              {locked ? `Fix your misses (${fixesLeft})` : 'Misses fixed'}
            </button>
          ) : null}
          <button
            className={`exam-report__tab ${tab === 'summary' ? 'exam-report__tab--on' : ''}`}
            type="button"
            role="tab"
            aria-selected={tab === 'summary'}
            onClick={() => setTab('summary')}
          >
            Score summary
          </button>
          <button
            className={`exam-report__tab ${tab === 'review' ? 'exam-report__tab--on' : ''}`}
            type="button"
            role="tab"
            aria-selected={tab === 'review'}
            disabled={locked}
            title={locked ? 'Fix your misses first' : undefined}
            onClick={() => setTab('review')}
          >
            {locked ? <Lock size={13} strokeWidth={2} /> : null}
            Review every question
          </button>
        </div>

        {tab === 'fix' ? (
          locked ? (
            <ExamFix
              entries={missed}
              fixed={fixed}
              onSkipAll={handleUnlockAll}
              onFixed={(questionId) => {
                const nextFixed = { ...fixed, [questionId]: true }
                setFixed(nextFixed)
                const updatedResult = { ...result, fixedMisses: nextFixed }
                handlePersistResult(updatedResult)
                const remainingLeft = missed.filter((entry) => !nextFixed[entry.question.id]).length
                if (remainingLeft === 0) setTab('review')
              }}
            />
          ) : (
            <section className="exam-fix exam-fix--cleared">
              <h2>Every miss is fixed.</h2>
              <p>
                You redid all {missed.length} of them and read the breakdown on
                each. The full review is unlocked.
              </p>
              <button
                className="exam-button exam-button--primary"
                type="button"
                onClick={() => setTab('review')}
              >
                Review every question
              </button>
            </section>
          )
        ) : null}

        {tab === 'summary' ? (
          <>
            <section className="exam-report__modules">
              {modules.map(({ module, correct: moduleCorrect, scored: moduleScored }) => {
                const over = result.overtime?.[module.id] ?? 0
                return (
                  <article key={module.id}>
                    <h2>{module.label}</h2>
                    <strong>{moduleCorrect}/{moduleScored}</strong>
                    <p>
                      {result.untimed
                        ? `${formatClock(over)} spent`
                        : over > 0
                        ? `${formatClock(over)} past the clock`
                        : result.timeLeft[module.id] !== undefined
                          ? `${formatClock(result.timeLeft[module.id])} left on the clock`
                          : 'Time expired'}
                    </p>
                  </article>
                )
              })}
            </section>

            {locked ? (
              <p className="exam-report__locked">
                <Lock size={14} strokeWidth={2} /> The answer key stays hidden until
                you have redone your {fixesLeft} remaining{' '}
                {fixesLeft === 1 ? 'miss' : 'misses'}.
              </p>
            ) : null}

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
                          <td>{locked ? '•' : question.answer ?? '—'}</td>
                          <td>{isCorrect ? 'Correct' : chosen ? 'Incorrect' : 'Omitted'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </>
        ) : null}

        {tab === 'review' ? (
          <ExamReview
            exam={exam}
            result={result}
            onUpdateResult={handlePersistResult}
          />
        ) : null}

        <div className="exam-report__actions">
          {tab === 'summary' ? (
            <button
              className="exam-button exam-button--primary"
              type="button"
              onClick={() => setTab(locked ? 'fix' : 'review')}
            >
              {locked ? `Fix your ${fixesLeft} ${fixesLeft === 1 ? 'miss' : 'misses'}` : 'Review every question'}
            </button>
          ) : null}
          <button className="exam-button exam-button--ghost" type="button" onClick={onRetake}>
            Retake with the same clock
          </button>
          <button className="exam-button exam-button--ghost" type="button" onClick={onChangeTiming}>
            Retake with a different clock
          </button>
          <button className="exam-button exam-button--ghost" type="button" onClick={onExit}>
            Back to practice exams
          </button>
        </div>
      </main>
    </div>
  )
}
