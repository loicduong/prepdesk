import { validateReport, type Report } from "@/lib/report-schema";

export type GenerateResult = { ok: true; report: Report; attempts: number } | { ok: false; attempts: number };

// `error` is null when the call returned but its output failed validation.
export type OnFailure = (attempt: number, error: unknown) => void;

export async function generateWithRetries(
  callOnce: () => Promise<unknown>,
  maxAttempts = 3,
  onFailure: OnFailure = () => {},
): Promise<GenerateResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const report = validateReport(await callOnce());
      if (report) return { ok: true, report, attempts: attempt };
      onFailure(attempt, null);
    } catch (error) {
      // Refusal, timeout, network or API error: count as a failed attempt.
      onFailure(attempt, error);
    }
  }
  return { ok: false, attempts: maxAttempts };
}
