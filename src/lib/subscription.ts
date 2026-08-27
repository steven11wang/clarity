import type { User } from '@supabase/supabase-js'

import { supabase } from './supabase.ts'

export type SubscriptionStatus =
  | 'none'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

export type PlanId = 'pro' | 'pro_max'

export type SubscriptionRecord = {
  status: SubscriptionStatus
  plan: PlanId | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export type AccessState = {
  allowed: boolean
  subscription: SubscriptionRecord | null
}

/** Statuses Stripe uses while money is either flowing or promised. Everything
 *  else is locked out. Kept identical to public.has_active_subscription(). */
const PAID_STATUSES: SubscriptionStatus[] = ['trialing', 'active']

/** Absorbs webhook retry lag around a renewal: a period that has just rolled
 *  over must not lock a paying user out before Stripe's event lands. */
const GRACE_MS = 2 * 24 * 60 * 60 * 1000

export function grantsAccess(subscription: SubscriptionRecord | null): boolean {
  if (!subscription) return false
  if (!PAID_STATUSES.includes(subscription.status)) return false
  if (!subscription.currentPeriodEnd) return true
  const end = Date.parse(subscription.currentPeriodEnd)
  if (Number.isNaN(end)) return true
  return end > Date.now() - GRACE_MS
}

export type Plan = {
  id: PlanId
  name: string
  zh: string
  price: string
  cadence: string
  line: string
  features: string[]
  paymentLink: string
  highlight: boolean
}

/** Mirrors the public plans sheet in plans.html. Keep the two in step. */
export const PLANS: Plan[] = [
  {
    id: 'pro',
    name: 'Pro',
    zh: '进阶',
    price: '$79',
    cadence: 'Per month, after the trial',
    line: 'For the season when a test date is actually on the calendar.',
    features: [
      'The paced path through every domain and skill',
      'The full question bank, not a sample set',
      'Full length practice exams, timed the way the real one is',
      'The return loop: misses rescheduled on the forgetting curve',
      'Dictionary lookups saved with the sentence that taught them',
      'Your error log, timed mode and score tracking',
    ],
    paymentLink: 'https://buy.stripe.com/7sYbJ1cko0dWalHakz1Jm00',
    highlight: true,
  },
  {
    id: 'pro_max',
    name: 'Pro Max',
    zh: '臻享',
    price: '$668',
    cadence: 'Per month, after the trial',
    line: 'For intensive 1-on-1 preparation with Ivy League student mentors.',
    features: [
      'Everything in Pro',
      'Ivy League college student tutoring and 1-on-1 strategy sessions',
      'Personalized study roadmaps and weekly check-ins',
      'Every exam in the library, as each one is added',
      'Adaptive drills built from your own error log',
      'Word bank export and priority expert support',
    ],
    paymentLink: 'https://buy.stripe.com/dRmbJ10BG3q88dz2S71Jm03',
    highlight: false,
  },
]

/** client_reference_id is what lets the Stripe webhook attach the payment to
 *  this account; without it a completed checkout cannot be matched to a user. */
export function checkoutUrl(plan: Plan, user: { id: string; email?: string | null }): string {
  const url = new URL(plan.paymentLink)
  url.searchParams.set('client_reference_id', user.id)
  if (user.email) url.searchParams.set('prefilled_email', user.email)
  return url.toString()
}

export async function fetchAccess(user: User): Promise<AccessState> {
  if (!supabase) return { allowed: true, subscription: null }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status,plan,current_period_end,cancel_at_period_end')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return { allowed: false, subscription: null }

  const subscription: SubscriptionRecord = {
    status: data.status as SubscriptionStatus,
    plan: (data.plan as PlanId | null) ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
  }

  return { allowed: grantsAccess(subscription), subscription }
}
