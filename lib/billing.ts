export interface CheckoutDeps {
  getProfile(userId: string): Promise<{ plan: string; stripeCustomerId: string | null }>;
  createCustomer(userId: string, email: string | undefined): Promise<string>;
  // Stores the customer only if the profile has none yet and returns the stored one.
  claimCustomer(userId: string, customerId: string): Promise<string>;
}

export type EnsureCustomerResult = { ok: true; customerId: string } | { ok: false; status: 409; error: string };

export async function ensureCheckoutCustomer(
  userId: string,
  email: string | undefined,
  deps: CheckoutDeps,
): Promise<EnsureCustomerResult> {
  const profile = await deps.getProfile(userId);
  if (profile.plan === "pro") {
    return { ok: false, status: 409, error: "You're already on Pro. Use Manage billing instead." };
  }
  if (profile.stripeCustomerId) return { ok: true, customerId: profile.stripeCustomerId };

  const created = await deps.createCustomer(userId, email);
  return { ok: true, customerId: await deps.claimCustomer(userId, created) };
}
