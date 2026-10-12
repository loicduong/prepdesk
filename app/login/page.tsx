"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const supabase = createBrowserSupabase();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setState(error ? "error" : "sent");
  }

  async function google() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16 space-y-6">
      <h1 className="text-2xl font-semibold">Sign in to PrepDesk</h1>
      <form onSubmit={sendLink} className="space-y-3">
        <label htmlFor="email" className="block text-sm">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <button disabled={state === "sending"} className="w-full rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {state === "sent" && <p className="text-sm">Check your inbox for the sign-in link.</p>}
      {state === "error" && <p className="text-sm text-red-700">Couldn&apos;t send the link. Check the address and try again.</p>}
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1" && (
        <button onClick={google} className="w-full rounded border px-3 py-2">Continue with Google</button>
      )}
    </main>
  );
}
