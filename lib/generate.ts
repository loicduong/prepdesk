import { validateReport, type Report } from "@/lib/report-schema";

export type GenerateResult = { ok: true; report: Report; attempts: number } | { ok: false; attempts: number };

export async function generateWithRetries(
  callOnce: () => Promise<unknown>,
  maxAttempts = 3,
): Promise<GenerateResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const report = validateReport(await callOnce());
      if (report) return { ok: true, report, attempts: attempt };
    } catch {
      // Refusal, timeout, network or API error: count as a failed attempt.
    }
  }
  return { ok: false, attempts: maxAttempts };
}
