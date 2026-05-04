import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const body = await req.text();

  let event: Stripe.Event;

  try {
    if (!signature || !webhookSecret) throw new Error('Missing stripe signature or webhook secret');
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[stripe-webhook] Event received: ${event.type}`);

  try {
    switch (event.type) {

      // ─── Payment Succeeded ───────────────────────────────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;

        // Find the matching saas_plan by stripe_price_id stored in metadata
        const { data: plan } = await supabase
          .from('saas_plans')
          .select('id')
          .eq('stripe_price_id_monthly', priceId)
          .maybeSingle();

        // Find company by stripe_customer_id
        const { data: companySub } = await supabase
          .from('company_subscriptions')
          .select('id, company_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (companySub) {
          await supabase
            .from('company_subscriptions')
            .update({
              status: 'active',
              stripe_subscription_id: subscriptionId,
              stripe_price_id: priceId,
              ...(plan ? { plan_id: plan.id } : {}),
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('company_id', companySub.company_id);

          console.log(`[stripe-webhook] ✅ Subscription ACTIVATED for company: ${companySub.company_id}`);
        }
        break;
      }

      // ─── Payment Failed ───────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: companySub } = await supabase
          .from('company_subscriptions')
          .select('company_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (companySub) {
          await supabase
            .from('company_subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('company_id', companySub.company_id);

          console.warn(`[stripe-webhook] ⚠️ Payment FAILED for company: ${companySub.company_id}`);
        }
        break;
      }

      // ─── Subscription Canceled ────────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: companySub } = await supabase
          .from('company_subscriptions')
          .select('company_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (companySub) {
          await supabase
            .from('company_subscriptions')
            .update({
              status: 'canceled',
              canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('company_id', companySub.company_id);

          console.log(`[stripe-webhook] 🚫 Subscription CANCELED for company: ${companySub.company_id}`);
        }
        break;
      }

      // ─── Subscription Updated (plan change) ───────────────────────────────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price?.id;

        const { data: companySub } = await supabase
          .from('company_subscriptions')
          .select('company_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (companySub) {
          await supabase
            .from('company_subscriptions')
            .update({
              status: subscription.status === 'active' ? 'active' : subscription.status,
              stripe_price_id: priceId,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('company_id', companySub.company_id);

          console.log(`[stripe-webhook] 🔄 Subscription UPDATED for company: ${companySub.company_id}`);
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('[stripe-webhook] Processing error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
