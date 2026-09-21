import { describe, expect, it } from "vitest";

import { dayOutcomeFor, finalizeDay, type RolloverQuestion } from "@/lib/domain/rollover";
import { emptyStreak, type StreakState } from "@/lib/domain/streak";

const probe: RolloverQuestion = { id: "p1", kind: "probe", passPercentile: 40, maxTries: 2 };
const whyToday: RolloverQuestion = {
  id: "w1",
  kind: "why_today",
  passPercentile: 45,
  maxTries: 3,
};

const attempt = (over: Partial<Parameters<typeof finalizeDay>[0]["attempts"][number]>) => ({
  id: "a1",
  userId: "u1",
  questionId: whyToday.id,
  kind: "why_today" as const,
  tryNo: 1,
  score: 60,
  flags: [] as string[],
  ...over,
});

describe("day outcome", () => {
  it("passes when why today clears the hidden threshold", () => {
    const outcome = dayOutcomeFor([attempt({})], whyToday, new Map([["a1", 70]]));
    expect(outcome).toBe("passed");
  });

  it("is a sincere miss when why today falls short", () => {
    const outcome = dayOutcomeFor([attempt({})], whyToday, new Map([["a1", 20]]));
    expect(outcome).toBe("sincere_miss");
  });

  it("is unserious when any answer that day was unserious", () => {
    const outcome = dayOutcomeFor(
      [attempt({ id: "a0", questionId: probe.id, kind: "probe", flags: ["unserious"] }), attempt({})],
      whyToday,
      new Map([["a1", 90]]),
    );
    expect(outcome).toBe("unserious");
  });

  it("ignores flags that carry no penalty", () => {
    const outcome = dayOutcomeFor(
      [attempt({ flags: ["ai_pool_match", "fabricated_quote"] })],
      whyToday,
      new Map([["a1", 90]]),
    );
    expect(outcome).toBe("passed");
  });

  it("has no outcome for a reader who never reached why today", () => {
    const outcome = dayOutcomeFor(
      [attempt({ id: "a0", questionId: probe.id, kind: "probe" })],
      whyToday,
      new Map([["a0", 80]]),
    );
    expect(outcome).toBeNull();
  });

  it("has no outcome for a reader who did not show up", () => {
    expect(dayOutcomeFor([], whyToday, new Map())).toBeNull();
  });
});

describe("finalize day", () => {
  const streaks = new Map<string, StreakState>([
    ["u1", { ...emptyStreak(), current: 3, best: 3, lastPassedDate: "2026-03-04" }],
    ["u2", { ...emptyStreak(), current: 8, best: 9, lastPassedDate: "2026-03-04" }],
  ]);

  const result = finalizeDay({
    date: "2026-03-05",
    questions: [probe, whyToday],
    streaks,
    attempts: [
      attempt({ id: "u1w", userId: "u1", score: 80 }),
      attempt({ id: "u2w", userId: "u2", score: 20 }),
      attempt({ id: "u3w", userId: "u3", score: 50, flags: ["unserious"] }),
      attempt({ id: "u1p", userId: "u1", questionId: probe.id, kind: "probe", score: 70 }),
      attempt({ id: "u2p", userId: "u2", questionId: probe.id, kind: "probe", score: 30 }),
    ],
  });

  it("recomputes every percentile against the real field", () => {
    expect(result.percentiles.get("u1w")).toBe(67);
    expect(result.percentiles.get("u2w")).toBe(1);
    expect(result.percentiles.get("u1p")).toBe(50);
  });

  it("extends a passing reader's streak", () => {
    expect(result.outcomes.get("u1")).toBe("passed");
    expect(result.streaks.get("u1")).toMatchObject({ current: 4, lastPassedDate: "2026-03-05" });
  });

  it("holds a sincere miss", () => {
    expect(result.outcomes.get("u2")).toBe("sincere_miss");
    expect(result.streaks.get("u2")).toMatchObject({ current: 8, best: 9 });
  });

  it("breaks an unserious reader who had no streak row yet", () => {
    expect(result.outcomes.get("u3")).toBe("unserious");
    expect(result.streaks.get("u3")).toMatchObject({ current: 0 });
  });

  it("settles every reader who reached why today", () => {
    expect([...result.outcomes.keys()].sort()).toEqual(["u1", "u2", "u3"]);
  });
});
