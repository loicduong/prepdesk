import { describe, it, expect } from "vitest";
import { shouldStartGuest } from "@/lib/guest";

const browser = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36";

describe("shouldStartGuest", () => {
  it("starts a guest session for an app page", () => {
    expect(shouldStartGuest("/new", browser)).toBe(true);
    expect(shouldStartGuest("/reports/abc", browser)).toBe(true);
  });
  it("never starts one for API routes", () => {
    expect(shouldStartGuest("/api/reports", browser)).toBe(false);
  });
  it("never starts one for the unavailable page", () => {
    expect(shouldStartGuest("/unavailable", browser)).toBe(false);
  });
  it("skips crawlers and link previews", () => {
    expect(shouldStartGuest("/new", "Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(false);
    expect(shouldStartGuest("/new", "Slackbot-LinkExpanding 1.0")).toBe(false);
    expect(shouldStartGuest("/new", "facebookexternalhit/1.1")).toBe(false);
  });
  it("skips requests without a user agent", () => {
    expect(shouldStartGuest("/new", null)).toBe(false);
  });
});
