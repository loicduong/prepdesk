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

  const started = Date.now();
  const result = await createReport(data.user.id, text, {
    ...credits,
    generate: (posting) =>
      generateWithRetries(demoMode ? async () => buildDemoReport(posting) : () => callClaudeOnce(posting)),
    now: () => new Date(),
  });
  console.info(
    JSON.stringify({
      event: "create_report",
      mode: demoMode ? "demo" : "claude",
      user: data.user.id,
      status: result.status,
      ms: Date.now() - started,
    }),
  );

  return NextResponse.json(result.body, { status: result.status });
}
