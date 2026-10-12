import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { ensureCheckoutCustomer } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const result = await ensureCheckoutCustomer(user.id, user.email, {
    async getProfile(userId) {
      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("plan, stripe_customer_id")
        .eq("user_id", userId)
        .single();
      if (error) throw new Error(`profile lookup failed: ${error.message}`);
      return { plan: profile.plan as string, stripeCustomerId: profile.stripe_customer_id as string | null };
    },
    async createCustomer(userId, email) {
      // The idempotency key makes parallel requests from one user get the same customer.
      const customer = await getStripe().customers.create(
        { email, metadata: { user_id: userId } },
        { idempotencyKey: `create-customer-${userId}` },
      );
      return customer.id;
    },
    async claimCustomer(userId, customerId) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId)
        .is("stripe_customer_id", null);
      if (error) throw new Error(`storing customer failed: ${error.message}`);
      const { data: stored, error: readError } = await supabaseAdmin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .single();
      if (readError || !stored?.stripe_customer_id) throw new Error("customer not stored");
      return stored.stripe_customer_id as string;
    },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: result.customerId,
    client_reference_id: user.id,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_SITE_URL}/billing/success`,
    cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/billing`,
  });
  return NextResponse.json({ url: session.url });
}
