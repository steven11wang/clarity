import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import {
  PLANS,
  checkoutUrl,
  findPromoOffer,
  forgetPromoCode,
  normalisePromoCode,
  rememberPromoCode,
  storedPromoCode,
  type Plan,
  type PromoOffer,
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

function Seal() {
  return (
    <svg className="paywall-seal" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="#B3382B" />
      <g fill="none" stroke="#F7F1E6" strokeWidth="2.6">
        <rect x="6" y="6" width="20" height="20" />
        <rect x="13" y="13" width="6" height="6" />
      </g>
    </svg>
  )
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

  // A code may already be parked from the advert link the learner arrived on,
  // in which case the offer is simply on when the sheet loads.
  const [appliedCode, setAppliedCode] = useState<string | null>(() => {
    const stored = storedPromoCode()
    return findPromoOffer(stored) ? stored : null
  })
  const [codeDraft, setCodeDraft] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)

  const offer: PromoOffer | null = useMemo(() => findPromoOffer(appliedCode), [appliedCode])

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

  function handleApplyCode(event: React.FormEvent) {
    event.preventDefault()
    const code = normalisePromoCode(codeDraft)
    if (!code) return
    if (!findPromoOffer(code)) {
      setCodeError('That code is not one of ours, or it has expired.')
      return
    }
    rememberPromoCode(code)
    setAppliedCode(code)
    setCodeDraft('')
    setCodeError(null)
  }

  function handleRemoveCode() {
    forgetPromoCode()
    setAppliedCode(null)
    setCodeError(null)
  }

  if (confirming) {
    return (
      <main className="paywall-root paywall-root--centered" aria-live="polite">
        <div className="paywall-confirming">
          <span className="paywall-brandmark">
            Clarity <Seal />
          </span>
          <p>Confirming your payment with Stripe…</p>
          <p className="paywall-confirming-note">This takes a few seconds. Do not close the tab.</p>
        </div>
      </main>
    )
  }

  const lockNotice = notice ?? statusNotice(subscription)

  return (
    <main className="paywall-root">
      <header className="paywall-masthead">
        <div className="paywall-wrap">
          <span className="paywall-brandmark">
            Clarity <Seal />
          </span>
          <div className="paywall-account">
            <span className="paywall-email">{user.email}</span>
            <button type="button" className="paywall-link-btn" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="paywall-head">
        <figure className="paywall-head-art">
          <img
            src="/brand/landing/hero-shanshui.jpg"
            width={1122}
            height={1402}
            alt=""
            aria-hidden="true"
          />
        </figure>
        <div className="paywall-wrap">
          <p className="paywall-mono paywall-head-eyebrow">Plans</p>
          <h1>
            Start where
            <br />
            you are
          </h1>
          <p className="paywall-lede">
            You are signed in. Choose a plan to open the dashboard. Both plans run the same loop —
            what changes is how long you need it for.
          </p>
          <p className="paywall-zh">先自悟，后见解。</p>
        </div>
      </section>

      <section className="paywall-plans">
        <div className="paywall-wrap">
          {error && (
            <p className="paywall-alert paywall-alert--error" role="alert">
              {error}
            </p>
          )}
          {lockNotice && (
            <p className="paywall-alert" role="status">
              {lockNotice}
            </p>
          )}

          <p className="paywall-trial">
            {offer ? (
              <>
                <span className="paywall-trial-tag">Code applied</span>
                <span>{offer.banner}</span>
              </>
            ) : (
              <>
                <span>Both plans open with a</span> <b>3 day free trial</b>{' '}
                <span>· cancel inside the app before day three and you are not charged</span>
              </>
            )}
          </p>

          <div className="paywall-grid">
            {PLANS.map((plan: Plan) => {
              const planOffer = offer && offer.appliesTo === plan.id ? offer : null
              return (
                <article
                  key={plan.id}
                  className={plan.highlight ? 'paywall-plan paywall-plan--lift' : 'paywall-plan'}
                >
                  <h2 className="paywall-plan-name">
                    {plan.name} <span className="paywall-zh-inline">{plan.zh}</span>
                    {planOffer && <span className="paywall-plan-flag">{appliedCode}</span>}
                  </h2>
                  <p className="paywall-plan-price">
                    <b>{planOffer ? planOffer.price : plan.price}</b>{' '}
                    <span>{planOffer ? planOffer.cadence : plan.cadence}</span>
                  </p>
                  {planOffer ? (
                    <p className="paywall-plan-line paywall-plan-line--offer">{planOffer.note}</p>
                  ) : (
                    <p className="paywall-plan-line">{plan.line}</p>
                  )}
                  <ul className="paywall-plan-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <p className="paywall-enter">
                    <a
                      className={
                        plan.highlight ? 'paywall-cta paywall-cta--solid' : 'paywall-cta'
                      }
                      href={checkoutUrl(plan, user, offer)}
                    >
                      {planOffer ? (
                        <>
                          Start for {planOffer.price} <i>&rarr;</i>
                        </>
                      ) : (
                        <>
                          Start 3 day trial <i>&rarr;</i>
                        </>
                      )}
                    </a>
                  </p>
                  <p className="paywall-plan-foot">
                    {planOffer
                      ? 'Month to month once the week is up. Stop the month your test is done.'
                      : plan.id === 'pro'
                        ? 'Month to month. Stop the month your test is done.'
                        : 'Month to month. Cancel or change plans anytime.'}
                  </p>
                </article>
              )
            })}
          </div>

          <div className="paywall-promo">
            {offer ? (
              <p className="paywall-promo-applied">
                <span className="paywall-mono">Code {appliedCode} is on this account.</span>{' '}
                <button type="button" className="paywall-link-btn" onClick={handleRemoveCode}>
                  Remove it
                </button>
              </p>
            ) : (
              <form className="paywall-promo-form" onSubmit={handleApplyCode}>
                <label className="paywall-mono" htmlFor="paywall-promo-code">
                  Have a promo code?
                </label>
                <div className="paywall-promo-row">
                  <input
                    id="paywall-promo-code"
                    name="promo-code"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="ENTER CODE"
                    value={codeDraft}
                    onChange={(event) => {
                      setCodeDraft(event.target.value)
                      setCodeError(null)
                    }}
                  />
                  <button type="submit" className="paywall-promo-apply" disabled={!codeDraft.trim()}>
                    Apply
                  </button>
                </div>
                {codeError && (
                  <p className="paywall-promo-error" role="alert">
                    {codeError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="paywall-note">
        <div className="paywall-wrap">
          <p>
            Not sure which one you need? Take Pro and run a section. The dashboard will show you
            where the misses cluster, and you can move up to Pro Max anytime for 1-on-1 tutoring.
          </p>
          <Seal />
        </div>
      </section>

      <footer className="paywall-foot">
        <div className="paywall-wrap">
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
        </div>
      </footer>
    </main>
  )
}
