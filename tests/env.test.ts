import { describe, it, expect } from "vitest";
import { createEnv } from "@/lib/env-core";

const supabaseOnly = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000/",
};

describe("createEnv", () => {
  it("reads a variable without requiring unrelated ones", () => {
    const env = createEnv(supabaseOnly);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service");
  });

  it("throws naming the variable, not its value, when a used variable is missing", () => {
    const env = createEnv(supabaseOnly);
    expect(() => env.STRIPE_SECRET_KEY).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("treats an empty Anthropic key as demo mode and an empty model as the default", () => {
    const env = createEnv({ ...supabaseOnly, ANTHROPIC_API_KEY: "", ANTHROPIC_MODEL: "" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-5-5");
  });

  it("strips a trailing slash from the site URL", () => {
    expect(createEnv(supabaseOnly).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });
});
