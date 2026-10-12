import { describe, it, expect } from "vitest";
import { displayName } from "@/lib/display-name";

describe("displayName", () => {
  it("shows Guest for an anonymous user", () => {
    expect(displayName({ is_anonymous: true, email: "" })).toBe("Guest");
  });
  it("shows the email for a signed-in user", () => {
    expect(displayName({ is_anonymous: false, email: "a@example.com" })).toBe("a@example.com");
  });
  it("falls back to Guest when there is no email", () => {
    expect(displayName({})).toBe("Guest");
  });
});
