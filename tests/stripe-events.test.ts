import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { handleStripeEvent, type StripeEventDeps } from "@/lib/stripe-events";

function deps(overrides: Partial<StripeEventDeps> = {}): StripeEventDeps {
  return {
    seen: vi.fn().mockResolvedValue(false),
    record: vi.fn().mockResolvedValue(undefined),
    applySubscription: vi.fn().mockResolvedValue("applied"),
    ...overrides,
  };
}

function event(type: string, object: Record<string, unknown>): Stripe.Event {
  return { id: "evt_1", type, created: 1_760_000_000, data: { object } } as unknown as Stripe.Event;
}

const CREATED = new Date(1_760_000_000 * 1000);

describe("handleStripeEvent", () => {
  it("records a stale event without applying it, so Stripe stops retrying", async () => {
    const d = deps({ applySubscription: vi.fn().mockResolvedValue("stale") });
    expect(await handleStripeEvent(event("invoice.paid", { customer: "cus_1" }), d)).toEqual({ status: 200, note: "stale" });
    expect(d.record).toHaveBeenCalledWith("evt_1", "invoice.paid");
  });

  it("upgrades to Pro after checkout", async () => {
    const d = deps();
    const result = await handleStripeEvent(event("checkout.session.completed", { customer: "cus_1" }), d);
    expect(result.status).toBe(200);
    expect(d.applySubscription).toHaveBeenCalledWith("cus_1", "pro", new Date(1_760_000_000 * 1000), CREATED);
    expect(d.record).toHaveBeenCalledWith("evt_1", "checkout.session.completed");
  });

  it("skips an event it already processed", async () => {
    const d = deps({ seen: vi.fn().mockResolvedValue(true) });
    expect(await handleStripeEvent(event("checkout.session.completed", { customer: "cus_1" }), d)).toEqual({
      status: 200,
      note: "duplicate",
    });
    expect(d.applySubscription).not.toHaveBeenCalled();
  });

  it("keeps Pro while a cancellation is scheduled for period end", async () => {
    const d = deps();
    await handleStripeEvent(
      event("customer.subscription.updated", { customer: "cus_1", status: "active", cancel_at_period_end: true }),
      d,
    );
    expect(d.applySubscription).toHaveBeenCalledWith("cus_1", "pro", null, CREATED);
  });

  it("downgrades when the subscription is deleted", async () => {
    const d = deps();
    await handleStripeEvent(event("customer.subscription.deleted", { customer: "cus_1", status: "canceled" }), d);
    expect(d.applySubscription).toHaveBeenCalledWith("cus_1", "free", null, CREATED);
  });

  it("downgrades when the subscription becomes unpaid", async () => {
    const d = deps();
    await handleStripeEvent(event("customer.subscription.updated", { customer: "cus_1", status: "unpaid" }), d);
    expect(d.applySubscription).toHaveBeenCalledWith("cus_1", "free", null, CREATED);
  });

  it("starts a new period when an invoice is paid", async () => {
    const d = deps();
    await handleStripeEvent(
      event("invoice.paid", { customer: "cus_1", lines: { data: [{ period: { start: 1_760_100_000 } }] } }),
      d,
    );
    expect(d.applySubscription).toHaveBeenCalledWith("cus_1", "pro", new Date(1_760_100_000 * 1000), CREATED);
  });

  it("returns 500 and does not record when no profile has the customer, so Stripe retries", async () => {
    const d = deps({ applySubscription: vi.fn().mockResolvedValue("unknown") });
    const result = await handleStripeEvent(event("checkout.session.completed", { customer: "cus_unknown" }), d);
    expect(result.status).toBe(500);
    expect(d.record).not.toHaveBeenCalled();
  });

  it("records and ignores unrelated events", async () => {
    const d = deps();
    expect((await handleStripeEvent(event("charge.succeeded", {}), d)).status).toBe(200);
    expect(d.applySubscription).not.toHaveBeenCalled();
    expect(d.record).toHaveBeenCalledWith("evt_1", "charge.succeeded");
  });
});
