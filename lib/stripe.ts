import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let stripe: Stripe | null = null;

export function getStripe() {
  stripe ??= new Stripe(env.STRIPE_SECRET_KEY);
  return stripe;
}
