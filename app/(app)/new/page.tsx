import { createServerSupabase } from "@/lib/supabase/server";
import NewReportForm from "./NewReportForm";

export default async function NewReportPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("get_my_usage");
  const usage = (data as { plan: string; remaining: number; monthly_limit: number }[] | null)?.[0];
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">New prep report</h1>
      {usage && (
        <p className="text-sm text-gray-600">
          {usage.plan === "pro" ? "Pro" : "Free"} plan · {usage.remaining} of {usage.monthly_limit} reports left this month
        </p>
      )}
      <NewReportForm />
    </main>
  );
}
