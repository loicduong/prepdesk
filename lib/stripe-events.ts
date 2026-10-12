import type Stripe from "stripe";

export interface StripeEventDeps {
  seen(eventId: string): Promise<boolean>;
  record(eventId: string, type: string): Promise<void>;
  // "stale": the profile already reflects a newer Stripe event (Stripe does not guarantee order).
  applySubscription(
    customerId: string,
    plan: "free" | "pro",
    periodStart: Date | null,
    eventAt: Date,
  ): Promise<"applied" | "stale" | "unknown">;
}

type Change = { customer: string; plan: "free" | "pro"; periodStart: Date | null } | null;

function customerId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) return String((value as { id: unknown }).id);
  return null;
}

function changeFor(event: Stripe.Event): Change {
  const obj = event.data.object as unknown as Record<string, unknown>;
  const customer = customerId(obj.customer);
  if (!customer) return null;

  switch (event.type) {
    case "checkout.session.completed":
      return { customer, plan: "pro", periodStart: new Date(event.created * 1000) };
    case "customer.subscription.updated": {
      const active = obj.status === "active" || obj.status === "trialing";
      return { customer, plan: active ? "pro" : "free", periodStart: null };
    }
    case "customer.subscription.deleted":
      return { customer, plan: "free", periodStart: null };
    case "invoice.paid": {
      const lines = (obj.lines as { data?: { period?: { start?: number } }[] } | undefined)?.data;
      const start = lines?.[0]?.period?.start;
      return { customer, plan: "pro", periodStart: start ? new Date(start * 1000) : null };
    }
    default:
      return null;
  }
}

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: StripeEventDeps,
): Promise<{ status: 200 | 500; note: string }> {
  if (await deps.seen(event.id)) return { status: 200, note: "duplicate" };

  const change = changeFor(event);
  let note = "ignored";
  if (change) {
    const outcome = await deps.applySubscription(
      change.customer,
      change.plan,
      change.periodStart,
      new Date(event.created * 1000),
    );
    if (outcome === "unknown") return { status: 500, note: "unknown customer" };
    note = outcome === "stale" ? "stale" : `plan ${change.plan}`;
  }

  await deps.record(event.id, event.type);
  return { status: 200, note };
}
