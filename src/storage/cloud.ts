import type { User } from '@supabase/supabase-js'

import type { ProgressionState } from '../progression/model.ts'
import type { Level, SatDomain } from '../progression/config.ts'
import type { Attempt, ReviewItem } from '../types.ts'
import { supabase } from '../lib/supabase.ts'
import {
  getAttempts,
  getProgression,
  getReviews,
  replaceCloudState,
  type CloudState,
} from './index.ts'

function iso(milliseconds: number | null | undefined): string | null {
  return milliseconds == null ? null : new Date(milliseconds).toISOString()
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function restoreOrSeedCloudState(user: User): Promise<'restored' | 'seeded'> {
  if (!supabase) return 'seeded'

  const [snapshotResult, attemptsResult, reviewsResult] = await Promise.all([
    supabase
      .from('progression_snapshots')
      .select('state')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('question_attempts')
      .select('payload')
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: true }),
    supabase
      .from('review_queue')
      .select('question_id,payload')
      .eq('user_id', user.id),
  ])

  throwIfError(snapshotResult.error)
  throwIfError(attemptsResult.error)
  throwIfError(reviewsResult.error)

  const hasCloudData =
    Boolean(snapshotResult.data) ||
    Boolean(attemptsResult.data?.length) ||
    Boolean(reviewsResult.data?.length)

  if (!hasCloudData) {
    await syncCloudState(user)
    return 'seeded'
  }

  const reviews = Object.fromEntries(
    (reviewsResult.data ?? []).map((row) => [
      row.question_id,
      row.payload as unknown as ReviewItem,
    ]),
  )
  const state: CloudState = {
    progression:
      (snapshotResult.data?.state as unknown as ProgressionState | undefined) ?? null,
    attempts: (attemptsResult.data ?? []).map(
      (row) => row.payload as unknown as Attempt,
    ),
    reviews,
  }
  replaceCloudState(state)
  return 'restored'
}

export async function syncCloudState(user: User): Promise<void> {
  if (!supabase) return
  const nextSync = cloudSyncQueue
    .catch(() => undefined)
    .then(() => performCloudSync(user))
  cloudSyncQueue = nextSync
  return nextSync
}

let cloudSyncQueue: Promise<void> = Promise.resolve()

async function performCloudSync(user: User): Promise<void> {
  const progression = getProgression()
  const attempts = getAttempts()
  const reviews = Object.values(getReviews())

  await Promise.all([
    syncProgression(user.id, progression),
    syncAttempts(user.id, attempts),
    syncReviews(user.id, reviews),
  ])
}

async function syncProgression(userId: string, progression: ProgressionState | null) {
  if (!supabase) return
  if (!progression) {
    const deletes = await Promise.all([
      supabase.from('progression_snapshots').delete().eq('user_id', userId),
      supabase.from('domain_results').delete().eq('user_id', userId),
      supabase.from('score_reports').delete().eq('user_id', userId),
      supabase.from('skill_progress').delete().eq('user_id', userId),
      supabase.from('domain_progress').delete().eq('user_id', userId),
    ])
    deletes.forEach((result) => throwIfError(result.error))
    return
  }

  const snapshot = await supabase.from('progression_snapshots').upsert({
    user_id: userId,
    schema_version: progression.schemaVersion,
    revision: progression.revision,
    state: progression,
    updated_at: new Date().toISOString(),
  })
  throwIfError(snapshot.error)

  const report = await supabase
    .from('score_reports')
    .upsert(
      {
        user_id: userId,
        source_key: `onboarding:${progression.onboarding.confirmedAt}`,
        uploaded_at: iso(progression.onboarding.confirmedAt),
        file_name: progression.onboarding.screenshotName,
        parsing_status: 'confirmed',
      },
      { onConflict: 'user_id,source_key' },
    )
    .select('id')
    .single()
  throwIfError(report.error)

  const resultRows = Object.entries(progression.onboarding.results).map(
    ([domain, difficulty]) => ({
      user_id: userId,
      score_report_id: report.data!.id,
      domain,
      difficulty,
    }),
  )
  const resultsWrite = await supabase
    .from('domain_results')
    .upsert(resultRows, { onConflict: 'user_id,score_report_id,domain' })
  throwIfError(resultsWrite.error)

  const domainRows = Object.entries(progression.domains).map(([domain, state]) => ({
    user_id: userId,
    domain,
    entry_level: state.entryLevel,
    unlocked_level: state.unlockedLevel,
    character_stage: state.characterStage,
    checkpoint_status: state.checkpoints,
    finished: state.finished,
    updated_at: new Date().toISOString(),
  }))
  const domainsWrite = await supabase
    .from('domain_progress')
    .upsert(domainRows, { onConflict: 'user_id,domain' })
  throwIfError(domainsWrite.error)

  const skillRows = Object.entries(progression.domains).flatMap(
    ([domain, domainState]) =>
      Object.entries(domainState.skills).flatMap(([skill, skillState]) =>
        (Object.entries(skillState.levels) as Array<
          [Level, (typeof skillState.levels)[Level]]
        >).map(([level, levelState]) => ({
          user_id: userId,
          domain: domain as SatDomain,
          skill,
          level,
          completed: levelState.completed,
          completed_at: iso(levelState.completedAt),
          remediation: skillState.remediation,
          attempt_count: levelState.attempts.length,
          question_id_history: levelState.questionIdHistory,
          updated_at: new Date().toISOString(),
        })),
      ),
  )
  const skillsWrite = await supabase
    .from('skill_progress')
    .upsert(skillRows, { onConflict: 'user_id,domain,skill,level' })
  throwIfError(skillsWrite.error)
}

async function syncAttempts(userId: string, attempts: Attempt[]) {
  if (!supabase) return
  const deletion = await supabase.from('question_attempts').delete().eq('user_id', userId)
  throwIfError(deletion.error)
  const assessmentDeletion = await supabase.from('assessments').delete().eq('user_id', userId)
  throwIfError(assessmentDeletion.error)
  if (attempts.length === 0) return

  const assessmentGroups = new Map<string, Attempt[]>()
  attempts.forEach((attempt) => {
    if (!attempt.activityId) return
    const group = assessmentGroups.get(attempt.activityId) ?? []
    group.push(attempt)
    assessmentGroups.set(attempt.activityId, group)
  })

  const assessmentIds = new Map<string, string>()
  if (assessmentGroups.size > 0) {
    const assessmentWrite = await supabase
      .from('assessments')
      .insert(
        [...assessmentGroups].map(([sourceKey, group]) => {
          const [kind, domain, skillOrLevel, encodedLevel] = sourceKey.split(':')
          const level = (encodedLevel ?? skillOrLevel) || null
          return {
            user_id: userId,
            source_key: sourceKey,
            kind: kind === 'checkpoint' || kind === 'diagnostic' ? kind : 'skill',
            domain: domain || null,
            skill: kind === 'skill' ? skillOrLevel || null : null,
            level,
            score: group.filter((attempt) => attempt.correct).length,
            total: group.length,
            completed_at: iso(Math.max(...group.map((attempt) => attempt.timestamp))),
            metadata: {
              activityKind: group[0].activityKind,
              practiceLevel: group[0].practiceLevel,
            },
          }
        }),
      )
      .select('id,source_key')
    throwIfError(assessmentWrite.error)
    assessmentWrite.data?.forEach((row) => assessmentIds.set(row.source_key, row.id))
  }

  const rows = attempts.map((attempt) => ({
    user_id: userId,
    assessment_id: attempt.activityId
      ? assessmentIds.get(attempt.activityId) ?? null
      : null,
    question_id: attempt.questionId,
    attempted_at: iso(attempt.timestamp)!,
    chosen_answer: attempt.chosen,
    correct: attempt.correct,
    confidence: attempt.confidence,
    attempts_to_correct: attempt.attemptsToCorrect,
    payload: attempt,
  }))
  for (let offset = 0; offset < rows.length; offset += 500) {
    const write = await supabase.from('question_attempts').insert(rows.slice(offset, offset + 500))
    throwIfError(write.error)
  }
}

async function syncReviews(userId: string, reviews: ReviewItem[]) {
  if (!supabase) return
  const deletion = await supabase.from('review_queue').delete().eq('user_id', userId)
  throwIfError(deletion.error)
  if (reviews.length === 0) return

  const write = await supabase.from('review_queue').insert(
    reviews.map((review) => ({
      user_id: userId,
      question_id: review.questionId,
      due_at: iso(review.dueAt)!,
      stage: review.stage,
      reason: review.reason,
      clears: review.clears,
      payload: review,
      updated_at: new Date().toISOString(),
    })),
  )
  throwIfError(write.error)
}
