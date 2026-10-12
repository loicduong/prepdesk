import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { handleStripeEvent } from "@/lib/stripe-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    console.warn(JSON.stringify({ event: "stripe_webhook", result: "bad_signature" }));
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const result = await handleStripeEvent(event, {
    async seen(eventId) {
      const { data, error } = await supabaseAdmin.rpc("stripe_event_seen", { p_event_id: eventId });
      if (error) throw new Error(error.message);
      return data as boolean;
    },
    async record(eventId, type) {
      const { error } = await supabaseAdmin.rpc("record_stripe_event", { p_event_id: eventId, p_type: type });
      if (error) throw new Error(error.message);
    },
    async applySubscription(customer, plan, periodStart) {
      const { data, error } = await supabaseAdmin.rpc("apply_subscription", {
        p_customer: customer,
        p_plan: plan,
        p_period_start: periodStart?.toISOString() ?? null,
      });
      if (error) throw new Error(error.message);
      return data as boolean;
    },
  });

  console.info(JSON.stringify({ event: "stripe_webhook", id: event.id, type: event.type, ...result }));
  return NextResponse.json({ received: true }, { status: result.status });
}
