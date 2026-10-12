import { describe, it, expect, vi } from "vitest";
import { generateWithRetries } from "@/lib/generate";

const good = {
  role_summary: "Role summary.",
  likely_questions: ["Q1?"],
  star_stories: ["Story."],
  questions_to_ask: ["Ask?"],
  watch_outs: ["None found."],
};

describe("generateWithRetries", () => {
  it("returns on the first valid answer", async () => {
    const call = vi.fn().mockResolvedValue(good);
    expect(await generateWithRetries(call)).toEqual({ ok: true, report: good, attempts: 1 });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("retries after invalid output and succeeds", async () => {
    const call = vi.fn().mockResolvedValueOnce({ role_summary: "x" }).mockResolvedValueOnce(good);
    expect(await generateWithRetries(call)).toEqual({ ok: true, report: good, attempts: 2 });
  });

  it("treats a thrown error (refusal, timeout) as a failed attempt", async () => {
    const call = vi.fn().mockRejectedValueOnce(new Error("refusal")).mockResolvedValueOnce(good);
    expect(await generateWithRetries(call)).toEqual({ ok: true, report: good, attempts: 2 });
  });

  it("reports each failed attempt to onFailure", async () => {
    const onFailure = vi.fn();
    const refusal = new Error("refusal");
    const call = vi.fn().mockRejectedValueOnce(refusal).mockResolvedValueOnce({ role_summary: "x" }).mockResolvedValueOnce(good);
    await generateWithRetries(call, 3, onFailure);
    expect(onFailure).toHaveBeenNthCalledWith(1, 1, refusal);
    expect(onFailure).toHaveBeenNthCalledWith(2, 2, null);
    expect(onFailure).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 failed attempts", async () => {
    const call = vi.fn().mockRejectedValue(new Error("timeout"));
    expect(await generateWithRetries(call)).toEqual({ ok: false, attempts: 3 });
    expect(call).toHaveBeenCalledTimes(3);
  });
});
