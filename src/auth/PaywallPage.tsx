import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import {
  PLANS,
  checkoutUrl,
  type Plan,
  type SubscriptionRecord,
} from '../lib/subscription.ts'
import './paywallPage.css'

export type PaywallPageProps = {
  user: User
  subscription: SubscriptionRecord | null
  /** Re-reads the subscription row; resolves true once access is granted. */
  onRecheck: () => Promise<boolean>
  onSignOut: () => void
  error?: string | null
}

/** Stripe needs a moment to deliver the webhook after checkout, so a learner
 *  coming back from payment is held on a confirming screen rather than being
 *  shown the paywall they just cleared. */
const POLL_INTERVAL_MS = 2500
const POLL_ATTEMPTS = 16

function returnedFromCheckout(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('checkout') === 'success'
}

function clearCheckoutParam() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('checkout')
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash)
}

function statusNotice(subscription: SubscriptionRecord | null): string | null {
  if (!subscription) return null
  switch (subscription.status) {
    case 'past_due':
    case 'unpaid':
      return 'Your last payment did not go through, so the dashboard is locked. Update your card in Stripe and it reopens straight away.'
    case 'canceled':
      return 'Your plan has ended. Pick one below to pick up exactly where you stopped — your progress is still here.'
    case 'paused':
      return 'Your plan is paused. Resume it to open the dashboard again.'
    case 'incomplete':
    case 'incomplete_expired':
      return 'That checkout was never finished. Start it again below.'
    default:
      return null
  }
}

export function PaywallPage({
  user,
  subscription,
  onRecheck,
  onSignOut,
  error = null,
}: PaywallPageProps) {
  const [confirming, setConfirming] = useState(returnedFromCheckout)
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!confirming) return
    let active = true
    let attempts = 0

    const tick = async () => {
      attempts += 1
      const granted = await onRecheck().catch(() => false)
      if (!active || granted) return
      if (attempts >= POLL_ATTEMPTS) {
        setConfirming(false)
        clearCheckoutParam()
        setNotice(
          'Payment received, but it has not reached your account yet. This usually clears within a minute — use "I have already paid" below to check again.',
        )
        return
      }
      timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS)
    }

    let timer = window.setTimeout(() => void tick(), 800)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [confirming, onRecheck])

  async function handleRecheck() {
    setNotice(null)
    setChecking(true)
    const granted = await onRecheck().catch(() => false)
    setChecking(false)
    if (!granted) {
      setNotice(
        'No active plan on this account yet. If you just paid, give Stripe a few seconds and try again.',
      )
    }
  }

  if (confirming) {
    return (
      <main className="paywall-root paywall-root--centered" aria-live="polite">
        <div className="paywall-confirming">
          <span className="paywall-wordmark">clarity<span>.</span></span>
          <p>Confirming your payment with Stripe…</p>
          <p className="paywall-confirming-note">This takes a few seconds. Do not close the tab.</p>
        </div>
      </main>
    )
  }

  const lockNotice = notice ?? statusNotice(subscription)

  return (
    <main className="paywall-root">
      <header className="paywall-header">
        <span className="paywall-wordmark">clarity<span>.</span></span>
        <div className="paywall-account">
          <span className="paywall-email">{user.email}</span>
          <button type="button" className="paywall-link-btn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="paywall-intro">
        <p className="paywall-eyebrow">Plans</p>
        <h1>Start where you are</h1>
        <p className="paywall-lede">
          You are signed in. Choose a plan to open the dashboard — both start with a{' '}
          <b>3 day free trial</b>, and cancelling inside the app before day three costs nothing.
        </p>
      </section>

      {error && <p className="paywall-alert paywall-alert--error" role="alert">{error}</p>}
      {lockNotice && <p className="paywall-alert" role="status">{lockNotice}</p>}

      <section className="paywall-grid">
        {PLANS.map((plan: Plan) => (
          <article
            key={plan.id}
            className={plan.highlight ? 'paywall-plan paywall-plan--lift' : 'paywall-plan'}
          >
            <h2 className="paywall-plan-name">
              {plan.name} <span className="paywall-zh">{plan.zh}</span>
            </h2>
            <p className="paywall-plan-price">
              <b>{plan.price}</b> <span>{plan.cadence}</span>
            </p>
            <p className="paywall-plan-line">{plan.line}</p>
            <ul className="paywall-plan-list">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <a
              className={
                plan.highlight ? 'paywall-cta paywall-cta--solid' : 'paywall-cta'
              }
              href={checkoutUrl(plan, user)}
            >
              Start 3 day trial <i>&rarr;</i>
            </a>
          </article>
        ))}
      </section>

      <footer className="paywall-foot">
        <button
          type="button"
          className="paywall-link-btn"
          onClick={() => void handleRecheck()}
          disabled={checking}
        >
          {checking ? 'Checking…' : 'I have already paid — check again'}
        </button>
        <span className="paywall-foot-sep">·</span>
        <a href="/">Back to the site</a>
      </footer>
    </main>
  )
}
