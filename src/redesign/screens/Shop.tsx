// The drops shop: 10 water drops to the dollar, four packs, and the rules on
// the page where the money is: what drops buy (in drops and dollars), what is
// never sold, who has to pay for a student under 18, and how much is left of
// this month's limit. Checkout asks who is paying before it shows a price.

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Copy, Lock, Share2, ShieldCheck, X } from 'lucide-react'

import { CORRECTION_TAPE_PRICE, OUTFITS, REWARDS } from '../game/content.ts'
import {
  DROPS_PER_DOLLAR,
  MONTHLY_LIMIT_CENTS,
  PACKS,
  applyPurchases,
  bonusPercent,
  canAfford,
  checkoutUrl,
  dollars,
  dropsInDollars,
  fetchLivePurchases,
  paymentsMode,
  recordTestPurchase,
  spentThisMonth,
  type Pack,
} from '../game/payments.ts'
import { getGame, updateGame, useGame } from '../game/store.ts'
import { go } from '../router.ts'
import { play } from '../sound.ts'
import { GameShell } from '../components/GameShell.tsx'
import { InkGlyph, TapeGlyph } from '../components/Glyphs.tsx'
import { useCountUp } from '../components/hooks.ts'
import { FounderCode } from '../components/FounderCode.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'

/** A drop, a cup, a bottle, a jug — the bigger the pack, the fuller the vessel. */
function Vessel({ id }: { id: Pack['id'] }) {
  const line = { stroke: '#17183B', strokeWidth: 3, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <svg viewBox="0 0 80 96" width="80" height="96" aria-hidden="true">
      {id === 'splash' && (
        <>
          <path d="M40 18 C40 18 22 42 22 56 A18 18 0 0 0 58 56 C58 42 40 18 40 18Z" fill="#4CC9FF" stroke="#17183B" strokeWidth="3" strokeLinejoin="round" />
          <path d="M31 58 A9 9 0 0 0 37 66" stroke="#FBFCFF" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
      {id === 'cup' && (
        <>
          <path d="M20 46 L60 46 L55 84 L25 84Z" fill="#4CC9FF" />
          <path d="M16 28 L64 28 L56 86 L24 86Z" {...line} />
          <path d="M20 46 Q30 42 40 46 T60 46" stroke="#17183B" strokeWidth="2" fill="none" />
        </>
      )}
      {id === 'bottle' && (
        <>
          <path d="M26 48 L54 48 L54 82 Q54 88 48 88 L32 88 Q26 88 26 82Z" fill="#4CC9FF" />
          <path d="M34 8 H46 V22 Q56 28 56 40 V82 Q56 90 48 90 H32 Q24 90 24 82 V40 Q24 28 34 22Z" {...line} />
          <rect x="33" y="4" width="14" height="8" rx="2" fill="#FF6FB1" stroke="#17183B" strokeWidth="3" />
        </>
      )}
      {id === 'jug' && (
        <>
          <path d="M18 36 L58 36 L58 82 Q58 88 52 88 L24 88 Q18 88 18 82Z" fill="#4CC9FF" />
          <path d="M14 16 H54 L62 24 V84 Q62 90 56 90 H20 Q14 90 14 84Z" {...line} />
          <path d="M62 34 Q76 34 76 48 Q76 62 62 62" {...line} />
          <path d="M18 36 Q28 32 38 36 T58 36" stroke="#17183B" strokeWidth="2" fill="none" />
        </>
      )}
    </svg>
  )
}

const EARN = [
  { label: 'Right first time', drops: REWARDS.firstTryInk },
  { label: 'Comeback beaten', drops: REWARDS.comebackInk },
  { label: 'Perfect page', drops: REWARDS.perfectInk },
  { label: 'Daily quest', drops: 3 },
  { label: 'Full weekly stamp card', drops: 12 },
  { label: 'Practice test sat', drops: 8 },
]

export function Shop({ packParam = null, paid = false }: { packParam?: string | null; paid?: boolean }) {
  const game = useGame()
  const mode = paymentsMode()
  const [open, setOpen] = useState<Pack | null>(() => PACKS.find((pack) => pack.id === packParam) ?? null)
  const [waiting, setWaiting] = useState(paid)
  const balance = useCountUp(game.ink)
  const purchases = game.purchases ?? []
  const spent = spentThisMonth(purchases)

  // back from Stripe: the webhook may take a few seconds, so look a few times
  useEffect(() => {
    if (!paid) return
    let tries = 0
    const timer = window.setInterval(async () => {
      tries += 1
      const rows = await fetchLivePurchases()
      const before = getGame().purchases?.length ?? 0
      updateGame((state) => applyPurchases(state, rows))
      if ((getGame().purchases?.length ?? 0) > before || tries >= 10) {
        window.clearInterval(timer)
        setWaiting(false)
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [paid])

  return (
    <GameShell active="me">
      <div className="shop">
        <header className="shop__head">
          <div>
            <h1 className="display">Water drops</h1>
            <p>
              <b>10 drops = $1.</b> Earn them by playing, or top up. Drops buy outfits for 汤圆 and correction tape for your streak.
            </p>
          </div>
          <div className="shop__balance sheet" aria-live="polite">
            <InkGlyph size={40} />
            <span className="display num">{balance}</span>
            <span className="shop__worth">drops · worth {dropsInDollars(game.ink)}</span>
          </div>
        </header>

        {waiting && (
          <p className="shop__notice" role="status">
            Payment received. Your drops arrive as soon as Stripe confirms it — usually a few seconds.
          </p>
        )}
        {mode === 'preview' && (
          <p className="shop__notice shop__notice--preview">
            <ShieldCheck size={18} /> Preview checkout: payments aren’t connected on this server, so buying here adds drops without charging anything. Receipts say TEST.
          </p>
        )}

        <ol className="packs" aria-label="Drop packs">
          {PACKS.map((pack) => {
            const bonus = bonusPercent(pack)
            const affordable = canAfford(pack, purchases)
            return (
              <li key={pack.id} className={`pack-card ${pack.id === 'jug' ? 'is-best' : ''}`}>
                {pack.id === 'jug' && <span className="pack-card__flag">Most drops per dollar</span>}
                <Vessel id={pack.id} />
                <h2 className="title">{pack.name}</h2>
                <p className="pack-card__drops">
                  <InkGlyph size={22} /> <b className="display num">{pack.drops}</b> drops
                </p>
                <p className="pack-card__math">
                  {pack.drops - Math.round((pack.cents / 100) * DROPS_PER_DOLLAR) > 0
                    ? `${Math.round((pack.cents / 100) * DROPS_PER_DOLLAR)} + ${pack.drops - Math.round((pack.cents / 100) * DROPS_PER_DOLLAR)} bonus`
                    : 'Base rate'}
                  {bonus > 0 && <span className="tag pack-card__bonus">+{bonus}%</span>}
                </p>
                <button type="button" className="btn btn--block" disabled={!affordable} onClick={() => setOpen(pack)}>
                  {affordable ? `Buy for ${dollars(pack.cents)}` : 'Over this month’s limit'}
                </button>
              </li>
            )
          })}
        </ol>

        <div className="shop__duo">
          <section className="shop__panel sheet" aria-labelledby="buys-title">
            <h2 className="title" id="buys-title">
              What drops buy
            </h2>
            <ul className="price-list">
              {OUTFITS.filter((outfit) => outfit.price > 0).map((outfit) => (
                <li key={outfit.id}>
                  <Tangyuan outfit={outfit.id} size={36} idle={false} />
                  <span>{outfit.name}</span>
                  <span className="num">
                    {outfit.price} drops · {dropsInDollars(outfit.price)}
                  </span>
                </li>
              ))}
              <li>
                <TapeGlyph size={30} />
                <span>Correction tape (saves a missed streak day)</span>
                <span className="num">
                  {CORRECTION_TAPE_PRICE} drops · {dropsInDollars(CORRECTION_TAPE_PRICE)}
                </span>
              </li>
            </ul>
          </section>

          <section className="shop__panel sheet" aria-labelledby="earn-title">
            <h2 className="title" id="earn-title">
              Or earn them free
            </h2>
            <ul className="price-list price-list--earn">
              {EARN.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <span className="num">+{item.drops}</span>
                </li>
              ))}
            </ul>
            <p className="shop__fine">A page a day plus its quests comes to roughly 10 drops.</p>
          </section>
        </div>

        <FounderCode />

        <section className="rules sheet" aria-labelledby="rules-title">
          <h2 className="title" id="rules-title">
            The rules on money
          </h2>
          <ul>
            <li>
              <Lock size={16} /> <b>Never for sale:</b> sticker packs, XP, stars, levels, questions, explanations or anything that helps you score. Learning is free.
            </li>
            <li>
              <ShieldCheck size={16} /> <b>Under 18?</b> A parent or guardian pays. Checkout asks first, and can send them a link.
            </li>
            <li>
              <InkGlyph size={16} /> <b>Every price shows dollars too.</b> Bought drops never expire.
            </li>
          </ul>
          <div className="limit">
            <span>
              This month: <b className="num">{dollars(spent)}</b> of {dollars(MONTHLY_LIMIT_CENTS)} limit
            </span>
            <span className="meter meter--thick" style={{ ['--value' as string]: spent / MONTHLY_LIMIT_CENTS }}>
              <span />
            </span>
          </div>
        </section>

        {purchases.length > 0 && (
          <section className="receipts" aria-labelledby="receipts-title">
            <h2 className="title" id="receipts-title">
              Receipts
            </h2>
            <ol>
              {[...purchases].reverse().map((purchase) => (
                <li key={purchase.id} className={purchase.status === 'refunded' ? 'is-refunded' : ''}>
                  <span>{new Date(purchase.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span>{PACKS.find((pack) => pack.id === purchase.packId)?.name ?? 'Drops'}</span>
                  <span className="num">+{purchase.drops} drops</span>
                  <span className="num">{dollars(purchase.cents)}</span>
                  <span className={`tag tag--xs ${purchase.mode === 'test' ? 'tag--quiet' : ''}`}>{purchase.status === 'refunded' ? 'refunded' : purchase.mode === 'test' ? 'TEST' : 'paid'}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      {open && <Checkout pack={open} onClose={() => setOpen(null)} />}
    </GameShell>
  )
}

// ---------------------------------------------------------------------------

type Step = 'who' | 'minor' | 'review' | 'signin' | 'done'

function Checkout({ pack, onClose }: { pack: Pack; onClose: () => void }) {
  const game = useGame()
  const mode = paymentsMode()
  const [step, setStep] = useState<Step>('who')
  const [copied, setCopied] = useState(false)
  const [payer, setPayer] = useState<'parent' | 'adult' | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const base = Math.round((pack.cents / 100) * DROPS_PER_DOLLAR)
  const remaining = MONTHLY_LIMIT_CENTS - spentThisMonth(game.purchases)
  const link = `${window.location.origin}/redesign.html#/shop?pack=${pack.id}`

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('button, a')?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, onClose])

  const pay = () => {
    if (mode === 'stripe') {
      if (game.account?.kind !== 'cloud' || !game.account.userId) {
        setStep('signin')
        return
      }
      window.location.href = checkoutUrl(pack, game.account.userId, game.account.email)
      return
    }
    updateGame((state) => recordTestPurchase(state, pack))
    play('holo')
    setStep('done')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      /* the link is on screen to copy by hand */
    }
  }

  return (
    <div className="checkout" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="checkout__card sheet" ref={box}>
        <button type="button" className="checkout__close" onClick={onClose} aria-label="Close checkout">
          <X size={20} />
        </button>
        <div className="checkout__pack">
          <Vessel id={pack.id} />
          <div>
            <h2 className="title" id="checkout-title">
              {pack.name} · {pack.drops} drops
            </h2>
            <p className="num">{dollars(pack.cents)}</p>
          </div>
        </div>

        {step === 'who' && (
          <div className="checkout__step">
            <p className="checkout__q">Who’s paying?</p>
            <button type="button" className="answer-pill" onClick={() => (setPayer('parent'), setStep('review'))}>
              <b>I’m a parent or guardian</b>
              <span>paying for a student’s account</span>
            </button>
            <button type="button" className="answer-pill" onClick={() => (setPayer('adult'), setStep('review'))}>
              <b>I’m 18 or older</b>
              <span>and this is my own account</span>
            </button>
            <button type="button" className="answer-pill answer-pill--quiet" onClick={() => setStep('minor')}>
              <b>I’m under 18</b>
              <span>send a parent the link</span>
            </button>
          </div>
        )}

        {step === 'minor' && (
          <div className="checkout__step">
            <p className="checkout__q">Ask a parent or guardian</p>
            <p>Send them this link. They open it, sign in to your account, and pay. Nothing is charged until they do.</p>
            <code className="checkout__link">{link}</code>
            <div className="checkout__row">
              <button type="button" className="btn btn--sm btn--paper" onClick={copy}>
                {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy link'}
              </button>
              <button
                type="button"
                className="btn btn--sm btn--hl"
                onClick={() => {
                  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
                  if (nav.share) void nav.share({ title: 'Clarity drops', text: `Could you buy ${pack.drops} drops (${dollars(pack.cents)}) for my Clarity account?`, url: link }).catch(() => {})
                  else void copy()
                }}
              >
                <Share2 /> Share
              </button>
            </div>
          </div>
        )}

        {step === 'signin' && (
          <div className="checkout__step">
            <p className="checkout__q">Sign in first</p>
            <p>Bought drops are kept on an account, so they can’t be lost with a browser. Sign in, then come back to the shop.</p>
            <button type="button" className="btn btn--lg btn--block" onClick={() => go('/signin')}>
              Sign in <ArrowRight />
            </button>
          </div>
        )}

        {step === 'review' && (
          <div className="checkout__step">
            <table className="checkout__table">
              <tbody>
                <tr>
                  <th>Drops</th>
                  <td className="num">
                    {pack.drops}
                    {pack.drops > base && <span className="checkout__muted"> ({base} + {pack.drops - base} bonus)</span>}
                  </td>
                </tr>
                <tr>
                  <th>Price</th>
                  <td className="num">{dollars(pack.cents)} USD, plus tax where it applies</td>
                </tr>
                <tr>
                  <th>Paid by</th>
                  <td>{payer === 'parent' ? 'A parent or guardian' : 'Account holder, 18+'}</td>
                </tr>
                <tr>
                  <th>Left this month</th>
                  <td className="num">{dollars(remaining - pack.cents)} after this</td>
                </tr>
              </tbody>
            </table>
            <p className="checkout__fine">One-time payment, not a subscription. Bought drops never expire. Unused drops can be refunded within 14 days of purchase.</p>
            <button type="button" className="btn btn--lg btn--block" onClick={pay}>
              {mode === 'stripe' ? `Pay ${dollars(pack.cents)} with Stripe` : `Complete test purchase (no charge)`} <ArrowRight />
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="checkout__step checkout__done">
            <Tangyuan size={96} mood="wow" outfit={game.outfit} />
            <p className="display num">+{pack.drops}</p>
            <p>drops added. The receipt says TEST — nothing was charged.</p>
            <div className="checkout__row">
              <button type="button" className="btn" onClick={() => go('/me')}>
                Go to the wardrobe <ArrowRight />
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Back to the shop
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
