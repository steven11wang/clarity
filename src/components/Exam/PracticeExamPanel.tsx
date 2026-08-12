import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, BookA, Check, Trash2 } from 'lucide-react'

import { useAuthProfile } from '../../auth/AuthContext.tsx'
import { ExamReport } from './ExamReport.tsx'
import { ExamRunner, type ExamResult } from './ExamRunner.tsx'
import {
  CUSTOM_MINUTES_MAX,
  CUSTOM_MINUTES_MIN,
  EXAM_CATALOG,
  EXAM_PACE_OPTIONS,
  loadPracticeExam,
  type PracticeExam,
} from './examData.ts'
import {
  PROGRAM,
  programProgress,
  readUds,
  recordScore,
  type ProgramStep,
} from './program.ts'
import {
  clearPracticeExamDraft,
  deleteExamRecord,
  getExamRecords,
  getPracticeExamDraft,
  getWordBankEntries,
  saveExamRecord,
  subscribeStorageChanges,
  type PracticeExamDraft,
  type PracticeExamRecord,
} from '../../storage/index.ts'
import { useExamTheme } from './useExamTheme.ts'
import './exam.css'

type Live = {
  exam: PracticeExam
  paceId: string
  customMinutes: number
  initialDraft?: PracticeExamDraft | null
}

const CATALOG = new Map(EXAM_CATALOG.map((entry) => [entry.id as string, entry]))

/** Reading and Writing runs 32 minutes a module on the real thing. */
const OFFICIAL_MINUTES_PER_MODULE = 32

/** The pace a step opens on: slow for the learning phase, real for the last one. */
function defaultPace(step: ProgramStep): string {
  return step.kind === 'timed' ? 'official' : 'untimed'
}

/** The pace this step wants comes first, so the recommended choice reads first. */
function orderedPaces(step: ProgramStep) {
  const preferred = defaultPace(step)
  return [...EXAM_PACE_OPTIONS].sort(
    (a, b) => Number(b.id === preferred) - Number(a.id === preferred),
  )
}

function timingFor(paceId: string, customMinutes: number) {
  const option =
    EXAM_PACE_OPTIONS.find((entry) => entry.id === paceId) ?? EXAM_PACE_OPTIONS[0]
  return option.timing(
    Math.min(CUSTOM_MINUTES_MAX, Math.max(CUSTOM_MINUTES_MIN, customMinutes)),
  )
}

/** How long this run will take, without loading the exam file to find out. */
function lengthLabel(paceId: string, customMinutes: number, modules: number) {
  const timing = timingFor(paceId, customMinutes)
  if (timing.kind === 'untimed') return 'no clock'
  const perModule =
    timing.kind === 'fixed' ? timing.minutesPerModule : OFFICIAL_MINUTES_PER_MODULE * timing.factor
  return `${Math.round(perModule * modules)} min`
}

export function PracticeExamPanel({
  onBack,
  onOpenWords,
}: { onBack?: () => void; onOpenWords?: () => void } = {}) {
  const { displayName } = useAuthProfile()
  const [theme, setTheme] = useExamTheme()
  const [records, setRecords] = useState<PracticeExamRecord[]>(() => getExamRecords())
  const [wordCount, setWordCount] = useState(() => getWordBankEntries().length)
  const [, setDraftsVersion] = useState(0)
  const [openStep, setOpenStep] = useState<string | null>(null)
  const [paces, setPaces] = useState<Record<string, string>>({})
  const [customMinutes, setCustomMinutes] = useState(20)
  const [live, setLive] = useState<Live | null>(null)
  const [report, setReport] = useState<{ exam: PracticeExam; result: ExamResult } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Answer keys are only needed for exams the student has actually sat, so the
  // programme page pulls those files and no others.
  const [keys, setKeys] = useState<Record<string, Map<string, string>>>({})

  useEffect(() => {
    return subscribeStorageChanges(() => {
      setRecords(getExamRecords())
      setWordCount(getWordBankEntries().length)
      setDraftsVersion((v) => v + 1)
    })
  }, [])

  useEffect(() => {
    for (const examId of new Set(records.map((record) => record.examId))) {
      if (examId in keys) continue
      setKeys((current) => ({ ...current, [examId]: new Map() }))
      loadPracticeExam(examId)
        .then((exam) => {
          const map = new Map<string, string>()
          for (const module of exam.modules) {
            for (const question of module.questions) {
              if (question.answer) map.set(question.id, question.answer)
            }
          }
          setKeys((current) => ({ ...current, [examId]: map }))
        })
        .catch(() => {})
    }
  }, [records, keys])

  const score = useMemo(
    () => (record: PracticeExamRecord) => {
      const key = keys[record.examId]
      return key ? recordScore(record, key) : null
    },
    [keys],
  )

  const progress = useMemo(() => programProgress(records, score), [records, score])

  // The runner owns the whole screen, exactly like the real testing app: no
  // console chrome, no scroll behind it.
  useEffect(() => {
    if (!live && !report) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [live, report])

  async function start(
    step: ProgramStep | null,
    examId: string,
    options?: { resume?: boolean },
  ) {
    setBusy(examId)
    setFailed(null)
    try {
      const exam = await loadPracticeExam(examId)
      let draft = getPracticeExamDraft(examId)
      if (options?.resume === false) {
        clearPracticeExamDraft(examId)
        draft = null
      }
      setAttempt((count) => count + 1)
      setLive({
        exam,
        paceId: draft?.paceId ?? (step ? paces[step.id] ?? defaultPace(step) : 'official'),
        customMinutes: draft?.customMinutes ?? customMinutes,
        initialDraft: draft,
      })
    } catch {
      setFailed(examId)
    } finally {
      setBusy(null)
    }
  }

  async function openReport(record: PracticeExamRecord) {
    setBusy(record.id)
    try {
      const exam = await loadPracticeExam(record.examId)
      setReport({ exam, result: record.result })
    } catch {
      setFailed(record.examId)
    } finally {
      setBusy(null)
    }
  }

  if (live) {
    return createPortal(
      <div className="exam-overlay" data-exam-theme={theme}>
        <ExamRunner
          key={attempt}
          exam={live.exam}
          learnerName={displayName}
          theme={theme}
          timing={timingFor(live.paceId, live.customMinutes)}
          paceId={live.paceId}
          customMinutes={live.customMinutes}
          initialDraft={live.initialDraft}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onExit={() => setLive(null)}
          onFinish={(finished) => {
            saveExamRecord({
              id: `exam_record_${finished.finishedAt}_${live.exam.id}`,
              examId: live.exam.id,
              examTitle: live.exam.title,
              finishedAt: finished.finishedAt,
              result: finished,
            })
            setRecords(getExamRecords())
            setReport({ exam: live.exam, result: finished })
            setLive(null)
          }}
        />
      </div>,
      document.body,
    )
  }

  if (report) {
    return createPortal(
      <div className="exam-overlay" data-exam-theme={theme}>
        <ExamReport
          exam={report.exam}
          result={report.result}
          onUpdateResult={(updatedResult) => {
            setReport((current) => (current ? { ...current, result: updatedResult } : null))
            const existing = getExamRecords().find(
              (r) => r.examId === report.exam.id && r.finishedAt === updatedResult.finishedAt,
            )
            if (existing) {
              saveExamRecord({ ...existing, result: updatedResult })
            }
          }}
          onRetake={() => {
            setAttempt((count) => count + 1)
            setLive({ exam: report.exam, paceId: 'untimed', customMinutes })
            setReport(null)
          }}
          onChangeTiming={() => setReport(null)}
          onExit={() => setReport(null)}
        />
      </div>,
      document.body,
    )
  }

  return (
    <section className="program">
      {onBack ? (
        <button className="program__back" type="button" onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={1.7} /> Back to practice
        </button>
      ) : null}

      <header className="program__head">
        <h1>Reading and Writing</h1>
        <p>
          Learn the words, find your untimed score, work four exams the slow
          way, then put the clock back on.
        </p>
      </header>

      {progress.uds !== null ? <Scoreboard uds={progress.uds} best={progress.bestTimed} /> : null}

      <ol className="program__steps">
        {PROGRAM.map((step, index) => {
          const state =
            index < progress.currentIndex
              ? 'done'
              : index === progress.currentIndex
                ? 'current'
                : 'ahead'
          return (
            <li className={`step step--${state}`} key={step.id}>
              <StepRow
                step={step}
                index={index}
                state={state}
                open={openStep === step.id}
                onToggle={() => setOpenStep(openStep === step.id ? null : step.id)}
                progress={progress}
                records={records}
                score={score}
                wordCount={wordCount}
                paceId={paces[step.id] ?? defaultPace(step)}
                onPace={(paceId) => setPaces((current) => ({ ...current, [step.id]: paceId }))}
                customMinutes={customMinutes}
                onCustomMinutes={setCustomMinutes}
                busy={busy}
                failed={failed}
                onStart={(examId, options) => start(step, examId, options)}
                onOpenReport={openReport}
                onDelete={(id) => {
                  deleteExamRecord(id)
                  setRecords(getExamRecords())
                }}
                onOpenWords={onOpenWords}
              />
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Scoreboard({ uds, best }: { uds: number; best: number | null }) {
  const reading = readUds(uds)
  return (
    <div className="program__score">
      <div className="program__score-row">
        <Figure label="Untimed, dictionary" value={uds} />
        <Figure label="Gap to 800" value={800 - uds} note="critical thinking" />
        {best !== null ? (
          <Figure label="Best on the clock" value={best} note={`${uds - best} to vocabulary and speed`} />
        ) : null}
      </div>
      <p>
        <strong>{reading.verdict}</strong> {reading.advice}
      </p>
    </div>
  )
}

function Figure({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="program__figure">
      <span className="program__figure-label">{label}</span>
      <strong>{value}</strong>
      {note ? <span className="program__figure-note">{note}</span> : null}
    </div>
  )
}

type StepRowProps = {
  step: ProgramStep
  index: number
  state: 'done' | 'current' | 'ahead'
  open: boolean
  onToggle: () => void
  progress: ReturnType<typeof programProgress>
  records: PracticeExamRecord[]
  score: (record: PracticeExamRecord) => number | null
  wordCount: number
  paceId: string
  onPace: (paceId: string) => void
  customMinutes: number
  onCustomMinutes: (minutes: number) => void
  busy: string | null
  failed: string | null
  onStart: (examId: string, options?: { resume?: boolean }) => void
  onOpenReport: (record: PracticeExamRecord) => void
  onDelete: (id: string) => void
  onOpenWords?: () => void
}

function StepRow(props: StepRowProps) {
  const { step, index, state, open, onToggle, progress, wordCount, onOpenWords } = props

  if (step.kind === 'vocabulary') {
    return (
      <div className="step__row step__row--static">
        <Marker index={index} state={state} />
        <div className="step__body">
          <span className="step__title">{step.title}</span>
          <p>{step.blurb}</p>
        </div>
        <div className="step__side">
          <span className="step__meta">{wordCount} saved</span>
          {onOpenWords ? (
            <button className="exam-button exam-button--ghost exam-button--small" type="button" onClick={onOpenWords}>
              <BookA size={15} strokeWidth={1.7} /> Word bank
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  if (step.kind === 'timed') {
    return (
      <>
        <button className="step__row" type="button" onClick={onToggle} aria-expanded={open}>
          <Marker index={index} state={state} />
          <div className="step__body">
            <span className="step__title">{step.title}</span>
            {state === 'current' || open ? <p>{step.blurb}</p> : null}
          </div>
          <div className="step__side">
            {progress.bestTimed !== null ? (
              <span className="step__score">{progress.bestTimed}</span>
            ) : (
              <span className="step__meta">not started</span>
            )}
          </div>
        </button>
        {open ? (
          <div className="step__panel">
            <p className="step__hint">Official pace, dictionary off. Pick any exam you’ve already worked through.</p>
            <div className="step__timed-list">
              {EXAM_CATALOG.slice(1).map((exam) => {
                const done = progress.byExam[exam.id]?.timed
                const timedDraft = getPracticeExamDraft(exam.id)
                return (
                  <button
                    className="step__timed"
                    type="button"
                    key={exam.id}
                    disabled={props.busy === exam.id}
                    onClick={() => props.onStart(exam.id, { resume: Boolean(timedDraft) })}
                  >
                    <span>{exam.title}</span>
                    <span className="step__meta">
                      {timedDraft ? 'in progress' : done ? `${props.score(done) ?? '—'}` : 'run it'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </>
    )
  }

  const examId = step.examId
  const entry = progress.byExam[examId]
  const catalog = CATALOG.get(examId)
  const best = entry?.untimed ? props.score(entry.untimed) : null
  const attempts = props.records
    .filter((record) => record.examId === examId)
    .slice(0, 4)
  const draft = getPracticeExamDraft(examId)

  return (
    <>
      <button className="step__row" type="button" onClick={onToggle} aria-expanded={open}>
        <Marker index={index} state={state} />
        <div className="step__body">
          <span className="step__title">{step.title}</span>
          {state === 'current' || open ? <p>{step.blurb}</p> : null}
        </div>
        <div className="step__side">
          {best !== null ? (
            <span className="step__score">{best}</span>
          ) : (
            <span className="step__meta">{catalog?.source}</span>
          )}
        </div>
      </button>

      {open ? (
        <div className="step__panel">
          <p className="step__hint">
            {catalog?.questions} questions · {catalog?.modules} modules ·{' '}
            {lengthLabel(props.paceId, props.customMinutes, catalog?.modules ?? 2)} ·{' '}
            {catalog?.source}
          </p>

          <div className="step__paces" role="radiogroup" aria-label="Pace">
            {orderedPaces(step).map((option) => (
              <button
                className={`step__pace ${option.id === props.paceId ? 'step__pace--on' : ''}`}
                type="button"
                role="radio"
                aria-checked={option.id === props.paceId}
                key={option.id}
                onClick={() => props.onPace(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {props.paceId === 'custom' ? (
            <label className="step__custom">
              Minutes per module
              <input
                type="number"
                min={CUSTOM_MINUTES_MIN}
                max={CUSTOM_MINUTES_MAX}
                value={props.customMinutes}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  props.onCustomMinutes(Number.isFinite(next) ? next : CUSTOM_MINUTES_MIN)
                }}
              />
            </label>
          ) : null}

          <div className="step__actions">
            {draft ? (
              <>
                <button
                  className="exam-button exam-button--primary"
                  type="button"
                  disabled={props.busy === examId}
                  onClick={() => props.onStart(examId, { resume: true })}
                >
                  {props.busy === examId ? 'Opening…' : 'Resume test'}
                </button>
                <button
                  className="exam-button exam-button--ghost"
                  type="button"
                  disabled={props.busy === examId}
                  onClick={() => props.onStart(examId, { resume: false })}
                >
                  Start fresh
                </button>
              </>
            ) : (
              <button
                className="exam-button exam-button--primary"
                type="button"
                disabled={props.busy === examId}
                onClick={() => props.onStart(examId)}
              >
                {props.busy === examId ? 'Opening…' : entry?.attempts ? 'Sit it again' : 'Start'}
              </button>
            )}
            {props.failed === examId ? (
              <span className="step__error">Couldn’t load that exam. Try again.</span>
            ) : null}
          </div>

          {attempts.length ? (
            <ul className="step__attempts">
              {attempts.map((record) => (
                <li key={record.id}>
                  <button
                    className="step__attempt"
                    type="button"
                    onClick={() => props.onOpenReport(record)}
                  >
                    <span>
                      {new Date(record.finishedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="step__meta">{record.result.timingLabel}</span>
                    <span className="step__score step__score--small">
                      {props.score(record) ?? '—'}
                    </span>
                  </button>
                  <button
                    className="step__delete"
                    type="button"
                    aria-label="Delete this attempt"
                    onClick={() => props.onDelete(record.id)}
                  >
                    <Trash2 size={14} strokeWidth={1.7} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function Marker({ index, state }: { index: number; state: 'done' | 'current' | 'ahead' }) {
  return (
    <span className={`step__marker step__marker--${state}`} aria-hidden="true">
      {state === 'done' ? <Check size={14} strokeWidth={2.4} /> : index + 1}
    </span>
  )
}
