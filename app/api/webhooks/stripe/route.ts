import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { addWorkingHours } from '@/lib/workingHours';
import { handleDealCheckout, handleDealRefund, isDealCheckout } from '@/lib/deals/stripe-events';
import { dealsDb } from '@/lib/deals/db';

// This is the ONLY place `subscriptions` is ever written from the Stripe side.
// search_restaurants() and offers_public read that table directly, never Stripe,
// so this handler being correct is what keeps radius/voucher entitlement honest.
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook not configured.' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const deals = dealsDb();
  const rpc = (fn: string, args: Record<string, unknown>) => deals.rpc(fn, args);

  // Nothing here may be dropped quietly. A write that fails throws, and the
  // 500 below makes Stripe send the event again (for up to three days). Every
  // write is safe to repeat: the upsert and updates set the same values, the
  // priority check looks for its payment first, and the deal posts are keyed.
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Deal credit, posted once by the database however many times the
        // event arrives.
        if (isDealCheckout(session)) {
          try {
            await handleDealCheckout(session, rpc);
          } catch (e) {
            console.error('[stripe] deal top up', (e as Error).message);
            return NextResponse.json({ error: 'Could not record the top up.' }, { status: 500 });
          }
          break;
        }

        if (session.mode === 'subscription') {
          const userId = session.metadata?.yepitshalal_user_id || session.client_reference_id;
          if (!userId || !session.subscription || !session.customer) break;
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertSubscription(userId, subscription);
          break;
        }

        if (session.mode === 'payment' && session.metadata?.yepitshalal_type === 'priority_verification') {
          // Idempotent: a Stripe retry of this same event must not create a
          // second verification_requests row for the same payment.
          const { data: existing, error: findError } = await supabase
            .from('verification_requests')
            .select('id')
            .eq('stripe_payment_id', session.id)
            .maybeSingle();
          if (findError) throw new Error(`priority check lookup: ${findError.message}`);
          if (existing) break;

          const { data: holidays } = await supabase.from('uk_bank_holidays').select('holiday_date');
          const bankHolidays = new Set((holidays ?? []).map((h) => h.holiday_date));
          const slaDueAt = addWorkingHours(new Date(), 48, bankHolidays);

          const { error: queueError } = await supabase.from('verification_requests').insert({
            restaurant_id: session.metadata.restaurant_id,
            queue_type: 'priority',
            status: 'queued',
            stripe_payment_id: session.id,
            sla_due_at: slaDueAt.toISOString(),
            contact_name: session.metadata.contact_name || null,
            contact_email: session.metadata.contact_email || null,
          });
          // A paid check that never reached the queue would be paid for and never done.
          if (queueError) throw new Error(`priority check: ${queueError.message}`);
        }
        break;
      }

      // Covers renewals, cancellations, plan changes, and payment-failure status
      // changes: the same upsert path as the initial checkout.
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.yepitshalal_user_id;
        if (!userId) break;
        await upsertSubscription(userId, subscription);
        break;
      }

      // Refunds are only ever initiated manually by an admin (from the Stripe
      // dashboard, per §16: payment purchases priority, not a guaranteed
      // outcome, so this never happens automatically). This just reflects that
      // decision back into our own records once it happens.
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        // A refunded deal top up takes that credit back (see lib/deals).
        if (charge.metadata?.yepitshalal_type === 'deal_credit') {
          try {
            await handleDealRefund(charge, rpc);
          } catch (e) {
            console.error('[stripe] deal refund', (e as Error).message);
            return NextResponse.json({ error: 'Could not record the refund.' }, { status: 500 });
          }
          break;
        }
        if (typeof charge.payment_intent === 'string') {
          const session = await stripe.checkout.sessions
            .list({ payment_intent: charge.payment_intent, limit: 1 })
            .then((r) => r.data[0]);
          if (session) {
            const { error } = await supabase
              .from('verification_requests')
              .update({ refund_status: 'issued' })
              .eq('stripe_payment_id', session.id);
            if (error) throw new Error(`refund status: ${error.message}`);
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error('[stripe]', event.type, (e as Error).message);
    return NextResponse.json({ error: 'Could not record it. Stripe will send it again.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });

  async function upsertSubscription(userId: string, subscription: Stripe.Subscription) {
    const item = subscription.items.data[0];
    const plan = item?.price.recurring?.interval === 'year' ? 'annual' : 'monthly';
    // An event's body follows the webhook endpoint's own API version, not the
    // one lib/stripe.ts asks for. From Stripe's 2025-03-31 version the period
    // end moved from the subscription onto each item, so read either: a
    // missing date must not throw and leave the supporter unrecorded.
    type WithPeriod = { current_period_end?: number | null };
    const periodEnd =
      (subscription as unknown as WithPeriod).current_period_end ?? (item as unknown as WithPeriod | undefined)?.current_period_end ?? null;
    const status =
      subscription.status === 'active'
        ? 'active'
        : subscription.status === 'past_due'
        ? 'past_due'
        : subscription.status === 'canceled'
        ? 'canceled'
        : 'incomplete';

    const { error: subError } = await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        status,
        plan,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        // Stripe knows when this started; the upsert must not reset it to now()
        // every time the subscription renews.
        created_at: new Date(subscription.created * 1000).toISOString(),
      },
      { onConflict: 'user_id' }
    );
    // A supporter who paid and was not recorded would lose their perks.
    if (subError) throw new Error(`subscription: ${subError.message}`);

    const { error: userError } = await supabase
      .from('users')
      .update({ is_yep_plus: status === 'active' })
      .eq('id', userId);
    if (userError) throw new Error(`supporter flag: ${userError.message}`);
  }
}
