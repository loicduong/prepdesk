import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Report } from "@/lib/report-schema";

const SECTIONS: [keyof Omit<Report, "role_summary">, string][] = [
  ["likely_questions", "Likely interview questions"],
  ["star_stories", "Stories to prepare (STAR)"],
  ["questions_to_ask", "Questions to ask them"],
  ["watch_outs", "Watch-outs"],
];

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("reports")
    .select("output_json, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.status !== "ready") notFound();
  const report = data.output_json as Report;

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Interview prep report</h1>
      <p>{report.role_summary}</p>
      {SECTIONS.map(([key, title]) => (
        <section key={key} className="space-y-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <ul className="list-disc space-y-1 pl-5">
            {report[key].map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
      ))}
    </main>
  );
}
