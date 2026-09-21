import { describe, expect, it } from "vitest";

import { DEFAULT_MAX_TRIES, outcomeFor, passes } from "@/lib/domain/threshold";
import { toPublicQuestion } from "@/lib/domain/publish";
import type { QuestionRecord } from "@/lib/types";

describe("hidden thresholds", () => {
  it("passes at or above the threshold", () => {
    expect(passes(40, 40)).toBe(true);
    expect(passes(41, 40)).toBe(true);
    expect(passes(39, 40)).toBe(false);
  });

  it("gives two tries on a probe and three on why today", () => {
    expect(DEFAULT_MAX_TRIES.probe).toBe(2);
    expect(DEFAULT_MAX_TRIES.why_today).toBe(3);
  });

  it("is unsettled while a try remains and the reader has not passed", () => {
    const outcome = outcomeFor(20, 40, 1, 2);
    expect(outcome).toMatchObject({ passed: false, triesLeft: 1, settled: false });
  });

  it("settles once the tries run out", () => {
    const outcome = outcomeFor(20, 40, 2, 2);
    expect(outcome).toMatchObject({ passed: false, triesLeft: 0, settled: true });
  });

  it("settles on a pass even with tries left", () => {
    const outcome = outcomeFor(70, 40, 1, 3);
    expect(outcome).toMatchObject({ passed: true, triesLeft: 2, settled: true });
  });

  it("never sends the threshold to the client", () => {
    const question: QuestionRecord = {
      id: "q1",
      text_id: "t1",
      kind: "probe",
      order: 0,
      prompt: "Why?",
      trigger_paragraph: 2,
      min_seconds: 60,
      pass_percentile: 40,
      max_tries: 2,
    };
    const published = toPublicQuestion(question);
    expect(published).not.toHaveProperty("pass_percentile");
    expect(JSON.stringify(published)).not.toContain("pass_percentile");
  });
});
