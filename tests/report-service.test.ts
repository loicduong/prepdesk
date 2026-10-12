import { describe, it, expect, vi } from "vitest";
import { createReport, type ReportDeps } from "@/lib/report-service";

const report = {
  role_summary: "Summary.",
  likely_questions: ["Q?"],
  star_stories: ["Story."],
  questions_to_ask: ["Ask?"],
  watch_outs: ["None."],
};
const posting = "We are hiring a frontend engineer. ".repeat(10);

function deps(overrides: Partial<ReportDeps> = {}): ReportDeps {
  return {
    refundStale: vi.fn().mockResolvedValue(undefined),
    recentStats: vi.fn().mockResolvedValue({ count: 0, oldestAt: null }),
    startReport: vi.fn().mockResolvedValue({ ok: true, id: "r1" }),
    usage: vi.fn().mockResolvedValue({ used: 3, limit: 3 }),
    generate: vi.fn().mockResolvedValue({ ok: true, report, attempts: 1 }),
    finishReport: vi.fn().mockResolvedValue(undefined),
    failReport: vi.fn().mockResolvedValue(undefined),
    now: () => new Date("2026-10-12T10:00:30Z"),
    ...overrides,
  };
}

describe("createReport", () => {
  it("creates a report and commits the credit", async () => {
    const d = deps();
    expect(await createReport("u1", posting, d)).toEqual({ status: 200, body: { id: "r1" } });
    expect(d.finishReport).toHaveBeenCalledWith("r1", report, 1);
    expect(d.failReport).not.toHaveBeenCalled();
  });

  it("rejects a posting that is long only because of whitespace", async () => {
    const d = deps();
    const result = await createReport("u1", `  short posting ${" ".repeat(400)}`, d);
    expect(result.status).toBe(400);
    expect(d.startReport).not.toHaveBeenCalled();
  });

  it("rejects a posting over 15,000 characters", async () => {
    expect((await createReport("u1", "a".repeat(15_001), deps())).status).toBe(400);
  });

  it("rate limits after 5 reports in a minute and says how long to wait", async () => {
    const d = deps({
      recentStats: vi.fn().mockResolvedValue({ count: 5, oldestAt: new Date("2026-10-12T10:00:00Z") }),
    });
    expect(await createReport("u1", posting, d)).toEqual({
      status: 429,
      body: { error: "Too many reports. Try again in 30 seconds." },
    });
    expect(d.startReport).not.toHaveBeenCalled();
  });

  it("returns 402 with usage when out of credits", async () => {
    const d = deps({ startReport: vi.fn().mockResolvedValue({ ok: false }) });
    expect(await createReport("u1", posting, d)).toEqual({
      status: 402,
      body: { error: "You've used 3 of 3 reports this month." },
    });
  });

  it("refunds and returns 502 when generation fails", async () => {
    const d = deps({ generate: vi.fn().mockResolvedValue({ ok: false, attempts: 3 }) });
    expect(await createReport("u1", posting, d)).toEqual({
      status: 502,
      body: { error: "Couldn't generate the report. 1 credit refunded." },
    });
    expect(d.failReport).toHaveBeenCalledWith("r1", 3);
    expect(d.finishReport).not.toHaveBeenCalled();
  });

  it("refunds stale reports before checking limits", async () => {
    const d = deps();
    await createReport("u1", posting, d);
    expect(d.refundStale).toHaveBeenCalledWith("u1");
  });
});
