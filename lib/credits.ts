import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Report } from "@/lib/report-schema";

function fail(op: string, message: string): never {
  throw new Error(`${op} failed: ${message}`);
}

export const credits = {
  async refundStale(userId: string) {
    const { error } = await supabaseAdmin.rpc("refund_stale_reports", { p_user: userId });
    if (error) fail("refund_stale_reports", error.message);
  },

  async recentStats(userId: string) {
    const { data, error } = await supabaseAdmin.rpc("recent_report_stats", { p_user: userId });
    if (error) fail("recent_report_stats", error.message);
    const row = (data as { recent_count: number; oldest_at: string | null }[])[0];
    return { count: row?.recent_count ?? 0, oldestAt: row?.oldest_at ? new Date(row.oldest_at) : null };
  },

  async startReport(userId: string, text: string): Promise<{ ok: true; id: string } | { ok: false }> {
    const { data, error } = await supabaseAdmin.rpc("start_report", { p_user: userId, p_input: text });
    if (error?.message.includes("insufficient_credits")) return { ok: false };
    if (error) fail("start_report", error.message);
    return { ok: true, id: data as string };
  },

  async usage(userId: string) {
    const { data, error } = await supabaseAdmin.rpc("usage_for", { p_user: userId });
    if (error) fail("usage_for", error.message);
    const row = (data as { used: number; monthly_limit: number }[])[0];
    return { used: row.used, limit: row.monthly_limit };
  },

  async finishReport(id: string, report: Report, attempts: number) {
    const { error } = await supabaseAdmin.rpc("finish_report", { p_report: id, p_output: report, p_attempts: attempts });
    if (error) fail("finish_report", error.message);
  },

  async failReport(id: string, attempts: number) {
    const { error } = await supabaseAdmin.rpc("fail_report", { p_report: id, p_attempts: attempts });
    if (error) fail("fail_report", error.message);
  },
};
