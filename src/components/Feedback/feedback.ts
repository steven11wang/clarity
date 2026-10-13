import { isSupabaseConfigured, supabase } from '../../lib/supabase.ts'

export const FEEDBACK_MAX_LENGTH = 4000
const OUTBOX_KEY = 'clarity-feedback-outbox'

export type FeedbackReport = {
  message: string
  view: string
  userId: string | null
  email: string | null
  displayName: string | null
}

export type FeedbackResult = { ok: true; saved: 'cloud' | 'device' } | { ok: false; error: string }

/** Where the learner was when they wrote it, so a report can be reproduced. */
function context() {
  if (typeof window === 'undefined') return { page_url: null, user_agent: null, viewport: null }
  return {
    page_url: window.location.pathname + window.location.search,
    user_agent: window.navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  }
}

/** Signed-in learners write to the feedback table. Offline (no Supabase) the
 *  note is kept on this device instead, so nothing typed is silently dropped. */
export async function sendFeedback(report: FeedbackReport): Promise<FeedbackResult> {
  const message = report.message.trim()
  if (!message) return { ok: false, error: 'Please describe the issue first.' }
  if (message.length > FEEDBACK_MAX_LENGTH) {
    return { ok: false, error: `Please keep it under ${FEEDBACK_MAX_LENGTH} characters.` }
  }

  const row = {
    message,
    view: report.view,
    email: report.email,
    display_name: report.displayName,
    ...context(),
  }

  if (isSupabaseConfigured && supabase && report.userId) {
    const { error } = await supabase.from('feedback').insert({ ...row, user_id: report.userId })
    if (error) return { ok: false, error: 'Could not send that. Please try again in a moment.' }
    return { ok: true, saved: 'cloud' }
  }

  try {
    const saved = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? '[]') as unknown[]
    saved.push({ ...row, created_at: new Date().toISOString() })
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(saved))
    return { ok: true, saved: 'device' }
  } catch {
    return { ok: false, error: 'Could not save that on this device.' }
  }
}
