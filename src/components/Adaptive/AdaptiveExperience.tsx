import { useMemo, useState, type ReactNode } from 'react'

import {
  canStartCheckpoint,
  createProgressionState,
  getSkillPracticeLevel,
  selectActiveDomain,
  submitDiagnostic,
  submitCheckpoint,
  submitSkillQuiz,
  type ProgressionState,
  type SkillQuizPurpose,
} from '../../progression/model.ts'
import {
  createAdaptiveDraft,
  restoreAdaptiveDraft,
  type AdaptiveAssessment as Assessment,
} from '../../progression/assessmentDraft.ts'
import {
  checkpointRetakeImmediateAvoidIds,
  repairImmediateAvoidIds,
} from '../../progression/freshness.ts'
import {
  buildTaxonomy,
  selectCheckpointQuestions,
  selectSkillQuestions,
  type InsufficientQuestionSelection,
} from '../../progression/questions.ts'
import {
  SAT_DOMAINS,
  type Level,
  type SatDomain,
} from '../../progression/config.ts'
import {
  clearAdaptiveDraft,
  getAdaptiveDraft,
  hasSeenLesson,
  markLessonSeen,
  saveAdaptiveDraft,
} from '../../storage/index.ts'
import { getSkillLessonSummary } from '../../content/skillLessons.ts'
import { LessonLibrary } from '../Lesson/LessonLibrary.tsx'
import { SkillLesson } from '../Lesson/SkillLesson.tsx'
import type { Question } from '../../types.ts'
import { AssessmentResult } from './AssessmentResult.tsx'
import { BatchQuiz, type BatchAnswers } from './BatchQuiz.tsx'
import { ContentError } from './ContentError.tsx'
import {
  DomainPath,
  type CheckpointView,
  type SkillCardView,
} from './DomainPath.tsx'
import { Onboarding } from './Onboarding.tsx'
import { QuestionInteraction } from '../QuestionInteraction/QuestionInteraction.tsx'
import {
  ProgressDashboard,
  type DomainCardView,
} from './ProgressDashboard.tsx'
import type { PrimaryConsoleView } from './primaryViewTransition.ts'
import { TieSelection } from './TieSelection.tsx'
import type { Attempt, FirstPass } from '../../types.ts'

export type AdaptiveAttemptReference = {
  timestamp: number
  reviewStage: number
}

type AdaptiveExperienceProps = {
  primaryView: PrimaryConsoleView
  reviewsPanel: ReactNode
  libraryPanel: ReactNode
  insightsPanel: ReactNode
  dueCount: number
  questions: Question[]
  progression: ProgressionState | null
  onProgressionChange: (state: ProgressionState) => void
  onOpenPractice: () => void
  onOpenLessons: () => void
  onOpenReviews: () => void
  onOpenLibrary: () => void
  onOpenInsights: () => void
  onRecordAnswers: (
    assessmentId: string,
    questions: Question[],
    answers: BatchAnswers,
    kind: 'diagnostic' | 'skill' | 'checkpoint',
    level: Level,
  ) => Record<string, AdaptiveAttemptReference>
  onRecordReview: (
    attempt: Attempt,
    reference: AdaptiveAttemptReference,
    assessmentId: string,
    kind: 'diagnostic' | 'skill' | 'checkpoint',
    level: Level,
  ) => void
}

type Feedback = {
  eyebrow: string
  title: string
  score: number
  total: number
  message: string
  details: string[]
  success: boolean
  nextLabel: string
}

type Screen =
  | 'dashboard'
  | 'domain'
  | 'lessons'
  | 'lesson'
  | 'quiz'
  | 'result'
  | 'review'
  | 'content-error'

// A lesson is either gating a quiz the student is about to start (first time on
// the skill), or opened on its own as a reread - from the skill card, or from
// the dashboard's Lessons tab.
type PendingLesson = {
  /** The lesson on screen. */
  skill: string
  /**
   * The skill whose quiz is waiting behind this lesson, so the read is never
   * recorded against the wrong skill. Null when rereading.
   */
  gatedSkill: string | null
  /** null when the student opened the lesson to reread it. */
  next: Assessment | null
  /** Where leaving the lesson should land. */
  origin: 'domain' | 'lessons'
}

type ContentFailure = {
  failure: InsufficientQuestionSelection
  kind: 'diagnostic' | 'skill' | 'checkpoint'
  domain: SatDomain
  skill?: string
}

export function AdaptiveExperience({
  primaryView,
  reviewsPanel,
  libraryPanel,
  insightsPanel,
  dueCount,
  questions,
  progression,
  onProgressionChange,
  onOpenPractice,
  onOpenLessons,
  onOpenReviews,
  onOpenLibrary,
  onOpenInsights,
  onRecordAnswers,
  onRecordReview,
}: AdaptiveExperienceProps) {
  const taxonomy = useMemo(() => buildTaxonomy(questions), [questions])
  const [restoredDraft] = useState(() => {
    const stored = getAdaptiveDraft()
    const restored = restoreAdaptiveDraft(
      stored,
      questions,
      progression,
      taxonomy,
    )
    if (stored && !restored) clearAdaptiveDraft()
    return restored
  })
  const [screen, setScreen] = useState<Screen>(
    restoredDraft ? 'quiz' : 'dashboard',
  )
  const [assessment, setAssessment] = useState<Assessment | null>(
    restoredDraft?.assessment ?? null,
  )
  const [draftAnswers, setDraftAnswers] = useState<BatchAnswers>(
    restoredDraft?.answers ?? {},
  )
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [contentFailure, setContentFailure] = useState<ContentFailure | null>(null)
  const [isUpdatingScore, setIsUpdatingScore] = useState(false)
  const [submittedAnswers, setSubmittedAnswers] = useState<BatchAnswers>({})
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([])
  const [reviewFlaggedIds, setReviewFlaggedIds] = useState<string[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [attemptReferences, setAttemptReferences] = useState<
    Record<string, AdaptiveAttemptReference>
  >({})
  const [pendingLesson, setPendingLesson] = useState<PendingLesson | null>(null)
  // Which lesson hall the student has open, so finishing a lesson lands back on
  // the skill list it was started from rather than the portal room.
  const [lessonHall, setLessonHall] = useState<SatDomain | null>(null)

  function openAssessment(next: Assessment) {
    if (!progression) return
    const answers: BatchAnswers = {}
    saveAdaptiveDraft(
      createAdaptiveDraft(next, answers, progression.onboarding.confirmedAt),
    )
    setAssessment(next)
    setDraftAnswers(answers)
    setScreen('quiz')
  }

  // The first time a student practices a skill, the Foundations lesson comes
  // first. Only skill quizzes are gated: the diagnostic is a cold baseline by
  // design, and a checkpoint mixes every skill at once.
  function openAssessmentWithLesson(next: Assessment) {
    if (
      next.kind === 'skill' &&
      getSkillLessonSummary(next.skill) !== null &&
      !hasSeenLesson(next.skill)
    ) {
      setPendingLesson({
        skill: next.skill,
        gatedSkill: next.skill,
        next,
        origin: 'domain',
      })
      setScreen('lesson')
      return
    }
    openAssessment(next)
  }

  function openLessonReread(skill: string, origin: 'domain' | 'lessons' = 'domain') {
    if (getSkillLessonSummary(skill) === null) return
    setPendingLesson({ skill, gatedSkill: null, next: null, origin })
    setScreen('lesson')
  }

  function updateDraftAnswers(answers: BatchAnswers) {
    if (!progression || !assessment) return
    saveAdaptiveDraft(
      createAdaptiveDraft(
        assessment,
        answers,
        progression.onboarding.confirmedAt,
      ),
    )
    setDraftAnswers(answers)
  }

  function clearAssessmentUi() {
    setAssessment(null)
    setDraftAnswers({})
    setSubmittedAnswers({})
    setReviewQuestions([])
    setReviewFlaggedIds([])
    setReviewIndex(0)
    setAttemptReferences({})
    setFeedback(null)
    setPendingLesson(null)
  }

  if (!progression || isUpdatingScore) {
    return (
      <Onboarding
        replacingExisting={Boolean(progression)}
        onCancel={
          progression
            ? () => {
                setIsUpdatingScore(false)
                setScreen('dashboard')
              }
            : undefined
        }
        onConfirm={(results, screenshotName) => {
          clearAdaptiveDraft()
          onProgressionChange(
            createProgressionState(results, taxonomy, screenshotName),
          )
          clearAssessmentUi()
          setContentFailure(null)
          setIsUpdatingScore(false)
          setScreen('dashboard')
        }}
      />
    )
  }

  if (
    progression.recommendationCandidates.length > 1 &&
    progression.recommendedDomain === null
  ) {
    return (
      <TieSelection
        candidates={progression.recommendationCandidates}
        results={progression.onboarding.results}
        onSelect={(domain) => {
          clearAdaptiveDraft()
          onProgressionChange(selectActiveDomain(progression, domain))
          setScreen('dashboard')
        }}
      />
    )
  }

  const selectedDomain =
    progression.selectedDomain ?? progression.recommendedDomain ?? SAT_DOMAINS[0]

  function chooseDomain(domain: SatDomain) {
    clearAdaptiveDraft()
    onProgressionChange(selectActiveDomain(progression!, domain))
    setAssessment(null)
    setDraftAnswers({})
    setFeedback(null)
    setScreen('domain')
  }

  function startSkill(domainName: SatDomain, skillName: string) {
    const domain = progression!.domains[domainName]
    if (domain.diagnostic.completedAt === null) return
    const skill = domain.skills[skillName]
    const level = getSkillPracticeLevel(progression!, domainName, skillName)
    const checkpointRepair =
      skill.remediation?.purpose === 'checkpoint-repair' ||
      (level !== 'Noobie' &&
        domain.checkpoints[level].repairSkills.includes(skillName))
    const purpose: SkillQuizPurpose = checkpointRepair
      ? 'checkpoint-repair'
      : 'training'
    const levelProgress = skill.levels[level]
    const previous = levelProgress.attempts.at(-1)
    const repairTargetLevel =
      skill.remediation?.purpose === 'checkpoint-repair' &&
      skill.remediation.targetLevel !== 'Noobie'
        ? skill.remediation.targetLevel
        : checkpointRepair && level !== 'Noobie'
          ? level
          : null
    const triggeringCheckpoint = repairTargetLevel
      ? domain.checkpoints[repairTargetLevel].attempts.at(-1)
      : undefined
    const immediateAvoidIds = checkpointRepair
      ? repairImmediateAvoidIds({
          questions,
          skill: skillName,
          latestQuizQuestionIds: previous?.questionIds ?? [],
          triggeringCheckpointQuestionIds:
            triggeringCheckpoint?.questionIds ?? [],
        })
      : previous?.questionIds ?? []
    const selection = selectSkillQuestions({
      questions,
      domain: domainName,
      skill: skillName,
      level,
      questionIdHistory: levelProgress.questionIdHistory,
      immediateAvoidIds,
      seed: `${progression!.onboarding.confirmedAt}:${domainName}:${skillName}:${level}`,
      attemptOrdinal: levelProgress.attempts.length,
    })

    if (!selection.ok) {
      setContentFailure({
        failure: selection,
        kind: 'skill',
        domain: domainName,
        skill: skillName,
      })
      setScreen('content-error')
      return
    }

    openAssessmentWithLesson({
      kind: 'skill',
      id: `skill:${domainName}:${skillName}:${level}:${levelProgress.attempts.length}`,
      domain: domainName,
      skill: skillName,
      level,
      purpose,
      questions: selection.questions,
      reusedCount: selection.reusedQuestionIds.length,
    })
  }

  function startDiagnostic(domainName: SatDomain) {
    const domain = progression!.domains[domainName]
    if (domain.diagnostic.completedAt !== null) return
    const level = domain.unlockedLevel
    const selection = selectCheckpointQuestions({
      questions,
      domain: domainName,
      level,
      questionIdHistory: [],
      immediateAvoidIds: [],
      seed: `${progression!.onboarding.confirmedAt}:${domainName}:${level}:diagnostic`,
      attemptOrdinal: 0,
    })
    if (!selection.ok) {
      setContentFailure({
        failure: selection,
        kind: 'diagnostic',
        domain: domainName,
      })
      setScreen('content-error')
      return
    }
    openAssessment({
      kind: 'diagnostic',
      id: `diagnostic:${domainName}:${level}:0`,
      domain: domainName,
      level,
      questions: selection.questions,
      reusedCount: selection.reusedQuestionIds.length,
    })
  }

  function checkpointHistory(domainName: SatDomain, level: 'Adventurer' | 'Master') {
    const domain = progression!.domains[domainName]
    return Object.values(domain.skills).flatMap(
      (skill) => skill.levels[level].questionIdHistory,
    )
  }

  function startCheckpoint(domainName: SatDomain) {
    const domain = progression!.domains[domainName]
    const level = domain.unlockedLevel
    if (level === 'Noobie' || !canStartCheckpoint(progression!, domainName, level)) {
      return
    }
    const checkpoint = domain.checkpoints[level]
    const previous = checkpoint.attempts.at(-1)
    const repairAttempts = Object.values(domain.skills).flatMap(
      (skill) => skill.levels[level].attempts,
    )
    const selection = selectCheckpointQuestions({
      questions,
      domain: domainName,
      level,
      questionIdHistory: checkpointHistory(domainName, level),
      immediateAvoidIds: checkpointRetakeImmediateAvoidIds(
        previous,
        repairAttempts,
      ),
      seed: `${progression!.onboarding.confirmedAt}:${domainName}:${level}:checkpoint`,
      attemptOrdinal: checkpoint.attempts.length,
    })

    if (!selection.ok) {
      setContentFailure({
        failure: selection,
        kind: 'checkpoint',
        domain: domainName,
      })
      setScreen('content-error')
      return
    }

    openAssessment({
      kind: 'checkpoint',
      id: `checkpoint:${domainName}:${level}:${checkpoint.attempts.length}`,
      domain: domainName,
      level,
      questions: selection.questions,
      reusedCount: selection.reusedQuestionIds.length,
    })
  }

  function submitAssessment(answers: BatchAnswers, flaggedIds: string[]) {
    if (!assessment) return
    const score = assessment.questions.filter(
      (question) => answers[question.id] === question.answer,
    ).length
    const missedQuestions = assessment.questions.filter(
      (question) => answers[question.id] !== question.answer,
    )
    const flaggedQuestions = assessment.questions.filter((question) =>
      flaggedIds.includes(question.id),
    )
    const flaggedSummary =
      flaggedQuestions.length > 0
        ? [
            `You flagged ${flaggedQuestions.length} ${
              flaggedQuestions.length === 1 ? 'question' : 'questions'
            } for review: ${flaggedQuestions
              .map((question, i) => {
                const index = assessment.questions.indexOf(question)
                const correct = answers[question.id] === question.answer
                return `Q${index + 1} (${correct ? 'correct' : 'missed'})${
                  i === flaggedQuestions.length - 1 ? '' : ','
                }`
              })
              .join(' ')}`,
          ]
        : []

    if (assessment.kind === 'diagnostic') {
      const next = submitDiagnostic(progression!, {
        domain: assessment.domain,
        level: assessment.level,
        score,
        total: assessment.questions.length,
        questionIds: assessment.questions.map((question) => question.id),
        timestamp: Date.now(),
      })
      onProgressionChange(next)
      const references = onRecordAnswers(
        assessment.id,
        assessment.questions,
        answers,
        assessment.kind,
        assessment.level,
      )
      setAttemptReferences(references)
      setSubmittedAnswers(answers)
      setReviewQuestions(missedQuestions)
      setReviewFlaggedIds(flaggedIds)
      setReviewIndex(0)
      clearAdaptiveDraft()
      setFeedback({
        eyebrow: 'Full diagnostic complete',
        title: `${score}/${assessment.questions.length} is your starting map.`,
        score,
        total: assessment.questions.length,
        message: missedQuestions.length
          ? 'Clarity found the exact concepts to teach before your skill mini quizzes.'
          : 'Your foundation is strong. Your skill mini quizzes are now unlocked.',
        details: [
          'This baseline does not lower or erase progress.',
          'Mini quizzes now focus on one skill at a time.',
          ...flaggedSummary,
        ],
        success: missedQuestions.length === 0,
        nextLabel: missedQuestions.length
          ? `Learn from ${missedQuestions.length} missed ${missedQuestions.length === 1 ? 'question' : 'questions'}`
          : 'Open skill path',
      })
    } else if (assessment.kind === 'skill') {
      const before = progression!.domains[assessment.domain]
      const beforeSkill = before.skills[assessment.skill]
      const next = submitSkillQuiz(progression!, {
        domain: assessment.domain,
        skill: assessment.skill,
        level: assessment.level,
        score,
        questionIds: assessment.questions.map((question) => question.id),
        purpose: assessment.purpose,
        timestamp: Date.now(),
      })
      const after = next.domains[assessment.domain]
      const afterSkill = after.skills[assessment.skill]
      const details: string[] = []
      let title: string
      let message: string

      if (score === 3) {
        if (before.unlockedLevel !== after.unlockedLevel) {
          title = `${after.unlockedLevel} training unlocked.`
          message = `Every Noobie skill in ${assessment.domain} is secure. ${after.unlockedLevel} questions are ready.`
        } else if (afterSkill.remediation) {
          const nextLevel = afterSkill.remediation.requiredPath[0]
          title = `${assessment.level} foundation secured.`
          message = `You earned 3/3 here. Return to ${nextLevel} and finish the original challenge.`
        } else if (
          assessment.purpose === 'checkpoint-repair' &&
          assessment.level !== 'Noobie'
        ) {
          title = 'Checkpoint repair complete.'
          message = `${assessment.skill} is cleared. Your other completed skills were never reset.`
        } else if (beforeSkill.remediation) {
          title = `${assessment.skill} is back on track.`
          message = 'You rebuilt the foundation and completed the original level with 3/3.'
        } else {
          title = `3/3 - ${assessment.skill} complete.`
          message = 'That skill is secured at this level. Your progress is saved.'
        }
      } else {
        const nextLevel = getSkillPracticeLevel(
          next,
          assessment.domain,
          assessment.skill,
        )
        if (assessment.level === 'Noobie') {
          title = 'Build the perfect three.'
          message = `You scored ${score}/3. A fresh Noobie set will help the pattern settle before you move on.`
        } else {
          title = 'Strengthen the foundation, then return.'
          message = `You scored ${score}/3. Next is a ${nextLevel} set for this skill; earn 3/3 there and you’ll climb back to ${assessment.level}.`
          details.push(
            'This is focused reinforcement, not lost progress.',
            'Every unrelated completed skill stays complete.',
          )
        }
      }
      if (assessment.reusedCount > 0) {
        details.push(
          `${assessment.reusedCount} familiar ${
            assessment.reusedCount === 1 ? 'question returned' : 'questions returned'
          } because this skill’s fresh-question pool is limited.`,
        )
      }
      details.push(...flaggedSummary)

      onProgressionChange(next)
      const references = onRecordAnswers(
        assessment.id,
        assessment.questions,
        answers,
        assessment.kind,
        assessment.level,
      )
      setAttemptReferences(references)
      setSubmittedAnswers(answers)
      setReviewQuestions(missedQuestions)
      setReviewFlaggedIds(flaggedIds)
      setReviewIndex(0)
      clearAdaptiveDraft()
      setFeedback({
        eyebrow: score === 3 ? 'Mini quiz complete' : 'Foundation practice',
        title,
        score,
        total: 3,
        message,
        details,
        success: score === 3,
        nextLabel:
          missedQuestions.length > 0
            ? `Review ${missedQuestions.length} missed ${
                missedQuestions.length === 1 ? 'question' : 'questions'
              }`
            : 'Continue this path',
      })
    } else {
      const outcomes = assessment.questions.map((question) => ({
        questionId: question.id,
        skill: question.skill,
        correct: answers[question.id] === question.answer,
      }))
      const next = submitCheckpoint(progression!, {
        domain: assessment.domain,
        level: assessment.level,
        outcomes,
        timestamp: Date.now(),
      })
      const missedSkills = [...new Set(
        outcomes.filter((outcome) => !outcome.correct).map((outcome) => outcome.skill),
      )]
      const passed = score === assessment.questions.length
      const details = passed
        ? assessment.level === 'Adventurer'
          ? ['Master skill practice is now unlocked.']
          : ['This domain is finished, and its completed character stage is permanent.']
        : [
            `Repair only: ${missedSkills.join(', ')}.`,
            'Skills answered perfectly remain complete.',
            'The checkpoint retake unlocks after every repair reaches 3/3.',
          ]
      if (assessment.reusedCount > 0) {
        details.push(
          `${assessment.reusedCount} previously seen ${
            assessment.reusedCount === 1 ? 'question was' : 'questions were'
          } reused after fresher questions ran out.`,
        )
      }
      details.push(...flaggedSummary)

      onProgressionChange(next)
      const references = onRecordAnswers(
        assessment.id,
        assessment.questions,
        answers,
        assessment.kind,
        assessment.level,
      )
      setAttemptReferences(references)
      setSubmittedAnswers(answers)
      setReviewQuestions(missedQuestions)
      setReviewFlaggedIds(flaggedIds)
      setReviewIndex(0)
      clearAdaptiveDraft()
      setFeedback({
        eyebrow: passed ? 'Checkpoint passed' : 'Checkpoint repair plan',
        title: passed
          ? assessment.level === 'Adventurer'
            ? 'Master training unlocked.'
            : `${assessment.domain} mastered.`
          : `${missedSkills.length} ${
              missedSkills.length === 1 ? 'skill needs' : 'skills need'
            } a focused repair.`,
        score,
        total: assessment.questions.length,
        message: passed
          ? 'A perfect mixed challenge - your character just grew.'
          : 'Redo each missed question before opening the focused repair plan. Your original checkpoint score still determines progression.',
        details,
        success: passed,
        nextLabel: passed
          ? 'See the new stage'
          : `Review ${missedQuestions.length} missed ${
              missedQuestions.length === 1 ? 'question' : 'questions'
            }`,
      })
    }

    setScreen('result')
  }

  if (screen === 'quiz' && assessment) {
    const checkpoint = assessment.kind === 'checkpoint'
    const diagnostic = assessment.kind === 'diagnostic'
    return (
      <BatchQuiz
        eyebrow={diagnostic ? 'Required full quiz' : checkpoint ? `${assessment.level} checkpoint` : `${assessment.level} skill practice`}
        title={diagnostic ? `${assessment.domain} starting diagnostic` : checkpoint ? `${assessment.domain} mixed challenge` : assessment.skill}
        description={
          diagnostic
            ? `Start with the complete ${assessment.questions.length}-question domain quiz. You’ll see one question at a time, and the result will shape what you practice next.`
            : checkpoint
            ? `Answer all ${assessment.questions.length} questions, with three from every skill. You need 100% to pass. Results appear only after the complete test is submitted.`
            : `Answer three questions one at a time. Earn 3/3 to complete ${assessment.skill} at ${assessment.level}.`
        }
        questions={assessment.questions}
        assessmentId={assessment.id}
        submitLabel={diagnostic ? 'Finish full diagnostic' : checkpoint ? 'Submit checkpoint' : 'Submit mini quiz'}
        initialAnswers={draftAnswers}
        onAnswersChange={updateDraftAnswers}
        onCancel={() => {
          clearAdaptiveDraft()
          setAssessment(null)
          setDraftAnswers({})
          setScreen('domain')
        }}
        onSubmit={submitAssessment}
      />
    )
  }

  if (screen === 'result' && feedback && assessment) {
    const breakdown = assessment.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      skill: question.skill,
      chosen: submittedAnswers[question.id] ?? '',
      correctAnswer: question.answer,
      correct: submittedAnswers[question.id] === question.answer,
    }))
    return (
      <AssessmentResult
        {...feedback}
        breakdown={breakdown}
        onNext={() => {
          if (reviewQuestions.length > 0) {
            setScreen('review')
          } else {
            clearAssessmentUi()
            setScreen('domain')
          }
        }}
        onDashboard={() => {
          clearAssessmentUi()
          setScreen('dashboard')
        }}
      />
    )
  }

  if (screen === 'review' && assessment && reviewQuestions.length > 0) {
    const question = reviewQuestions[reviewIndex]
    const reference = attemptReferences[question.id] ?? {
      timestamp: Date.now(),
      reviewStage: 0,
    }
    const firstPass: FirstPass = {
      chosen: submittedAnswers[question.id] ?? '',
      confidence: null,
      correct: false,
      timeMs: null,
      timedOut: false,
      struckChoices: [],
    }
    const progress = Math.round(((reviewIndex + 1) / reviewQuestions.length) * 100)

    return (
      <main className="adaptive-shell">
        <header className="adaptive-header">
          <button
            className="wordmark wordmark--button"
            type="button"
            onClick={() => {
              clearAssessmentUi()
              setScreen('dashboard')
            }}
            aria-label="Leave this review"
          >
            clarity<span>.</span>
          </button>
          <span className="adaptive-header__context">
            Missed-question review
          </span>
          <button
            className="link-button"
            type="button"
            onClick={() => {
              clearAssessmentUi()
              setScreen('dashboard')
            }}
          >
            Leave review
          </button>
        </header>

        <section className="question-progress" aria-label="Review progress">
          <div className="progress-copy">
            <span>Review - {reviewIndex + 1} of {reviewQuestions.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-value progress-value--review"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <article className="practice-card">
          <div className="question-meta">
            <span>{question.domain}</span>
            <span className="meta-dot" aria-hidden="true">•</span>
            <span>{question.skill}</span>
            <span className="difficulty">{question.difficulty}</span>
            {reviewFlaggedIds.includes(question.id) && (
              <span className="question-meta__flag">🚩 Flagged</span>
            )}
          </div>

          <QuestionInteraction
            key={`${assessment.id}:${question.id}`}
            question={question}
            isReview={false}
            firstPass={firstPass}
            reviewStage={reference.reviewStage}
            onComplete={(attempt) =>
              onRecordReview(
                attempt,
                reference,
                assessment.id,
                assessment.kind,
                assessment.level,
              )
            }
            onNext={() => {
              if (reviewIndex + 1 < reviewQuestions.length) {
                setReviewIndex((index) => index + 1)
              } else {
                clearAssessmentUi()
                setScreen('domain')
              }
            }}
          />
        </article>
      </main>
    )
  }

  if (screen === 'content-error' && contentFailure) {
    return (
      <ContentError
        skill={contentFailure.failure.skill}
        level={contentFailure.failure.level}
        available={contentFailure.failure.available}
        onRetry={() =>
          contentFailure.kind === 'diagnostic'
            ? startDiagnostic(contentFailure.domain)
            : contentFailure.kind === 'skill' && contentFailure.skill
            ? startSkill(contentFailure.domain, contentFailure.skill)
            : startCheckpoint(contentFailure.domain)
        }
        onDashboard={() => setScreen('dashboard')}
      />
    )
  }

  if (screen === 'domain') {
    const domain = progression.domains[selectedDomain]
    const level = domain.unlockedLevel
    const checkpoint =
      level === 'Noobie'
        ? null
        : domain.checkpoints[level]
    const skillViews: SkillCardView[] = taxonomy[selectedDomain].map((skillName) => {
      const skill = domain.skills[skillName]
      const practiceLevel = getSkillPracticeLevel(
        progression,
        selectedDomain,
        skillName,
      )
      return {
        name: skillName,
        completed: skill.levels[level].completed,
        practiceLevel,
        remediation: skill.remediation !== null,
        checkpointRepair: checkpoint?.repairSkills.includes(skillName) ?? false,
        attemptCount: Object.values(skill.levels).reduce(
          (count, progress) => count + progress.attempts.length,
          0,
        ),
        hasLesson: getSkillLessonSummary(skillName) !== null,
        lessonSeen: hasSeenLesson(skillName),
      }
    })
    const checkpointView: CheckpointView | null =
      level === 'Noobie'
        ? null
        : {
            level,
            status:
              checkpoint!.repairSkills.length > 0
                ? 'repair-required'
                : canStartCheckpoint(progression, selectedDomain, level)
                  ? 'ready'
                  : 'locked',
            attempts: checkpoint!.attempts.length,
            repairSkills: checkpoint!.repairSkills,
          }

    return (
      <DomainPath
        domain={selectedDomain}
        currentLevel={level}
        characterStage={domain.characterStage}
        entryLevel={domain.entryLevel}
        skills={skillViews}
        checkpoint={checkpointView}
        finished={domain.finished}
        diagnosticComplete={domain.diagnostic.completedAt !== null}
        diagnosticAttempts={domain.diagnostic.attempts.length}
        onBack={() => setScreen('dashboard')}
        onStartSkill={(skill) => startSkill(selectedDomain, skill)}
        onOpenLesson={openLessonReread}
        onStartDiagnostic={() => startDiagnostic(selectedDomain)}
        onStartCheckpoint={() => startCheckpoint(selectedDomain)}
      />
    )
  }

  const cards: DomainCardView[] = SAT_DOMAINS.map((domainName) => {
    const domain = progression.domains[domainName]
    const level = domain.unlockedLevel
    const skills = taxonomy[domainName]
    const completed = skills.filter(
      (skill) => domain.skills[skill].levels[level].completed,
    ).length
    let checkpointStatus = 'Not unlocked'
    if (domain.finished) {
      checkpointStatus = 'Master passed'
    } else if (level !== 'Noobie') {
      const checkpoint = domain.checkpoints[level]
      checkpointStatus =
        checkpoint.repairSkills.length > 0
          ? `${checkpoint.repairSkills.length} ${
              checkpoint.repairSkills.length === 1 ? 'repair' : 'repairs'
            }`
          : canStartCheckpoint(progression, domainName, level)
            ? 'Ready'
            : `${skills.length - completed} ${
                skills.length - completed === 1 ? 'skill' : 'skills'
              } to go`
    }
    return {
      domain: domainName,
      characterStage: domain.characterStage,
      currentLevel: level,
      completedSkills: completed,
      totalSkills: skills.length,
      checkpointStatus,
      recommended: progression.recommendedDomain === domainName,
      chosen: progression.selectedDomain === domainName,
      finished: domain.finished,
    }
  })
  const recommendedLessonDomainName =
    progression.recommendedDomain ?? progression.selectedDomain
  const recommendedLessonDomain = recommendedLessonDomainName
    ? progression.domains[recommendedLessonDomainName]
    : null
  const recommendedLessonSkill = recommendedLessonDomain
    ? Object.keys(recommendedLessonDomain.skills).find((skill) => {
        const level = getSkillPracticeLevel(
          progression,
          recommendedLessonDomainName!,
          skill,
        )
        return !recommendedLessonDomain.skills[skill].levels[level].completed
      }) ?? Object.keys(recommendedLessonDomain.skills)[0] ?? null
    : null
  const pendingLessonSummary = pendingLesson
    ? getSkillLessonSummary(pendingLesson.skill)
    : null
  const lessonsPanel =
    pendingLesson && pendingLessonSummary ? (
      <SkillLesson
        embedded
        key={pendingLesson.skill}
        summary={pendingLessonSummary}
        eyebrow={pendingLesson.next ? undefined : 'Lesson refresher'}
        finishLabel={
          pendingLesson.next
            ? 'Start the mini quiz'
            : pendingLesson.origin === 'lessons'
              ? 'Back to all lessons'
              : 'Back to the skill path'
        }
        onFinish={() => {
          markLessonSeen(
            pendingLesson.gatedSkill ?? pendingLesson.skill,
          )
          const next = pendingLesson.next
          const origin = pendingLesson.origin
          setPendingLesson(null)
          if (next) {
            openAssessment(next)
          } else {
            setScreen(origin)
          }
        }}
        onExit={() => {
          const origin = pendingLesson.origin
          setPendingLesson(null)
          setScreen(origin)
        }}
      />
    ) : (
      <LessonLibrary
        recommendedSkill={recommendedLessonSkill}
        hall={lessonHall}
        onHallChange={setLessonHall}
        onSelectSkill={(skill) => openLessonReread(skill, 'lessons')}
        onBack={() => openPrimaryView(onOpenPractice)}
      />
    )
  const shellActiveView =
    screen === 'lesson' || screen === 'lessons'
      ? 'lessons'
      : primaryView

  function openPrimaryView(action: () => void) {
    setPendingLesson(null)
    setLessonHall(null)
    setScreen('dashboard')
    action()
  }

  return (
    <ProgressDashboard
      activeView={shellActiveView}
      lessonsPanel={lessonsPanel}
      reviewsPanel={reviewsPanel}
      libraryPanel={libraryPanel}
      insightsPanel={insightsPanel}
      cards={cards}
      dueCount={dueCount}
      onSelectDomain={chooseDomain}
      onUpdateScore={() => setIsUpdatingScore(true)}
      onOpenPractice={() => openPrimaryView(onOpenPractice)}
      onOpenLessons={() => openPrimaryView(onOpenLessons)}
      onOpenReviews={() => openPrimaryView(onOpenReviews)}
      onOpenLibrary={() => openPrimaryView(onOpenLibrary)}
      onOpenInsights={() => openPrimaryView(onOpenInsights)}
    />
  )
}

