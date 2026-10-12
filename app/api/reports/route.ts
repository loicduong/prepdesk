import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { credits } from "@/lib/credits";
import { generateWithRetries } from "@/lib/generate";
import { callClaudeOnce } from "@/lib/claude";
import { buildDemoReport } from "@/lib/demo-report";
import { demoMode } from "@/lib/env";
import { createReport } from "@/lib/report-service";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";

  const userId = data.user.id;
  const started = Date.now();
  let attempts = 0;
  const result = await createReport(userId, text, {
    ...credits,
    generate: async (posting) => {
      const generated = await generateWithRetries(
        demoMode ? async () => buildDemoReport(posting) : () => callClaudeOnce(posting),
        3,
        // Log the error class and HTTP status only, never the prompt, posting or model output.
        (attempt, error) =>
          console.warn(
            JSON.stringify({
              event: "model_attempt_failed",
              user: userId,
              attempt,
              error: error instanceof Error ? error.constructor.name : "invalid_output",
              status: (error as { status?: number } | null)?.status ?? null,
            }),
          ),
      );
      attempts = generated.attempts;
      return generated;
    },
    now: () => new Date(),
  });
  console.info(
    JSON.stringify({
      event: "create_report",
      mode: demoMode ? "demo" : "claude",
      user: userId,
      status: result.status,
      attempts,
      ms: Date.now() - started,
    }),
  );

  return NextResponse.json(result.body, { status: result.status });
}
