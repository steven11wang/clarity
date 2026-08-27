// Stripe -> Supabase paywall bridge.
//
// Stripe is the source of truth for who has paid. This function is the only
// writer of public.subscriptions; it runs with the service role key, so it is
// deployed with verify_jwt disabled and authenticates each request by verifying
// the Stripe signature instead. A request that fails that check never reaches
// the database.

import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.58.0'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Both SDKs throw when constructed without credentials, and a throw at module
// scope takes the whole worker down with an opaque WORKER_ERROR. Building them
// on first use keeps a missing secret a readable 500 instead.
let stripeClient: Stripe | null = null
function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey!, { apiVersion: '2025-08-27.basil' })
  }
  return stripeClient
}

let adminClient: ReturnType<typeof createClient> | null = null
function getAdmin() {
  if (!adminClient) {
    adminClient = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

/** The live prices behind the two payment links. Set the env vars to override
 *  without a redeploy - after a price change, for instance. The amounts are a
 *  last resort so an unrecognised price still lands on the right plan. */
const PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO') ?? 'price_1U57knGaHqGIrxc6HLJcNmKX'
const PRICE_PRO_MAX = Deno.env.get('STRIPE_PRICE_PRO_MAX') ?? 'price_1U585RGaHqGIrxc6i5TX3xZY'

function planFor(priceId: string | null, unitAmount: number | null): 'pro' | 'pro_max' | null {
  if (priceId && priceId === PRICE_PRO) return 'pro'
  if (priceId && priceId === PRICE_PRO_MAX) return 'pro_max'
  if (unitAmount === 7900) return 'pro'
  if (unitAmount === 66800) return 'pro_max'
  return null
}

function periodEnd(subscription: Stripe.Subscription): string | null {
  // Stripe moved current_period_end onto the subscription item in 2025 API
  // versions and kept it on the subscription in older ones. Read both.
  const onSubscription = (subscription as unknown as { current_period_end?: number })
    .current_period_end
  const onItem = (subscription.items?.data?.[0] as unknown as { current_period_end?: number })
    ?.current_period_end
  const seconds = onSubscription ?? onItem
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null
}

/** Resolve the Clarity user a Stripe subscription belongs to.
 *  Checkout writes the link (client_reference_id); later subscription events
 *  only carry the customer, so they are matched back through it, then through
 *  the billing email as a last resort. */
async function resolveUserId(
  customerId: string | null,
  email: string | null,
): Promise<string | null> {
  if (customerId) {
    const { data } = await getAdmin()
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (data?.user_id) return data.user_id
  }

  if (email) {
    const { data } = await getAdmin()
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle()
    if (data?.id) return data.id
  }

  return null
}

async function saveSubscription(userId: string, subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.[0]
  const priceId = item?.price?.id ?? null
  const unitAmount = item?.price?.unit_amount ?? null

  const { error } = await getAdmin().from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id ?? null,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      plan: planFor(priceId, unitAmount),
      price_id: priceId,
      current_period_end: periodEnd(subscription),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    },
    { onConflict: 'user_id' },
  )

  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`)
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId =
    session.client_reference_id ??
    (await resolveUserId(
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
      session.customer_details?.email ?? session.customer_email ?? null,
    ))

  if (!userId) {
    // Paid, but we cannot say who. Do not fail the delivery - a retry will not
    // help - but leave a loud trace for manual reconciliation.
    console.error('checkout.session.completed with no resolvable user', {
      session: session.id,
      customer: session.customer,
      email: session.customer_details?.email,
    })
    return
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null

  if (!subscriptionId) {
    console.error('checkout.session.completed without a subscription', { session: session.id })
    return
  }

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  })
  await saveSubscription(userId, subscription)
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null

  let email: string | null = null
  if (customerId) {
    const customer = await getStripe().customers.retrieve(customerId)
    if (!('deleted' in customer && customer.deleted)) email = customer.email ?? null
  }

  const userId = await resolveUserId(customerId, email)
  if (!userId) {
    console.error('subscription event with no resolvable user', {
      subscription: subscription.id,
      customer: customerId,
      email,
    })
    return
  }

  await saveSubscription(userId, subscription)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('stripe-webhook is missing required environment variables')
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

  // Idempotency: a duplicate delivery is acknowledged without re-applying.
  const { error: seenError } = await getAdmin()
    .from('stripe_events')
    .insert({ id: event.id, type: event.type })
  if (seenError) {
    if (seenError.code === '23505') return new Response('Already processed', { status: 200 })
    console.error('stripe_events insert failed', seenError.message)
    return new Response('Could not record event', { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription)
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

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
