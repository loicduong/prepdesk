import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { env } from "@/lib/env";
import { REPORT_SYSTEM_PROMPT } from "@/lib/prompts/report";
import { ReportSchema } from "@/lib/report-schema";

export class ModelOutputError extends Error {}

// Our own retry loop (lib/generate.ts) owns retries, so the SDK must not retry.
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 25_000, maxRetries: 0 });

export async function callClaudeOnce(postingText: string): Promise<unknown> {
  // Beta namespace: server-side fallback when the model declines is a beta feature.
  const response = await client.beta.messages.parse({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4000,
    system: REPORT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `<job_posting>\n${postingText}\n</job_posting>` }],
    output_config: { effort: "low", format: betaZodOutputFormat(ReportSchema) },
    fallbacks: "default",
    betas: ["server-side-fallback-2026-07-01"],
  });

  if (response.stop_reason === "refusal") throw new ModelOutputError("refusal");
  if (!response.parsed_output) throw new ModelOutputError("unparsed output");
  return response.parsed_output;
}
