import { describe, expect, it } from "vitest";

import {
  FREEZE_EVERY_DAYS,
  applyDayOutcome,
  emptyStreak,
  protectedThrough,
  type StreakState,
} from "@/lib/domain/streak";

const state = (over: Partial<StreakState> = {}): StreakState => ({
  ...emptyStreak(),
  ...over,
});

describe("streak rules", () => {
  it("extends on a pass", () => {
    const next = applyDayOutcome(
      state({ current: 3, best: 5, lastPassedDate: "2026-03-04" }),
      "passed",
      "2026-03-05",
    );
    expect(next.current).toBe(4);
    expect(next.lastPassedDate).toBe("2026-03-05");
  });

  it("holds on a sincere miss", () => {
    const next = applyDayOutcome(
      state({ current: 7, best: 7, lastPassedDate: "2026-03-04" }),
      "sincere_miss",
      "2026-03-05",
    );
    expect(next.current).toBe(7);
    expect(next.lastPassedDate).toBe("2026-03-05");
  });

  it("breaks on an unserious flag", () => {
    const next = applyDayOutcome(
      state({ current: 12, best: 12, lastPassedDate: "2026-03-04" }),
      "unserious",
      "2026-03-05",
    );
    expect(next.current).toBe(0);
    expect(next.best).toBe(12);
  });

  it("does not spend a freeze on an unserious day", () => {
    const next = applyDayOutcome(
      state({ current: 12, lastPassedDate: "2026-03-04", freezesAvailable: 2 }),
      "unserious",
      "2026-03-05",
    );
    expect(next.freezesAvailable).toBe(2);
  });

  it("raises the best when the current passes it", () => {
    const next = applyDayOutcome(
      state({ current: 9, best: 9, lastPassedDate: "2026-03-04" }),
      "passed",
      "2026-03-05",
    );
    expect(next.best).toBe(10);
  });

  it("starts a new streak at one after a break", () => {
    const next = applyDayOutcome(
      state({ current: 0, best: 12, lastPassedDate: "2026-03-04" }),
      "passed",
      "2026-03-05",
    );
    expect(next.current).toBe(1);
    expect(next.best).toBe(12);
  });
});

describe("missed days", () => {
  it("resets when a day is missed with no freeze", () => {
    const next = applyDayOutcome(
      state({ current: 6, best: 6, lastPassedDate: "2026-03-01" }),
      "passed",
      "2026-03-04",
    );
    expect(next.current).toBe(1);
  });

  it("bridges missed days with freezes", () => {
    const next = applyDayOutcome(
      state({ current: 6, best: 6, lastPassedDate: "2026-03-01", freezesAvailable: 2 }),
      "passed",
      "2026-03-04",
    );
    expect(next.current).toBe(7);
    expect(next.freezesAvailable).toBe(0);
  });

  it("does not spend freezes it cannot cover the gap with", () => {
    const next = applyDayOutcome(
      state({ current: 6, lastPassedDate: "2026-03-01", freezesAvailable: 1 }),
      "passed",
      "2026-03-05",
    );
    expect(next.current).toBe(1);
    expect(next.freezesAvailable).toBe(1);
  });
});

describe("freezes", () => {
  it("earns one every fourteen days", () => {
    let current = state({ current: FREEZE_EVERY_DAYS - 1, lastPassedDate: "2026-03-01" });
    current = applyDayOutcome(current, "passed", "2026-03-02");
    expect(current.current).toBe(FREEZE_EVERY_DAYS);
    expect(current.freezesAvailable).toBe(1);

    current = applyDayOutcome(current, "passed", "2026-03-03");
    expect(current.freezesAvailable).toBe(1);
  });

  it("does not earn one on a sincere miss", () => {
    const next = applyDayOutcome(
      state({ current: FREEZE_EVERY_DAYS - 1, lastPassedDate: "2026-03-01" }),
      "sincere_miss",
      "2026-03-02",
    );
    expect(next.freezesAvailable).toBe(0);
  });

  it("reports how long the reader is covered for", () => {
    expect(protectedThrough(state({ lastPassedDate: "2026-03-04", freezesAvailable: 2 }))).toBe(
      "2026-03-07",
    );
    expect(protectedThrough(emptyStreak())).toBeNull();
  });
});

describe("replaying a day", () => {
  it("is ignored when the day is already recorded", () => {
    const before = state({ current: 4, lastPassedDate: "2026-03-05" });
    expect(applyDayOutcome(before, "passed", "2026-03-05")).toBe(before);
    expect(applyDayOutcome(before, "unserious", "2026-03-04")).toBe(before);
  });

  it("runs a fourteen day streak end to end", () => {
    let current = emptyStreak();
    for (let day = 1; day <= 14; day++) {
      current = applyDayOutcome(current, "passed", `2026-03-${String(day).padStart(2, "0")}`);
    }
    expect(current.current).toBe(14);
    expect(current.best).toBe(14);
    expect(current.freezesAvailable).toBe(1);
  });
});
