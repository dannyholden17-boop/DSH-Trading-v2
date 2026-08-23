// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout Session for the signed-in user and returns its URL.
// Deploy:  supabase functions deploy create-checkout --project-ref pyzcwddyagodmtjuvwdn
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_TRADER, STRIPE_PRICE_DESK
//          (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided automatically)
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

const PRICES: Record<string, string | undefined> = {
  trader: Deno.env.get("STRIPE_PRICE_TRADER"),
  desk: Deno.env.get("STRIPE_PRICE_DESK"),
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const { plan, origin } = await req.json().catch(() => ({}));
    const price = PRICES[plan];
    if (!price) return json({ error: "Unknown or unconfigured plan" }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: existing } = await admin
      .from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();

    let customer = existing?.stripe_customer_id as string | undefined;
    if (!customer) {
      const c = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
      customer = c.id;
      await admin.from("subscriptions").upsert({ user_id: user.id, stripe_customer_id: customer, status: "incomplete", plan });
    }

    const base = (origin || "https://dsh-trading.com").replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${base}/dashboard.html?sub=success`,
      cancel_url: `${base}/pricing.html?sub=cancel`,
      subscription_data: { metadata: { user_id: user.id, plan } },
      metadata: { user_id: user.id, plan },
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
