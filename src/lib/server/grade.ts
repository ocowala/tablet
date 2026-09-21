import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fingerprint } from "@/lib/domain/fingerprint";
import { INTAKE_MESSAGES, validateAnswer } from "@/lib/domain/intake";
import { checkQuotes, hasFabricatedQuote } from "@/lib/domain/quotes";
import { runIntegrityChecks } from "@/lib/domain/integrity";
import { applyPenalties, weightedScore } from "@/lib/domain/rubric";
import { provisionalPercentile, type CalibrationCurve } from "@/lib/domain/percentile";
import { outcomeFor } from "@/lib/domain/threshold";
import { issueDateFor } from "@/lib/domain/day";
import type { AnchorAnswer, PublicAttempt, QuestionRecord, TextRecord } from "@/lib/types";
import type { CurrentUser } from "./auth";
import { gradeAnswer } from "./grader";

export type GradeFailure =
  | { ok: false; error: "intake"; message: string }
  | { ok: false; error: "no_tries"; message: string }
  | { ok: false; error: "not_open"; message: string }
  | { ok: false; error: "grader"; message: string };

export type GradeSuccess = { ok: true; attempt: PublicAttempt; cached: boolean };

export type GradeOutcome = GradeSuccess | GradeFailure;

/**
 * The scoring pipeline. Runs only on the server, and returns only what the
 * reader is allowed to see: their percentile and whether to move on.
 */
export async function submitAnswer(
  user: CurrentUser,
  questionId: string,
  body: string,
  largestInsertChars = 0,
  now = new Date(),
): Promise<GradeOutcome> {
  const admin = createAdminClient();

  const { data: question } = await admin
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .maybeSingle<QuestionRecord>();
  if (!question) return { ok: false, error: "not_open", message: "Question not found." };

  // The text has to be the one open for this reader right now.
  const date = issueDateFor(now, user.homeTimezone);
  const { data: scheduled } = await admin
    .from("schedule")
    .select("text_id")
    .eq("date", date)
    .maybeSingle();
  if (!scheduled || scheduled.text_id !== question.text_id) {
    return { ok: false, error: "not_open", message: "That text is closed." };
  }

  const mark = fingerprint(question.id, body);

  // 2. Fingerprint. A near identical resubmission replays the cached result
  // and does not spend a try.
  const { data: priorAttempts } = await admin
    .from("attempts")
    .select("id, try_no, body, fingerprint, percentile_provisional, percentile_final")
    .eq("user_id", user.id)
    .eq("question_id", question.id)
    .order("try_no", { ascending: true });

  const prior = priorAttempts ?? [];
  const repeat = prior.find((attempt) => attempt.fingerprint === mark);
  if (repeat) {
    const percentile = repeat.percentile_final ?? repeat.percentile_provisional ?? 1;
    const outcome = outcomeFor(percentile, question.pass_percentile, prior.length, question.max_tries);
    return {
      ok: true,
      cached: true,
      attempt: {
        id: repeat.id,
        question_id: question.id,
        try_no: repeat.try_no,
        body: repeat.body,
        percentile,
        passed: outcome.passed,
        tries_left: outcome.triesLeft,
        settled: outcome.settled,
      },
    };
  }

  if (prior.length >= question.max_tries) {
    return { ok: false, error: "no_tries", message: "No tries left on this question." };
  }

  // 1. Intake.
  const intake = validateAnswer(body, largestInsertChars);
  if (!intake.ok) {
    return { ok: false, error: "intake", message: INTAKE_MESSAGES[intake.reason] };
  }

  const { data: text } = await admin
    .from("texts")
    .select("*")
    .eq("id", question.text_id)
    .maybeSingle<TextRecord>();
  if (!text) return { ok: false, error: "not_open", message: "Text not found." };

  const [{ data: dossier }, { data: pool }, { data: peers }] = await Promise.all([
    admin
      .from("dossiers")
      .select("curator_note, anchor_answers")
      .eq("text_id", text.id)
      .maybeSingle(),
    admin.from("ai_answer_pool").select("body").eq("text_id", text.id).eq("kind", question.kind),
    admin
      .from("attempts")
      .select("body")
      .eq("question_id", question.id)
      .neq("user_id", user.id)
      .limit(400),
  ]);

  // 4. Rubric, with cited quotes checked against the real text first.
  const quoteChecks = checkQuotes(body, text.body);
  let graded;
  try {
    graded = await gradeAnswer({
      kind: question.kind,
      prompt: question.prompt,
      paragraphs: text.body,
      anchors: (dossier?.anchor_answers ?? []) as AnchorAnswer[],
      quoteChecks,
      body,
    });
  } catch (error) {
    console.error("grading failed", error);
    return { ok: false, error: "grader", message: "Something went wrong. Try again." };
  }

  // 3. Integrity checks. Only unserious carries a penalty.
  const integrity = runIntegrityChecks({
    body,
    aiPool: (pool ?? []).map((row) => row.body as string),
    peerAnswers: (peers ?? []).map((row) => row.body as string),
    curatorNote: dossier?.curator_note ?? "",
    fabricatedQuote: hasFabricatedQuote(quoteChecks),
    graderUnserious: graded.unserious,
  });

  // 5 and 6. Weighted score, then a provisional percentile off the curve.
  const score = applyPenalties(weightedScore(graded.rubric, question.kind), integrity.flags);
  const curve = await loadCurve(text.difficulty);
  const percentile = provisionalPercentile(score, curve);

  const tryNo = prior.length + 1;
  const { data: inserted, error } = await admin
    .from("attempts")
    .insert({
      user_id: user.id,
      question_id: question.id,
      try_no: tryNo,
      body,
      fingerprint: mark,
      rubric: graded.rubric,
      score,
      percentile_provisional: percentile,
      flags: integrity.flags,
    })
    .select("id")
    .single();
  if (error) throw error;

  const outcome = outcomeFor(percentile, question.pass_percentile, tryNo, question.max_tries);
  return {
    ok: true,
    cached: false,
    attempt: {
      id: inserted.id,
      question_id: question.id,
      try_no: tryNo,
      body,
      percentile,
      passed: outcome.passed,
      tries_left: outcome.triesLeft,
      settled: outcome.settled,
    },
  };
}

/** Falls back to a flat curve so a fresh install still returns sane numbers. */
export async function loadCurve(difficulty: number): Promise<CalibrationCurve> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("calibration_curves")
    .select("points")
    .eq("difficulty", difficulty)
    .maybeSingle();
  const points = (data?.points ?? []) as CalibrationCurve["points"];
  if (points.length > 0) return { difficulty, points };
  return {
    difficulty,
    points: [
      { score: 0, percentile: 1 },
      { score: 30, percentile: 15 },
      { score: 45, percentile: 35 },
      { score: 60, percentile: 60 },
      { score: 75, percentile: 82 },
      { score: 90, percentile: 96 },
      { score: 100, percentile: 99 },
    ],
  };
}
