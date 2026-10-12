import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  ANTHROPIC_MODEL: z.preprocess(emptyToUndefined, z.string().default("claude-sonnet-5-5")),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PRICE_ID: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
});

export type Env = z.infer<typeof EnvSchema>;

// Each variable is validated when it is first read, so a route only fails on the
// variables it uses, and `next build` does not need secrets it never reads.
export function createEnv(source: Record<string, string | undefined>): Env {
  const cache = new Map<string, unknown>();
  return new Proxy({} as Env, {
    get(_, key) {
      if (typeof key !== "string" || !(key in EnvSchema.shape)) return undefined;
      if (!cache.has(key)) {
        const result = EnvSchema.shape[key as keyof Env].safeParse(source[key]);
        if (!result.success) throw new Error(`Environment variable ${key} is missing or invalid`);
        cache.set(key, result.data);
      }
      return cache.get(key);
    },
  });
}
