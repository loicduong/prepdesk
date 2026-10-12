import { describe, it, expect } from "vitest";
import { validateReport } from "@/lib/report-schema";

const good = {
  role_summary: "Senior frontend role owning a React dashboard.",
  likely_questions: ["How do you keep a large React app fast?"],
  star_stories: ["A time you cut page load time, with numbers."],
  questions_to_ask: ["How is success measured in the first 90 days?"],
  watch_outs: ["Mentoring is part of the role."],
};

describe("validateReport", () => {
  it("accepts a complete report", () => {
    expect(validateReport(good)).toEqual(good);
  });
  it("rejects a missing section", () => {
    const { watch_outs, ...rest } = good;
    void watch_outs;
    expect(validateReport(rest)).toBeNull();
  });
  it("rejects an empty list", () => {
    expect(validateReport({ ...good, likely_questions: [] })).toBeNull();
  });
  it("rejects an oversized item", () => {
    expect(validateReport({ ...good, star_stories: ["x".repeat(601)] })).toBeNull();
  });
  it("rejects more than 10 items in a list", () => {
    expect(validateReport({ ...good, questions_to_ask: Array(11).fill("q?") })).toBeNull();
  });
  it("rejects non-objects", () => {
    expect(validateReport(null)).toBeNull();
    expect(validateReport("text")).toBeNull();
  });
});
