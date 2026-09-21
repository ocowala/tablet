import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildCalibrationCurve } from "@/lib/domain/percentile";
import { finalizeDay, type RolloverAttempt, type RolloverQuestion } from "@/lib/domain/rollover";
import { emptyStreak, type StreakState } from "@/lib/domain/streak";

export type RolloverReport = {
  date: string;
  attemptsScored: number;
  readersSettled: number;
  skipped: boolean;
};

/**
 * Day close. Recomputes every percentile against the real field, settles
 * streaks, then rebuilds the calibration curve the next day reads from.
 * Idempotent: a date already rolled over is left alone.
 */
export async function runRollover(date: string, force = false): Promise<RolloverReport> {
  const admin = createAdminClient();

  if (!force) {
    const { data: already } = await admin
      .from("rollovers")
      .select("date")
      .eq("date", date)
      .maybeSingle();
    if (already) return { date, attemptsScored: 0, readersSettled: 0, skipped: true };
  }

  const { data: scheduled } = await admin
    .from("schedule")
    .select("text_id, texts(difficulty)")
    .eq("date", date)
    .maybeSingle();
  if (!scheduled) return { date, attemptsScored: 0, readersSettled: 0, skipped: true };

  const textId = scheduled.text_id as string;
  const difficulty = (scheduled.texts as unknown as { difficulty: number } | null)?.difficulty ?? 3;

  const { data: questionRows } = await admin
    .from("questions")
    .select("id, kind, pass_percentile, max_tries")
    .eq("text_id", textId);
  const questions: RolloverQuestion[] = (questionRows ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    passPercentile: row.pass_percentile,
    maxTries: row.max_tries,
  }));

  const questionIds = questions.map((question) => question.id);
  if (questionIds.length === 0) {
    return { date, attemptsScored: 0, readersSettled: 0, skipped: true };
  }

  const { data: attemptRows } = await admin
    .from("attempts")
    .select("id, user_id, question_id, try_no, score, flags")
    .in("question_id", questionIds);

  const kindOf = new Map(questions.map((question) => [question.id, question.kind]));
  const attempts: RolloverAttempt[] = (attemptRows ?? [])
    .filter((row) => row.score !== null)
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      questionId: row.question_id,
      kind: kindOf.get(row.question_id)!,
      tryNo: row.try_no,
      score: row.score as number,
      flags: (row.flags ?? []) as string[],
    }));

  const userIds = [...new Set(attempts.map((attempt) => attempt.userId))];
  const { data: streakRows } = await admin
    .from("streaks")
    .select("user_id, current, best, last_passed_date, freezes_available")
    .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const streaks = new Map<string, StreakState>(
    (streakRows ?? []).map((row) => [
      row.user_id,
      {
        current: row.current,
        best: row.best,
        lastPassedDate: row.last_passed_date,
        freezesAvailable: row.freezes_available,
      },
    ]),
  );
  for (const userId of userIds) if (!streaks.has(userId)) streaks.set(userId, emptyStreak());

  const result = finalizeDay({ date, attempts, questions, streaks });

  for (const [attemptId, percentile] of result.percentiles) {
    await admin.from("attempts").update({ percentile_final: percentile }).eq("id", attemptId);
  }

  for (const [userId, streak] of result.streaks) {
    await admin.from("streaks").upsert({
      user_id: userId,
      current: streak.current,
      best: streak.best,
      last_passed_date: streak.lastPassedDate,
      freezes_available: streak.freezesAvailable,
    });
  }

  // Tomorrow's provisional percentiles read from today's finished field.
  const bestPerReader = new Map<string, number>();
  for (const attempt of attempts) {
    const key = `${attempt.userId}:${attempt.questionId}`;
    const current = bestPerReader.get(key);
    if (current === undefined || attempt.score > current) bestPerReader.set(key, attempt.score);
  }
  const curve = buildCalibrationCurve(difficulty, [...bestPerReader.values()]);
  if (curve.points.length > 0) {
    await admin
      .from("calibration_curves")
      .upsert({ difficulty, points: curve.points, updated_at: new Date().toISOString() });
  }

  await admin.from("rollovers").upsert({
    date,
    ran_at: new Date().toISOString(),
    attempts_scored: result.percentiles.size,
    readers_settled: result.outcomes.size,
  });

  return {
    date,
    attemptsScored: result.percentiles.size,
    readersSettled: result.outcomes.size,
    skipped: false,
  };
}
