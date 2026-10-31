// Stripe -> Supabase bridge for water-drop purchases.
//
// Checkout happens on Stripe Payment Links, one per pack. Each link's Price
// carries metadata `pack` (splash | cup | bottle | jug) and `drops` (20 | 55 |
// 120 | 260), so the number of drops is decided in Stripe, never by the
// browser. The app opens the link with ?client_reference_id=<auth user id>;
// this function records the paid session in public.drop_purchases, and the app
// credits the drops the next time it reads that table.
//
// Deploy with verify_jwt disabled: requests are authenticated by the Stripe
// signature instead, and one that fails the check never reaches the database.
// Same pattern as the paywall webhook this repo used before (git 6fcb492^).
//
// Not deployed yet. Secrets: STRIPE_SECRET_KEY, STRIPE_DROPS_WEBHOOK_SECRET
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase).

import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.58.0'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
const webhookSecret = Deno.env.get('STRIPE_DROPS_WEBHOOK_SECRET')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Both SDKs throw when built without credentials; building on first use keeps
// a missing secret a readable 500 instead of a crashed worker.
let stripeClient: Stripe | null = null
function getStripe(): Stripe {
  stripeClient ??= new Stripe(stripeSecretKey!, { apiVersion: '2025-08-27.basil' })
  return stripeClient
}

let adminClient: ReturnType<typeof createClient> | null = null
function getAdmin() {
  adminClient ??= createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return adminClient
}

/** Record a paid session once. A replay hits the unique session id and is ignored. */
async function recordSession(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return // async methods settle later

  const userId = session.client_reference_id
  if (!userId || !UUID.test(userId)) {
    // Paid, but we cannot say by whom. A retry will not help, so acknowledge the
    // delivery and leave a loud trace for a manual refund or credit.
    console.error('drops checkout with no usable client_reference_id', { session: session.id })
    return
  }

  const items = await getStripe().checkout.sessions.listLineItems(session.id, { expand: ['data.price'] })
  let drops = 0
  let packId = 'unknown'
  for (const item of items.data) {
    const meta = item.price?.metadata ?? {}
    const each = Number.parseInt(meta.drops ?? '', 10)
    if (!Number.isFinite(each) || each <= 0) {
      console.error('drops price without a drops metadata value', { session: session.id, price: item.price?.id })
      continue
    }
    drops += each * (item.quantity ?? 1)
    packId = meta.pack ?? item.price?.id ?? packId
  }
  if (drops <= 0) return

  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
  const { error } = await getAdmin().from('drop_purchases').upsert(
    {
      user_id: userId,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntent,
      pack_id: packId,
      drops,
      amount_total: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: 'paid',
    },
    { onConflict: 'stripe_session_id', ignoreDuplicates: true },
  )
  if (error) throw new Error(`drop_purchases insert failed: ${error.message}`)
}

/** A full refund takes the drops back; the app deducts them on its next read. */
async function recordRefund(charge: Stripe.Charge) {
  if (!charge.refunded) return // partial refunds are handled by hand
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? null
  if (!paymentIntent) return
  const { error } = await getAdmin().from('drop_purchases').update({ status: 'refunded' }).eq('stripe_payment_intent_id', paymentIntent)
  if (error) throw new Error(`drop_purchases refund failed: ${error.message}`)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('drops-webhook is missing required environment variables')
    return new Response('Server not configured', { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing stripe-signature', { status: 400 })
  const payload = await request.text()

  let event: Stripe.Event
  try {
    // Async variant: Deno has no synchronous crypto for this.
    event = await getStripe().webhooks.constructEventAsync(payload, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return new Response(`Signature verification failed: ${message}`, { status: 400 })
  }

  // Idempotency, shared with the paywall's table: a duplicate delivery is
  // acknowledged without being applied twice.
  const { error: seenError } = await getAdmin().from('stripe_events').insert({ id: event.id, type: event.type })
  if (seenError) {
    if (seenError.code === '23505') return new Response('Already processed', { status: 200 })
    console.error('stripe_events insert failed', seenError.message)
    return new Response('Could not record event', { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await recordSession(event.data.object as Stripe.Checkout.Session)
        break
      case 'charge.refunded':
        await recordRefund(event.data.object as Stripe.Charge)
        break
      default:
        break
    }
  } catch (error) {
    // Roll the marker back so Stripe's retry is allowed to do real work.
    await getAdmin().from('stripe_events').delete().eq('id', event.id)
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error(`handling ${event.type} failed: ${message}`)
    return new Response(message, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
