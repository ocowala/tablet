import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { issueDateFor } from "@/lib/domain/day";
import { emptyStreak, type StreakState } from "@/lib/domain/streak";
import { outcomeFor } from "@/lib/domain/threshold";
import { toPublicQuestion } from "@/lib/domain/publish";
import type {
  DossierRecord,
  HighlightRecord,
  PublicAttempt,
  PublicQuestion,
  QuestionRecord,
  TextRecord,
} from "@/lib/types";

/** A signed out reader still gets the text. Only their own state is missing. */
export type Viewer = { id: string | null; homeTimezone: string };

export type TodayView = {
  date: string;
  text: TextRecord;
  questions: PublicQuestion[];
  dossier: Pick<DossierRecord, "curator_note">;
  session: { scrollProgress: number; lastParagraph: number; completedAt: string | null };
  attempts: PublicAttempt[];
  highlights: HighlightRecord[];
  streak: StreakState;
};

export async function loadQuestions(textId: string): Promise<QuestionRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("questions")
    .select("*")
    .eq("text_id", textId)
    .order("kind", { ascending: true })
    .order("order", { ascending: true });
  if (error) throw error;
  // probe questions first, then why today, each in their own order
  return (data as QuestionRecord[]).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "probe" ? -1 : 1;
    return a.order - b.order;
  });
}

/** Everything the reading screen needs, in one round of queries. */
export async function loadToday(viewer: Viewer, now = new Date()): Promise<TodayView | null> {
  const admin = createAdminClient();
  const date = issueDateFor(now, viewer.homeTimezone);
  const userId = viewer.id;
  const noRow = "00000000-0000-0000-0000-000000000000";

  const { data: scheduled } = await admin
    .from("schedule")
    .select("date, texts(*)")
    .eq("date", date)
    .maybeSingle();
  if (!scheduled?.texts) return null;
  const text = scheduled.texts as unknown as TextRecord;

  const [questions, dossier, session, highlights, streakRow] = await Promise.all([
    loadQuestions(text.id),
    admin.from("dossiers").select("curator_note").eq("text_id", text.id).maybeSingle(),
    admin
      .from("sessions")
      .select("scroll_progress, last_paragraph, completed_at")
      .eq("user_id", userId ?? noRow)
      .eq("date", date)
      .maybeSingle(),
    admin
      .from("highlights")
      .select("id, paragraph, start, end, color")
      .eq("user_id", userId ?? noRow)
      .eq("text_id", text.id),
    admin
      .from("streaks")
      .select("current, best, last_passed_date, freezes_available")
      .eq("user_id", userId ?? noRow)
      .maybeSingle(),
  ]);

  const questionIds = questions.map((question) => question.id);
  const { data: attemptRows } = userId
    ? await admin
        .from("attempts")
        .select("id, question_id, try_no, body, percentile_provisional, percentile_final, flags")
        .eq("user_id", userId)
        .in("question_id", questionIds.length ? questionIds : [noRow])
        .order("try_no", { ascending: true })
    : { data: [] as never[] };

  const byQuestion = new Map<string, QuestionRecord>(questions.map((q) => [q.id, q]));
  const triesUsed = new Map<string, number>();
  for (const row of attemptRows ?? []) {
    triesUsed.set(row.question_id, (triesUsed.get(row.question_id) ?? 0) + 1);
  }

  const attempts: PublicAttempt[] = (attemptRows ?? []).map((row) => {
    const question = byQuestion.get(row.question_id)!;
    const percentile = row.percentile_final ?? row.percentile_provisional ?? 1;
    const outcome = outcomeFor(
      percentile,
      question.pass_percentile,
      triesUsed.get(row.question_id) ?? row.try_no,
      question.max_tries,
    );
    return {
      id: row.id,
      question_id: row.question_id,
      try_no: row.try_no,
      body: row.body,
      percentile,
      passed: outcome.passed,
      tries_left: outcome.triesLeft,
      settled: outcome.settled,
    };
  });

  return {
    date,
    text,
    questions: questions.map(toPublicQuestion),
    dossier: { curator_note: dossier?.data?.curator_note ?? "" },
    session: {
      scrollProgress: session?.data?.scroll_progress ?? 0,
      lastParagraph: session?.data?.last_paragraph ?? 0,
      completedAt: session?.data?.completed_at ?? null,
    },
    attempts,
    highlights: (highlights?.data ?? []) as HighlightRecord[],
    streak: streakRow?.data
      ? {
          current: streakRow.data.current,
          best: streakRow.data.best,
          lastPassedDate: streakRow.data.last_passed_date,
          freezesAvailable: streakRow.data.freezes_available,
        }
      : emptyStreak(),
  };
}
