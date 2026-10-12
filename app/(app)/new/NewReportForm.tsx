"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewReportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const body = await res.json().catch(() => ({ error: "Something went wrong. Try again." }));
    if (res.ok) {
      router.push(`/reports/${body.id}`);
      return;
    }
    if (res.status === 401) {
      // Session expired: reloading lets the proxy start a fresh guest session.
      window.location.reload();
      return;
    }
    setError({ message: body.error, upgrade: res.status === 402 });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="posting" className="block text-sm">Paste the job posting</label>
      <textarea
        id="posting"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        className="w-full rounded border p-3"
      />
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Generating…" : "Generate report"}
        </button>
        <span className="text-xs text-gray-500">{text.trim().length} / 15,000 characters</span>
      </div>
      {error && (
        <p className="text-sm text-red-700">
          {error.message} {error.upgrade && <Link href="/billing" className="underline">Upgrade to Pro</Link>}
        </p>
      )}
    </form>
  );
}
