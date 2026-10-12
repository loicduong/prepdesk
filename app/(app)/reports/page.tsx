import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function ReportsPage() {
  const supabase = await createServerSupabase();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, input_text, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Your reports</h1>
      {!reports?.length && <p className="text-sm text-gray-600">No reports yet. <Link href="/new" className="underline">Create one</Link>.</p>}
      <ul className="divide-y rounded border">
        {reports?.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="text-gray-500">{new Date(r.created_at).toLocaleDateString()}</span>
            <span className="min-w-0 flex-1 truncate">{r.input_text.slice(0, 90)}</span>
            {r.status === "ready" ? (
              <Link href={`/reports/${r.id}`} className="underline">Open</Link>
            ) : (
              <span className={r.status === "failed" ? "text-red-700" : "text-gray-500"}>
                {r.status === "failed" ? "Failed · refunded" : "Generating"}
              </span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
