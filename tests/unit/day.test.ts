import { describe, expect, it } from "vitest";

import {
  addDays,
  canChangeTimezone,
  daysBetween,
  issueDateFor,
  isValidTimeZone,
  msUntilNextDrop,
} from "@/lib/domain/day";

describe("issue date", () => {
  it("is yesterday's issue before the 5am drop", () => {
    // 04:30 in New York on 5 March.
    const at = new Date("2026-03-05T09:30:00Z");
    expect(issueDateFor(at, "America/New_York")).toBe("2026-03-04");
  });

  it("flips to today at the drop", () => {
    const at = new Date("2026-03-05T10:00:00Z"); // 05:00 in New York
    expect(issueDateFor(at, "America/New_York")).toBe("2026-03-05");
  });

  it("uses the reader's own time zone, not the server's", () => {
    const at = new Date("2026-03-05T20:00:00Z");
    // The same instant sits on three different issues.
    expect(issueDateFor(at, "America/New_York")).toBe("2026-03-05"); // 15:00 on the 5th
    expect(issueDateFor(at, "Asia/Kolkata")).toBe("2026-03-05"); // 01:30 on the 6th, before the drop
    expect(issueDateFor(at, "Asia/Tokyo")).toBe("2026-03-06"); // 05:00 on the 6th, at the drop
  });

  it("handles a spring forward without skipping an issue", () => {
    // US daylight saving begins 8 March 2026.
    const before = new Date("2026-03-08T06:00:00Z"); // 01:00 EST
    const after = new Date("2026-03-08T11:00:00Z"); // 07:00 EDT
    expect(issueDateFor(before, "America/New_York")).toBe("2026-03-07");
    expect(issueDateFor(after, "America/New_York")).toBe("2026-03-08");
  });

  it("counts down to the next drop", () => {
    const at = new Date("2026-03-05T09:30:00Z"); // 04:30 in New York
    expect(msUntilNextDrop(at, "America/New_York")).toBe(30 * 60 * 1000);
  });

  it("wraps the countdown past midnight", () => {
    const at = new Date("2026-03-05T11:00:00Z"); // 06:00 in New York
    expect(msUntilNextDrop(at, "America/New_York")).toBe(23 * 60 * 60 * 1000);
  });
});

describe("date helpers", () => {
  it("adds and subtracts days across a month boundary", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("measures the gap between dates", () => {
    expect(daysBetween("2026-03-01", "2026-03-04")).toBe(3);
    expect(daysBetween("2026-03-04", "2026-03-04")).toBe(0);
  });

  it("knows a real time zone from a made up one", () => {
    expect(isValidTimeZone("Europe/Lisbon")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("time zone changes", () => {
  const now = new Date("2026-03-05T00:00:00Z");

  it("allows the first change", () => {
    expect(canChangeTimezone(null, now)).toBe(true);
  });

  it("holds a change inside thirty days", () => {
    expect(canChangeTimezone(new Date("2026-02-20T00:00:00Z"), now)).toBe(false);
  });

  it("allows a change after thirty days", () => {
    expect(canChangeTimezone(new Date("2026-01-20T00:00:00Z"), now)).toBe(true);
  });
});
