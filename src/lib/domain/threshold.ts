import type { QuestionKind } from "./rubric";

/**
 * Thresholds are hidden. Nothing in this module may be serialised to the
 * client: the reader only ever sees their percentile.
 */

export const DEFAULT_PASS_PERCENTILE = 40;

export const DEFAULT_MAX_TRIES: Record<QuestionKind, number> = {
  probe: 2,
  why_today: 3,
};

export function passes(percentile: number, passPercentile: number): boolean {
  return percentile >= passPercentile;
}

export type AttemptOutcome = {
  passed: boolean;
  triesUsed: number;
  triesLeft: number;
  /** True once the reader has passed or run out of tries. */
  settled: boolean;
};

export function outcomeFor(
  percentile: number,
  passPercentile: number,
  triesUsed: number,
  maxTries: number,
): AttemptOutcome {
  const passed = passes(percentile, passPercentile);
  const triesLeft = Math.max(0, maxTries - triesUsed);
  return { passed, triesUsed, triesLeft, settled: passed || triesLeft === 0 };
}
