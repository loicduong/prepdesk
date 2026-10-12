import { z } from "zod";

export const ReportSchema = z.object({
  role_summary: z.string(),
  likely_questions: z.array(z.string()),
  star_stories: z.array(z.string()),
  questions_to_ask: z.array(z.string()),
  watch_outs: z.array(z.string()),
});

export type Report = z.infer<typeof ReportSchema>;

const item = z.string().trim().min(1).max(600);
const list = z.array(item).min(1).max(10);

const StrictReportSchema = z.object({
  role_summary: z.string().trim().min(1).max(800),
  likely_questions: list,
  star_stories: list,
  questions_to_ask: list,
  watch_outs: list,
});

export function validateReport(raw: unknown): Report | null {
  const result = StrictReportSchema.safeParse(raw);
  return result.success ? result.data : null;
}
