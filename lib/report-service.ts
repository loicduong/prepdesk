import type { GenerateResult } from "@/lib/generate";
import type { Report } from "@/lib/report-schema";

export interface ReportDeps {
  refundStale(userId: string): Promise<void>;
  recentStats(userId: string): Promise<{ count: number; oldestAt: Date | null }>;
  startReport(userId: string, text: string): Promise<{ ok: true; id: string } | { ok: false }>;
  usage(userId: string): Promise<{ used: number; limit: number }>;
  generate(text: string): Promise<GenerateResult>;
  finishReport(id: string, report: Report, attempts: number): Promise<void>;
  failReport(id: string, attempts: number): Promise<void>;
  now(): Date;
}

export type CreateReportResult =
  | { status: 200; body: { id: string } }
  | { status: 400 | 402 | 429 | 502; body: { error: string } };

const MIN_CHARS = 200;
const MAX_CHARS = 15_000;
const RATE_LIMIT = 5;
const WINDOW_MS = 60_000;

export async function createReport(userId: string, rawText: string, deps: ReportDeps): Promise<CreateReportResult> {
  const text = rawText.trim().replace(/\s+/g, " ");
  if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
    return { status: 400, body: { error: "Paste 200–15,000 characters of the job posting." } };
  }

  await deps.refundStale(userId);

  const recent = await deps.recentStats(userId);
  if (recent.count >= RATE_LIMIT) {
    const oldest = recent.oldestAt?.getTime() ?? deps.now().getTime();
    const waitSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - deps.now().getTime()) / 1000));
    return { status: 429, body: { error: `Too many reports. Try again in ${waitSeconds} seconds.` } };
  }

  const started = await deps.startReport(userId, text);
  if (!started.ok) {
    const { used, limit } = await deps.usage(userId);
    return { status: 402, body: { error: `You've used ${used} of ${limit} reports this month.` } };
  }

  const result = await deps.generate(text);
  if (!result.ok) {
    await deps.failReport(started.id, result.attempts);
    return { status: 502, body: { error: "Couldn't generate the report. 1 credit refunded." } };
  }

  await deps.finishReport(started.id, result.report, result.attempts);
  return { status: 200, body: { id: started.id } };
}
