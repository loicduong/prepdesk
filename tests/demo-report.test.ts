import { describe, it, expect } from "vitest";
import { buildDemoReport } from "@/lib/demo-report";
import { validateReport } from "@/lib/report-schema";

const posting =
  "Senior Frontend Engineer. Build our analytics dashboard with React and TypeScript, " +
  "work with a Node.js API and PostgreSQL. Remote, EU time zones. " +
  "You will mentor two junior developers and improve accessibility.";

describe("buildDemoReport", () => {
  it("returns a report that passes the strict schema", () => {
    expect(validateReport(buildDemoReport(posting))).not.toBeNull();
  });

  it("uses the skills named in the posting, in order of appearance", () => {
    const report = buildDemoReport(posting);
    expect(report.likely_questions[0]).toContain("React");
    expect(report.likely_questions[1]).toContain("TypeScript");
    expect(report.role_summary).toContain("Node.js");
  });

  it("does not match a skill inside another word", () => {
    const report = buildDemoReport("We need strong JavaScript skills and a good eye for detail. ".repeat(5));
    const text = JSON.stringify(report);
    expect(text).toContain("JavaScript");
    expect(text).not.toMatch(/\bJava\b/);
  });

  it("detects seniority and remote work", () => {
    const report = buildDemoReport(posting);
    expect(report.role_summary).toContain("senior");
    expect(report.watch_outs.join(" ")).toContain("time-zone");
  });

  it("falls back to a generic report when no known skills appear", () => {
    const report = buildDemoReport("We are looking for a friendly person to help our team with daily tasks. ".repeat(5));
    expect(validateReport(report)).not.toBeNull();
    expect(report.watch_outs.join(" ")).toContain("which tools");
  });

  it("is deterministic", () => {
    expect(buildDemoReport(posting)).toEqual(buildDemoReport(posting));
  });

  it("stays within limits for a posting with a very long first sentence", () => {
    expect(validateReport(buildDemoReport("React ".repeat(2500)))).not.toBeNull();
  });
});
