import "server-only";
import { createEnv } from "@/lib/env-core";

export const env = createEnv(process.env);
export const demoMode = !env.ANTHROPIC_API_KEY;
