export type QuestionKind = "probe" | "why_today";

export const AXES = ["textual_evidence", "grasp", "connection", "originality"] as const;
export type Axis = (typeof AXES)[number];

export type RubricScores = Record<Axis, number>;

/** Axis weights. Each column sums to 1. */
export const AXIS_WEIGHTS: Record<QuestionKind, RubricScores> = {
  probe: { textual_evidence: 0.35, grasp: 0.35, connection: 0.1, originality: 0.2 },
  why_today: { textual_evidence: 0.25, grasp: 0.2, connection: 0.35, originality: 0.2 },
};

export const AXIS_MAX = 5;

export function clampAxis(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(AXIS_MAX, Math.max(0, value));
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Three grader passes run with different prompts. Taking the per axis median
 * throws out a single pass that drifts.
 */
export function medianRubric(passes: readonly RubricScores[]): RubricScores {
  if (passes.length === 0) throw new Error("no grader passes");
  const out = {} as RubricScores;
  for (const axis of AXES) {
    out[axis] = clampAxis(median(passes.map((pass) => clampAxis(pass[axis]))));
  }
  return out;
}

/** Weighted rubric on a 0 to 100 scale. */
export function weightedScore(rubric: RubricScores, kind: QuestionKind): number {
  const weights = AXIS_WEIGHTS[kind];
  let total = 0;
  for (const axis of AXES) total += clampAxis(rubric[axis]) * weights[axis];
  return (total / AXIS_MAX) * 100;
}

/** An answer flagged unserious loses most of its score. Nothing else penalises. */
export const UNSERIOUS_MULTIPLIER = 0.2;

export function applyPenalties(score: number, flags: readonly string[]): number {
  return flags.includes("unserious") ? score * UNSERIOUS_MULTIPLIER : score;
}
