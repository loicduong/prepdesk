"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function BillingSuccessPage() {
  const [state, setState] = useState<"waiting" | "active" | "slow">("waiting");

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const { data } = await supabase.rpc("get_my_usage");
      const plan = (data as { plan: string }[] | null)?.[0]?.plan;
      if (plan === "pro") {
        setState("active");
        clearInterval(timer);
      } else if (tries >= 15) {
        setState("slow");
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="space-y-3">
      <h1 className="text-2xl font-semibold">Thanks for upgrading</h1>
      {state === "waiting" && <p>Activating your Pro plan…</p>}
      {state === "active" && <p>Pro is active: 30 reports per month. <Link href="/new" className="underline">Create a report</Link>.</p>}
      {state === "slow" && <p>Payment received. Activation is taking longer than usual; refresh this page in a minute.</p>}
    </main>
  );
}
