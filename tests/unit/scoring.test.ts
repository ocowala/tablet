import { describe, expect, it } from "vitest";

import {
  AXIS_WEIGHTS,
  applyPenalties,
  median,
  medianRubric,
  weightedScore,
  type RubricScores,
} from "@/lib/domain/rubric";
import { validateAnswer, isLikelyEnglish, MAX_WORDS, MIN_WORDS } from "@/lib/domain/intake";
import { checkQuotes, extractQuotes, hasFabricatedQuote } from "@/lib/domain/quotes";
import { fingerprint } from "@/lib/domain/fingerprint";
import { similarity } from "@/lib/domain/similarity";

const flat = (value: number): RubricScores => ({
  textual_evidence: value,
  grasp: value,
  connection: value,
  originality: value,
});

describe("axis weights", () => {
  it("sums to one for both question kinds", () => {
    for (const kind of ["probe", "why_today"] as const) {
      const total = Object.values(AXIS_WEIGHTS[kind]).reduce((sum, w) => sum + w, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it("weights connection to the present far higher on why today", () => {
    expect(AXIS_WEIGHTS.why_today.connection).toBeGreaterThan(AXIS_WEIGHTS.probe.connection);
    expect(AXIS_WEIGHTS.probe.grasp).toBeGreaterThan(AXIS_WEIGHTS.why_today.grasp);
  });
});

describe("weighted score", () => {
  it("runs 0 to 100", () => {
    expect(weightedScore(flat(0), "probe")).toBe(0);
    expect(weightedScore(flat(5), "probe")).toBe(100);
  });

  it("scores the same answer differently by question kind", () => {
    const evidenceHeavy: RubricScores = {
      textual_evidence: 5,
      grasp: 5,
      connection: 0,
      originality: 2,
    };
    expect(weightedScore(evidenceHeavy, "probe")).toBeGreaterThan(
      weightedScore(evidenceHeavy, "why_today"),
    );
  });

  it("clamps axes that come back out of range", () => {
    expect(weightedScore(flat(9), "probe")).toBe(100);
    expect(weightedScore(flat(-3), "probe")).toBe(0);
  });
});

describe("median of grader passes", () => {
  it("takes the middle of an odd list", () => {
    expect(median([1, 5, 3])).toBe(3);
  });

  it("averages the middle of an even list", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("throws out a single drifting pass", () => {
    const rubric = medianRubric([flat(3), flat(3), flat(5)]);
    expect(rubric.grasp).toBe(3);
  });

  it("medians each axis on its own", () => {
    const rubric = medianRubric([
      { textual_evidence: 5, grasp: 1, connection: 2, originality: 4 },
      { textual_evidence: 3, grasp: 3, connection: 2, originality: 1 },
      { textual_evidence: 4, grasp: 2, connection: 5, originality: 2 },
    ]);
    expect(rubric).toEqual({
      textual_evidence: 4,
      grasp: 2,
      connection: 2,
      originality: 2,
    });
  });

  it("works with two surviving passes", () => {
    expect(medianRubric([flat(2), flat(4)]).grasp).toBe(3);
  });
});

describe("penalties", () => {
  it("only unserious costs anything", () => {
    expect(applyPenalties(80, [])).toBe(80);
    expect(applyPenalties(80, ["ai_pool_match", "peer_match", "fabricated_quote"])).toBe(80);
    expect(applyPenalties(80, ["unserious"])).toBeLessThan(80);
  });
});

describe("intake", () => {
  const good = Array.from({ length: 40 }, () => "the reader is looking at what the text says").join(" ");

  it("accepts an answer in range", () => {
    const result = validateAnswer("The argument is that detail eats a life, which is why he reduces his affairs to two or three rather than adding more of them.");
    expect(result.ok).toBe(true);
  });

  it("rejects an answer under the floor", () => {
    const result = validateAnswer("Too short.");
    expect(result).toMatchObject({ ok: false, reason: "too_short" });
  });

  it("rejects an answer over the ceiling", () => {
    const result = validateAnswer(good);
    expect(result).toMatchObject({ ok: false, reason: "too_long" });
    expect(MAX_WORDS).toBeGreaterThan(MIN_WORDS);
  });

  it("blocks a large single event insertion", () => {
    const body = "He frames the whole passage as an experiment with a hypothesis he might fail, which is why he says he did not wish to practise resignation at all.";
    expect(validateAnswer(body, 400)).toMatchObject({ ok: false, reason: "bulk_insert" });
    expect(validateAnswer(body, 40).ok).toBe(true);
  });

  it("rejects an answer that is not English", () => {
    const body = "这是一段很长的中文答案用来测试语言检测是否正常工作以及是否会被拒绝掉因为它不是英文写的内容并且长度足够超过最低字数要求所以应该被拒绝。";
    expect(isLikelyEnglish(body)).toBe(false);
  });
});

describe("quotes", () => {
  const paragraphs = [
    "I went to the woods because I wished to live deliberately.",
    "Our life is frittered away by detail.",
  ];

  it("pulls quoted spans of four words or more", () => {
    expect(extractQuotes('He says "live deliberately" and also "our life is frittered away".')).toEqual([
      "our life is frittered away",
    ]);
  });

  it("finds a quote that is really in the text", () => {
    const checks = checkQuotes('He writes "our life is frittered away by detail".', paragraphs);
    expect(checks[0].found).toBe(true);
    expect(hasFabricatedQuote(checks)).toBe(false);
  });

  it("catches an invented quote", () => {
    const checks = checkQuotes('He writes "the woods were full of quiet money".', paragraphs);
    expect(checks[0].found).toBe(false);
    expect(hasFabricatedQuote(checks)).toBe(true);
  });

  it("ignores punctuation and case when matching", () => {
    const checks = checkQuotes('He writes "Our Life Is Frittered Away, by detail!"', paragraphs);
    expect(checks[0].found).toBe(true);
  });
});

describe("fingerprint", () => {
  const question = "q-1";

  it("ignores case, punctuation and spacing", () => {
    expect(fingerprint(question, "The  argument, is subtraction.")).toBe(
      fingerprint(question, "the argument is subtraction"),
    );
  });

  it("separates different answers", () => {
    expect(fingerprint(question, "one reading")).not.toBe(fingerprint(question, "another reading"));
  });

  it("separates the same answer on different questions", () => {
    expect(fingerprint("q-1", "same words")).not.toBe(fingerprint("q-2", "same words"));
  });
});

describe("similarity", () => {
  it("scores a copy near one", () => {
    const body = "Conformity is expensive because it scatters your force and blurs your character.";
    expect(similarity(body, body)).toBeGreaterThan(0.95);
  });

  it("scores unrelated answers low", () => {
    expect(
      similarity(
        "Conformity is expensive because it scatters your force.",
        "The fishing image at the end measures how shallow time turns out to be.",
      ),
    ).toBeLessThan(0.3);
  });
});
