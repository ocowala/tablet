import { NextResponse } from "next/server";

import { countWords } from "@/lib/domain/text";
import { currentUser } from "@/lib/server/auth";
import {
  IssueSchema,
  defaultMaxTries,
  isAdmin,
  validateIssueShape,
} from "@/lib/server/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Loads a text with its dossier, questions and anchor answers in one go. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!isAdmin(user)) return NextResponse.json({ ok: false }, { status: 403 });

  const parsed = IssueSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, problems: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) },
      { status: 400 },
    );
  }

  const problems = validateIssueShape(parsed.data);
  if (problems.length > 0) return NextResponse.json({ ok: false, problems }, { status: 400 });

  const payload = parsed.data;
  const admin = createAdminClient();

  const { data: text, error: textError } = await admin
    .from("texts")
    .upsert(
      {
        issue_no: payload.text.issue_no,
        title: payload.text.title,
        author: payload.text.author,
        year: payload.text.year ?? null,
        publication: payload.text.publication ?? null,
        body: payload.text.body,
        word_count: payload.text.body.reduce((total, p) => total + countWords(p), 0),
        difficulty: payload.text.difficulty,
        license: payload.text.license,
        source_url: payload.text.source_url ?? null,
      },
      { onConflict: "issue_no" },
    )
    .select("id")
    .single();
  if (textError) {
    return NextResponse.json({ ok: false, problems: [textError.message] }, { status: 500 });
  }

  await admin.from("dossiers").upsert({
    text_id: text.id,
    curator_note: payload.dossier.curator_note,
    angles: payload.dossier.angles,
    key_passages: payload.dossier.key_passages,
    anchor_answers: payload.dossier.anchor_answers,
  });

  await admin.from("questions").delete().eq("text_id", text.id);
  await admin.from("questions").insert(
    payload.questions.map((question) => ({
      text_id: text.id,
      kind: question.kind,
      order: question.order,
      prompt: question.prompt,
      trigger_paragraph: question.trigger_paragraph,
      min_seconds: question.min_seconds,
      pass_percentile: question.pass_percentile,
      max_tries: defaultMaxTries(question.kind, question.max_tries),
    })),
  );

  await admin.from("ai_answer_pool").delete().eq("text_id", text.id);
  if (payload.ai_answer_pool.length > 0) {
    await admin.from("ai_answer_pool").insert(
      payload.ai_answer_pool.map((entry) => ({
        text_id: text.id,
        kind: entry.kind,
        body: entry.body,
      })),
    );
  }

  if (payload.schedule_date) {
    await admin.from("schedule").upsert({ date: payload.schedule_date, text_id: text.id });
  }

  return NextResponse.json({ ok: true, textId: text.id });
}
