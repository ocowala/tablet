/**
 * Percentiles. During the day a reader is placed against a calibration curve
 * built from past answers at similar difficulty. At day close everyone is
 * recomputed against the real field for that question.
 */

export const MIN_PERCENTILE = 1;
export const MAX_PERCENTILE = 99;

export type CalibrationPoint = { score: number; percentile: number };
export type CalibrationCurve = {
  difficulty: number;
  /** Ascending by score. */
  points: CalibrationPoint[];
};

export function clampPercentile(value: number): number {
  if (!Number.isFinite(value)) return MIN_PERCENTILE;
  return Math.min(MAX_PERCENTILE, Math.max(MIN_PERCENTILE, Math.round(value)));
}

/** Monotone piecewise linear read of the curve, clamped to the display range. */
export function provisionalPercentile(score: number, curve: CalibrationCurve): number {
  const points = [...curve.points].sort((a, b) => a.score - b.score);
  if (points.length === 0) return clampPercentile(score);
  if (score <= points[0].score) return clampPercentile(points[0].percentile);
  const last = points[points.length - 1];
  if (score >= last.score) return clampPercentile(last.percentile);

  for (let i = 1; i < points.length; i++) {
    const left = points[i - 1];
    const right = points[i];
    if (score <= right.score) {
      const span = right.score - left.score;
      const ratio = span === 0 ? 0 : (score - left.score) / span;
      return clampPercentile(left.percentile + ratio * (right.percentile - left.percentile));
    }
  }
  return clampPercentile(last.percentile);
}

/** The reader beats the share of the field that scored strictly lower. */
export function percentileInField(score: number, field: readonly number[]): number {
  if (field.length === 0) return clampPercentile(50);
  let below = 0;
  for (const other of field) if (other < score) below++;
  return clampPercentile((below / field.length) * 100);
}

export type ScoredAttempt = { id: string; questionId: string; score: number };

/**
 * Day close. Each question is its own field, and only a reader's best attempt
 * on a question counts towards the field so extra tries do not drag it down.
 */
export function recomputePercentiles(
  attempts: readonly (ScoredAttempt & { userId: string })[],
): Map<string, number> {
  const byQuestion = new Map<string, (ScoredAttempt & { userId: string })[]>();
  for (const attempt of attempts) {
    const bucket = byQuestion.get(attempt.questionId) ?? [];
    bucket.push(attempt);
    byQuestion.set(attempt.questionId, bucket);
  }

  const out = new Map<string, number>();
  for (const [, bucket] of byQuestion) {
    const bestByUser = new Map<string, number>();
    for (const attempt of bucket) {
      const current = bestByUser.get(attempt.userId);
      if (current === undefined || attempt.score > current) {
        bestByUser.set(attempt.userId, attempt.score);
      }
    }
    const field = [...bestByUser.values()];
    for (const attempt of bucket) {
      out.set(attempt.id, percentileInField(attempt.score, field));
    }
  }
  return out;
}

/**
 * Builds the next day's curve from a finished field. Stored per difficulty and
 * read back as the provisional curve.
 */
export function buildCalibrationCurve(
  difficulty: number,
  scores: readonly number[],
  steps = 20,
): CalibrationCurve {
  const sorted = [...scores].sort((a, b) => a - b);
  if (sorted.length === 0) return { difficulty, points: [] };
  const points: CalibrationPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const index = Math.min(sorted.length - 1, Math.floor(ratio * (sorted.length - 1)));
    const score = sorted[index];
    points.push({ score, percentile: clampPercentile(percentileInField(score, sorted)) });
  }
  // Collapse duplicate scores so the curve stays monotone and readable.
  return {
    difficulty,
    points: points.filter((point, i) => i === 0 || point.score > points[i - 1].score),
  };
}
