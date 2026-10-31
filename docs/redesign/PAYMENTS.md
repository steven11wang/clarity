# Water drops: payments setup

10 drops = $1. Drops buy outfits for 汤圆 and correction tape (a streak saver). They
are also earned by playing. Learning itself stays free.

## What's built

| Piece | Where | State |
|---|---|---|
| Shop page, packs, rules, monthly limit, receipts | `src/redesign/screens/Shop.tsx` (`#/shop`) | working |
| Checkout that asks who's paying, with a parent-link path for under-18s | same file | working |
| Preview checkout (adds drops, charges nothing, receipt says TEST) | `src/redesign/game/payments.ts` | working — this is what runs today |
| Stripe Payment Link checkout + reading purchases back | `payments.ts`, `App.tsx` | written, switches on with the env vars below |
| Purchases table with row-level security | `supabase/migrations/202610300001_drop_purchases.sql` | written, **not applied** |
| Stripe webhook that records paid sessions and refunds | `supabase/functions/drops-webhook/index.ts` | written, **not deployed, not tested against Stripe** |

## Packs

| Pack | Price | Drops | Bonus over 10/$1 |
|---|---|---|---|
| Splash | $1.99 | 20 | — |
| Cup | $4.99 | 55 | +10% |
| Bottle | $9.99 | 120 | +20% |
| Jug | $19.99 | 260 | +30% |

Why no $0.99 / 10-drop pack: card processing is about 2.9% + 30¢ a sale, so a $1
sale loses roughly a third to fees. To add one anyway, add a row to `PACKS` in
`payments.ts` and a matching Stripe price.

## What things cost

| Item | Drops | Dollars |
|---|---|---|
| Reading specs | 15 | $1.50 |
| Streak headband | 20 | $2.00 |
| Gold hair clip | 25 | $2.50 |
| Study headphones | 35 | $3.50 |
| Night cap | 45 | $4.50 |
| Mortarboard | 60 | $6.00 |
| Correction tape | 10 | $1.00 |

Earning: +1 for a first-try right answer, +2 for a beaten comeback, +5 for a perfect
page, +2–4 per daily quest, +12 for a full weekly card, +8 for sitting a practice test.

**Never for sale:** sticker packs (they're random, so selling them would be a loot
box), XP, stars, levels, questions, explanations.

## Turning on real payments

1. **Stripe products.** In Stripe, create one product with four one-time prices
   ($1.99, $4.99, $9.99, $19.99). On each *price*, add metadata `pack` =
   `splash` / `cup` / `bottle` / `jug` and `drops` = `20` / `55` / `120` / `260`. The
   webhook reads the drops from Stripe, so the browser can never choose its own amount.
2. **Payment Links.** Make one Payment Link per price. Under *After payment*,
   redirect to `https://satclarity.com/redesign.html#/shop?paid=1`.
3. **App env** (`.env.local`):
   ```
   VITE_DROPS_LINK_SPLASH=https://buy.stripe.com/...
   VITE_DROPS_LINK_CUP=https://buy.stripe.com/...
   VITE_DROPS_LINK_BOTTLE=https://buy.stripe.com/...
   VITE_DROPS_LINK_JUG=https://buy.stripe.com/...
   ```
   With all four set and Supabase configured, the shop switches from preview to Stripe.
   Buying then requires a signed-in account, because drops are tied to it.
4. **Database:** review and apply `202610300001_drop_purchases.sql` (it reuses the
   `stripe_events` table and trigger function from the paywall migration).
5. **Webhook:** deploy `drops-webhook` with JWT verification off, set secrets
   `STRIPE_SECRET_KEY` and `STRIPE_DROPS_WEBHOOK_SECRET`, and point a Stripe webhook
   endpoint at it for `checkout.session.completed`,
   `checkout.session.async_payment_succeeded` and `charge.refunded`.
6. **Test in Stripe test mode first** with Stripe's published test cards, then switch
   the links and keys to live.

## Decisions for you

- **Refunds.** The checkout currently says unused drops can be refunded within 14
  days. That's a placeholder — set your real policy and publish a support contact.
- **Monthly limit.** $50 per account per month (`MONTHLY_LIMIT_CENTS`). It is checked
  in the browser; enforcing it server-side needs a checkout-session function instead
  of Payment Links.
- **Who's paying.** Checkout asks, and sends under-18s to a parent link. A self-declared
  answer is a soft gate; Stripe's card holder is the real payer.
- **Tax.** Digital goods are taxed in many states and countries. Turn on Stripe Tax, or
  use a merchant of record (Paddle, Lemon Squeezy) to have it handled.
- **iPhone app.** If Clarity ships in the App Store, digital currency normally has to
  use Apple's in-app purchase. Since the 2025 Epic v. Apple rulings, US apps may also
  link out to web checkout. The web site is unaffected.
- **Progress sync.** Game progress still lives in the browser. Purchases are recorded
  server-side (the source of truth for money) and credited into the browser wallet once
  per purchase id; a full wallet table is the next step when progress syncs.


## Founding-member drops (2026-10-30)

The Governor’s School code gives 100 drops ($10 at list price, $0 cash cost): 30 on
entry, 70 on the tenth study day after it. Gifted drops are not purchases: no
receipt, no refund, and they don't count toward the $50 monthly limit. Gem
portraits (70–120 drops) are the one tier above $6; each is about two weeks of
free drops away.
