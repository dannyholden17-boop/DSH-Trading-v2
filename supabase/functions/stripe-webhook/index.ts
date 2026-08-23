// Supabase Edge Function: stripe-webhook
// Keeps public.subscriptions in sync with Stripe. Point your Stripe webhook at:
//   https://pyzcwddyagodmtjuvwdn.functions.supabase.co/stripe-webhook
// Deploy WITHOUT JWT verification (Stripe can't send a Supabase JWT):
//   supabase functions deploy stripe-webhook --no-verify-jwt --project-ref pyzcwddyagodmtjuvwdn
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

async function upsert(sub: Stripe.Subscription, uid?: string, plan?: string) {
  if (!uid) return;
  await admin.from("subscriptions").upsert({
    user_id: uid,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    status: sub.status,
    plan: plan || (sub.metadata?.plan ?? null),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, whSecret);
  } catch (e) {
    return new Response(`Bad signature: ${(e as Error).message}`, { status: 400 });
  }
  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.subscription) {
        const sub = await stripe.subscriptions.retrieve(s.subscription as string);
        await upsert(sub, s.metadata?.user_id, s.metadata?.plan);
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      const sub = event.data.object as Stripe.Subscription;
      await upsert(sub, sub.metadata?.user_id, sub.metadata?.plan);
    }
  } catch (e) {
    return new Response(`Handler error: ${(e as Error).message}`, { status: 500 });
  }
  return new Response("ok");
});
