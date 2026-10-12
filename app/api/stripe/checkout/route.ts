import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  let customer = profile?.stripe_customer_id as string | null;
  if (!customer) {
    const created = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
    customer = created.id;
    await supabaseAdmin.from("profiles").update({ stripe_customer_id: customer }).eq("user_id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_SITE_URL}/billing/success`,
    cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/billing`,
  });
  return NextResponse.json({ url: session.url });
}
