import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const email = `ledger-test-${Date.now()}@example.com`;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError || !created.user) throw createError ?? new Error("no user");
  const userId = created.user.id;

  try {
    const input = "x".repeat(300);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        supabase.rpc("start_report", { p_user: userId, p_input: input }),
      ),
    );
    const ok = results.filter((r) => !r.error).map((r) => r.data as string);
    const refused = results.filter((r) => r.error?.message.includes("insufficient_credits"));
    console.log(`10 parallel reserves with 3 credits: ${ok.length} succeeded, ${refused.length} refused`);
    assert.equal(ok.length, 3);
    assert.equal(refused.length, 7);

    const [a, b] = ok;
    const finish1 = await supabase.rpc("finish_report", { p_report: a, p_output: {}, p_attempts: 1 });
    const finish2 = await supabase.rpc("finish_report", { p_report: a, p_output: {}, p_attempts: 1 });
    const failAfterFinish = await supabase.rpc("fail_report", { p_report: a, p_attempts: 1 });
    console.log(`finish twice: ${finish1.data}, ${finish2.data}; fail after finish: ${failAfterFinish.data}`);
    assert.equal(finish1.data, true);
    assert.equal(finish2.data, false);
    assert.equal(failAfterFinish.data, false);

    const fail1 = await supabase.rpc("fail_report", { p_report: b, p_attempts: 3 });
    const fail2 = await supabase.rpc("fail_report", { p_report: b, p_attempts: 3 });
    console.log(`fail twice: ${fail1.data}, ${fail2.data}`);
    assert.equal(fail1.data, true);
    assert.equal(fail2.data, false);

    const { data: usage } = await supabase.rpc("usage_for", { p_user: userId });
    const row = (usage as { used: number; remaining: number }[])[0];
    console.log(`usage after one refund: used ${row.used}, remaining ${row.remaining}`);
    assert.equal(row.used, 2);
    assert.equal(row.remaining, 1);

    console.log("Ledger concurrency test passed");
  } finally {
    await supabase.auth.admin.deleteUser(userId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
