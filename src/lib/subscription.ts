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

/** A code-gated opening offer. The payment link behind one carries the same
 *  recurring price as the plan it replaces plus a one-off first-week charge, so
 *  Stripe rolls the learner onto the normal plan price by itself and neither the
 *  webhook nor the subscriptions table needs to know an offer existed. */
export type PromoOffer = {
  id: string
  /** Every code that opens this offer. Matched case and space insensitively,
   *  so one offer can carry a different code per advertising channel. */
  codes: string[]
  /** The plan column the offer takes over. */
  appliesTo: PlanId
  price: string
  cadence: string
  /** What happens when the promotional period ends. Stated on the card, because
   *  an offer that hides its renewal price is the reason people distrust them. */
  note: string
  banner: string
  paymentLink: string
}

export const PROMO_OFFERS: PromoOffer[] = [
  {
    id: 'first_week_9',
    codes: ['CLARITY9'],
    appliesTo: 'pro',
    price: '$9',
    cadence: 'For your first week',
    note: 'Then $79 a month, charged on day eight. Cancel inside the app before then and nothing more is taken.',
    banner: 'Your code opens Pro for a week at $9 · then the normal $79 a month, cancel anytime',
    paymentLink: 'https://buy.stripe.com/fZucN52JOe4M79vfET1Jm04',
  },
]

/** Codes are typed by hand off a poster or a video, so matching ignores case,
 *  spacing and the dashes people add on their own. */
export function normalisePromoCode(raw: string): string {
  return raw.replace(/[\s-]+/g, '').toUpperCase()
}

export function findPromoOffer(raw: string | null | undefined): PromoOffer | null {
  if (!raw) return null
  const code = normalisePromoCode(raw)
  if (!code) return null
  return (
    PROMO_OFFERS.find((offer) => offer.codes.some((candidate) => normalisePromoCode(candidate) === code)) ??
    null
  )
}

const PROMO_STORAGE_KEY = 'clarity-promo-code'

/** Sign-in leaves and re-enters the app through Google, which drops the query
 *  string, so a code arriving on an advert link is parked before that trip and
 *  read back on the paywall afterwards. */
export function capturePromoCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('code') ?? params.get('promo')
  if (!raw) return null
  if (!findPromoOffer(raw)) return null
  const code = normalisePromoCode(raw)
  try {
    window.localStorage.setItem(PROMO_STORAGE_KEY, code)
  } catch {
    // Private browsing: the code still applies for this page view.
  }
  return code
}

export function storedPromoCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(PROMO_STORAGE_KEY)
  } catch {
    return null
  }
}

export function rememberPromoCode(code: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PROMO_STORAGE_KEY, normalisePromoCode(code))
  } catch {
    // Nothing to do: the code stays applied for this page view only.
  }
}

export function forgetPromoCode() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PROMO_STORAGE_KEY)
  } catch {
    // Already gone as far as this browser is concerned.
  }
}

/** client_reference_id is what lets the Stripe webhook attach the payment to
 *  this account; without it a completed checkout cannot be matched to a user. */
export function checkoutUrl(
  plan: Plan,
  user: { id: string; email?: string | null },
  offer: PromoOffer | null = null,
): string {
  const link = offer && offer.appliesTo === plan.id ? offer.paymentLink : plan.paymentLink
  const url = new URL(link)
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
