import { describe, expect, it } from "vitest";

import {
  buildCalibrationCurve,
  clampPercentile,
  percentileInField,
  provisionalPercentile,
  recomputePercentiles,
  type CalibrationCurve,
} from "@/lib/domain/percentile";

const curve: CalibrationCurve = {
  difficulty: 3,
  points: [
    { score: 0, percentile: 1 },
    { score: 50, percentile: 50 },
    { score: 100, percentile: 99 },
  ],
};

describe("display range", () => {
  it("never shows 0 or 100", () => {
    expect(clampPercentile(-20)).toBe(1);
    expect(clampPercentile(0)).toBe(1);
    expect(clampPercentile(100)).toBe(99);
    expect(clampPercentile(140)).toBe(99);
  });
});

describe("provisional percentile", () => {
  it("interpolates between curve points", () => {
    expect(provisionalPercentile(25, curve)).toBe(26);
    expect(provisionalPercentile(75, curve)).toBe(75);
  });

  it("holds at the ends of the curve", () => {
    expect(provisionalPercentile(-10, curve)).toBe(1);
    expect(provisionalPercentile(1000, curve)).toBe(99);
  });

  it("rises with the score", () => {
    let previous = 0;
    for (const score of [10, 30, 50, 70, 90]) {
      const value = provisionalPercentile(score, curve);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("falls back sanely on an empty curve", () => {
    expect(provisionalPercentile(60, { difficulty: 3, points: [] })).toBe(60);
  });
});

describe("percentile in a real field", () => {
  it("counts the share the reader beats", () => {
    expect(percentileInField(50, [10, 20, 30, 40])).toBe(99);
    expect(percentileInField(25, [10, 20, 30, 40])).toBe(50);
    expect(percentileInField(5, [10, 20, 30, 40])).toBe(1);
  });

  it("gives everyone the same place on a tie", () => {
    expect(percentileInField(20, [20, 20, 20, 20])).toBe(1);
  });
});

describe("day close recompute", () => {
  it("scores each question against its own field", () => {
    const percentiles = recomputePercentiles([
      { id: "a", userId: "u1", questionId: "q1", score: 90 },
      { id: "b", userId: "u2", questionId: "q1", score: 10 },
      { id: "c", userId: "u3", questionId: "q2", score: 10 },
      { id: "d", userId: "u4", questionId: "q2", score: 5 },
    ]);
    expect(percentiles.get("a")).toBe(50);
    expect(percentiles.get("b")).toBe(1);
    expect(percentiles.get("c")).toBe(50);
  });

  it("counts a reader once, at their best, so extra tries do not drag the field", () => {
    const percentiles = recomputePercentiles([
      { id: "a1", userId: "u1", questionId: "q1", score: 10 },
      { id: "a2", userId: "u1", questionId: "q1", score: 80 },
      { id: "b", userId: "u2", questionId: "q1", score: 40 },
    ]);
    // The field is {80, 40}, so the second try beats half of it.
    expect(percentiles.get("a2")).toBe(50);
    expect(percentiles.get("b")).toBe(1);
  });
});

describe("calibration curve", () => {
  it("is monotone in score and percentile", () => {
    const scores = Array.from({ length: 100 }, (_, i) => i);
    const built = buildCalibrationCurve(3, scores);
    for (let i = 1; i < built.points.length; i++) {
      expect(built.points[i].score).toBeGreaterThan(built.points[i - 1].score);
      expect(built.points[i].percentile).toBeGreaterThanOrEqual(built.points[i - 1].percentile);
    }
  });

  it("returns nothing to read from an empty day", () => {
    expect(buildCalibrationCurve(3, []).points).toEqual([]);
  });
});
