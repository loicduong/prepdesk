import { describe, it, expect, vi } from "vitest";
import { ensureCheckoutCustomer, type CheckoutDeps } from "@/lib/billing";

function deps(overrides: Partial<CheckoutDeps> = {}): CheckoutDeps {
  return {
    getProfile: vi.fn().mockResolvedValue({ plan: "free", stripeCustomerId: null }),
    createCustomer: vi.fn().mockResolvedValue("cus_new"),
    claimCustomer: vi.fn().mockImplementation(async (_user: string, id: string) => id),
    ...overrides,
  };
}

describe("ensureCheckoutCustomer", () => {
  it("refuses checkout for a user who is already Pro", async () => {
    const d = deps({ getProfile: vi.fn().mockResolvedValue({ plan: "pro", stripeCustomerId: "cus_1" }) });
    expect(await ensureCheckoutCustomer("u1", "a@example.com", d)).toEqual({
      ok: false,
      status: 409,
      error: "You're already on Pro. Use Manage billing instead.",
    });
    expect(d.createCustomer).not.toHaveBeenCalled();
  });

  it("reuses the stored customer", async () => {
    const d = deps({ getProfile: vi.fn().mockResolvedValue({ plan: "free", stripeCustomerId: "cus_1" }) });
    expect(await ensureCheckoutCustomer("u1", "a@example.com", d)).toEqual({ ok: true, customerId: "cus_1" });
    expect(d.createCustomer).not.toHaveBeenCalled();
  });

  it("creates and stores a customer when none exists", async () => {
    const d = deps();
    expect(await ensureCheckoutCustomer("u1", "a@example.com", d)).toEqual({ ok: true, customerId: "cus_new" });
    expect(d.createCustomer).toHaveBeenCalledWith("u1", "a@example.com");
    expect(d.claimCustomer).toHaveBeenCalledWith("u1", "cus_new");
  });

  it("uses the customer another request already stored", async () => {
    const d = deps({ claimCustomer: vi.fn().mockResolvedValue("cus_other") });
    expect(await ensureCheckoutCustomer("u1", "a@example.com", d)).toEqual({ ok: true, customerId: "cus_other" });
  });

  it("fails instead of continuing when the customer cannot be stored", async () => {
    const d = deps({ claimCustomer: vi.fn().mockRejectedValue(new Error("db down")) });
    await expect(ensureCheckoutCustomer("u1", "a@example.com", d)).rejects.toThrow("db down");
  });
});
