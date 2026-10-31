// The exam hall: five full Reading and Writing tests as booklets on the desk.
// Pick a pace, sit both modules, and the report card files every miss into
// the Mistake Notebook. Test day itself is calm — see ExamRunner.

import { useState } from 'react'
import { ArrowRight, Clock, Play, RotateCcw } from 'lucide-react'

import { EXAM_CATALOG, EXAM_INKS, PACES, bestResult, examTitle, saveSitting, useExams, type ExamPace } from '../game/exams.ts'
import { useGame } from '../game/store.ts'
import { go } from '../router.ts'
import { GameShell } from '../components/GameShell.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'
import { play } from '../sound.ts'

export function ExamHall() {
  const game = useGame()
  const exams = useExams()
  const [pace, setPace] = useState<ExamPace>('test-day')
  const best = bestResult()
  const target = Math.round(game.targetScore / 2 / 10) * 10
  const recent = exams.results.slice(-6)
  const sitting = exams.sitting

  const start = (examId: string) => {
    play('commit')
    saveSitting({ examId, pace, module: 0, index: 0, answers: {}, marked: [], secondsLeft: null, startedAt: Date.now() })
    go(`/exam/${examId}`)
  }

  return (
    <GameShell active="exam">
      <div className="hall-exams">
        <header className="exams__head">
          <div>
            <h1 className="display">Practice exams</h1>
            <p>Five full Reading &amp; Writing tests. Two modules of 27 questions, scored on a 200–800 estimate.</p>
          </div>
          <div className="exams__score sheet" aria-label="Your scores">
            <span className="exams__score-label">Best estimate</span>
            <span className="display num">{best ? best.scaled : '—'}</span>
            <span className="exams__target">
              Aiming for {game.targetScore}? That’s about <b className="num">{target}</b> on this half.
            </span>
          </div>
        </header>

        {sitting && (
          <section className="resume sheet" aria-label="Exam in progress">
            <Tangyuan size={60} mood="think" />
            <div>
              <h2 className="title">{examTitle(sitting.examId)} is still open</h2>
              <p>
                Module {sitting.module + 1} of 2 · {Object.keys(sitting.answers).length} answered · saved where you left off
              </p>
            </div>
            <button type="button" className="btn btn--lg" onClick={() => go(`/exam/${sitting.examId}`)}>
              <Play /> Resume
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                if (window.confirm('Throw this attempt away? Your answers so far won’t be scored.')) saveSitting(null)
              }}
            >
              <RotateCcw /> Start over
            </button>
          </section>
        )}

        <div className="pace" role="radiogroup" aria-label="Pace">
          {PACES.map((option) => (
            <button key={option.id} type="button" role="radio" aria-checked={pace === option.id} className="pace__option" onClick={() => setPace(option.id)}>
              <b>{option.label}</b>
              <span>{option.note}</span>
            </button>
          ))}
        </div>

        <ol className="booklets">
          {EXAM_CATALOG.map((exam, index) => {
            const mine = bestResult(exam.id)
            const attempts = exams.results.filter((result) => result.examId === exam.id).length
            return (
              <li key={exam.id} className="booklet" style={{ ['--cover' as string]: EXAM_INKS[index % EXAM_INKS.length] }}>
                <div className="booklet__cover">
                  <span className="booklet__series">SAT · Reading and Writing</span>
                  <h2 className="booklet__title">{exam.title}</h2>
                  {index === 0 && <span className="booklet__badge">Start here</span>}
                  <span className="booklet__modules" aria-hidden="true">
                    {[1, 2].map((n) => (
                      <span key={n}>
                        <b>Module {n}</b>
                        <span className="booklet__bubbles">
                          {Array.from({ length: 9 }, (_, i) => (
                            <i key={i} />
                          ))}
                        </span>
                      </span>
                    ))}
                  </span>
                  {mine && <span className="stamp booklet__stamp num">{mine.scaled}</span>}
                </div>
                <div className="booklet__meta">
                  <span>
                    <Clock size={15} /> {exam.questions} questions · 2 modules
                  </span>
                  <span>{attempts === 0 ? 'Not sat yet' : `${attempts} attempt${attempts === 1 ? '' : 's'}`}</span>
                </div>
                <button type="button" className="btn btn--block" onClick={() => start(exam.id)} disabled={Boolean(sitting)}>
                  {mine ? 'Sit it again' : 'Start'} <ArrowRight />
                </button>
              </li>
            )
          })}
        </ol>

        {recent.length > 0 && (
          <section className="history sheet" aria-labelledby="history-title">
            <h2 className="title" id="history-title">
              Your last {recent.length === 1 ? 'sitting' : `${recent.length} sittings`}
            </h2>
            <div className="history__plot">
              <ol className="history__bars">
                {recent.map((result) => (
                  <li key={result.finishedAt} style={{ ['--h' as string]: (result.scaled - 200) / 600 }}>
                    <span className="history__value num">{result.scaled}</span>
                    <span className="history__bar" />
                    <span className="history__label">
                      {examTitle(result.examId).replace('Practice Test', 'PT')} · {new Date(result.finishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ol>
              <span className="history__target" style={{ ['--h' as string]: (target - 200) / 600 }}>
                target {target}
              </span>
            </div>
          </section>
        )}

        <p className="exams__fine">
          No feedback until you submit, and no sounds — test day is quiet. Every miss is clipped into your Mistake Notebook. Scores are estimates on the
          live app’s curve, not official College Board scores.
        </p>
      </div>
    </GameShell>
  )
}
