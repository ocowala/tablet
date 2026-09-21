import { recomputePercentiles } from "./percentile";
import { applyDayOutcome, emptyStreak, type DayOutcome, type StreakState } from "./streak";
import type { QuestionKind } from "./rubric";

export type RolloverAttempt = {
  id: string;
  userId: string;
  questionId: string;
  kind: QuestionKind;
  tryNo: number;
  score: number;
  flags: string[];
};

export type RolloverQuestion = {
  id: string;
  kind: QuestionKind;
  passPercentile: number;
  maxTries: number;
};

export type RolloverInput = {
  date: string;
  attempts: readonly RolloverAttempt[];
  questions: readonly RolloverQuestion[];
  streaks: ReadonlyMap<string, StreakState>;
};

export type RolloverResult = {
  /** attempt id to final percentile */
  percentiles: Map<string, number>;
  outcomes: Map<string, DayOutcome>;
  streaks: Map<string, StreakState>;
};

/**
 * A reader's day:
 * - any unserious answer breaks the streak, whatever else happened
 * - clearing the hidden threshold on why today extends it
 * - anything else sincere holds it
 * - readers who never reached why today have no outcome, so the day counts as
 *   missed and is bridged by a freeze if they have one
 */
export function dayOutcomeFor(
  attempts: readonly RolloverAttempt[],
  whyToday: RolloverQuestion | undefined,
  percentiles: ReadonlyMap<string, number>,
): DayOutcome | null {
  if (attempts.length === 0) return null;
  if (attempts.some((attempt) => attempt.flags.includes("unserious"))) return "unserious";
  if (!whyToday) return null;

  const whyTodayAttempts = attempts.filter((attempt) => attempt.questionId === whyToday.id);
  if (whyTodayAttempts.length === 0) return null;

  const passed = whyTodayAttempts.some(
    (attempt) => (percentiles.get(attempt.id) ?? 0) >= whyToday.passPercentile,
  );
  return passed ? "passed" : "sincere_miss";
}

/** The day close job. Pure, so the scheduled route stays a thin wrapper. */
export function finalizeDay(input: RolloverInput): RolloverResult {
  const percentiles = recomputePercentiles(
    input.attempts.map((attempt) => ({
      id: attempt.id,
      userId: attempt.userId,
      questionId: attempt.questionId,
      score: attempt.score,
    })),
  );

  const whyToday = input.questions.find((question) => question.kind === "why_today");

  const byUser = new Map<string, RolloverAttempt[]>();
  for (const attempt of input.attempts) {
    const bucket = byUser.get(attempt.userId) ?? [];
    bucket.push(attempt);
    byUser.set(attempt.userId, bucket);
  }

  const outcomes = new Map<string, DayOutcome>();
  const streaks = new Map<string, StreakState>();
  for (const [userId, attempts] of byUser) {
    const outcome = dayOutcomeFor(attempts, whyToday, percentiles);
    if (!outcome) continue;
    outcomes.set(userId, outcome);
    const before = input.streaks.get(userId) ?? emptyStreak();
    streaks.set(userId, applyDayOutcome(before, outcome, input.date));
  }

  return { percentiles, outcomes, streaks };
}
