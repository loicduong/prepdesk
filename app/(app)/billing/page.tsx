import { createServerSupabase } from "@/lib/supabase/server";
import BillingButtons from "./BillingButtons";

export default async function BillingPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("get_my_usage");
  const usage = (data as { plan: string; used: number; monthly_limit: number; period_start: string }[] | null)?.[0];

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Billing</h1>
      {usage && (
        <p>
          {usage.plan === "pro" ? "Pro" : "Free"} plan · {usage.used} of {usage.monthly_limit} reports used since{" "}
          {new Date(usage.period_start).toLocaleDateString()}
        </p>
      )}
      <BillingButtons plan={usage?.plan ?? "free"} />
    </main>
  );
}
