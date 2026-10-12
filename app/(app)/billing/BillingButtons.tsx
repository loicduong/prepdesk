"use client";

import { useState } from "react";

export default function BillingButtons({ plan }: { plan: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go(path: string) {
    setBusy(true);
    setError("");
    const res = await fetch(path, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.url) {
      window.location.href = body.url;
      return;
    }
    setError(body.error ?? "Couldn't open Stripe. Try again.");
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {plan !== "pro" && (
          <button disabled={busy} onClick={() => go("/api/stripe/checkout")} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
            Upgrade to Pro ($9/month, test mode)
          </button>
        )}
        <button disabled={busy} onClick={() => go("/api/stripe/portal")} className="rounded border px-4 py-2 disabled:opacity-50">
          Manage billing
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <p className="text-xs text-gray-500">Test card: 4242 4242 4242 4242, any future date, any CVC.</p>
    </div>
  );
}
