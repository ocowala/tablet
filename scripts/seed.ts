/**
 * Seeds three sample issues, their dossiers, questions and anchor answers,
 * plus a starting calibration curve. Run with `npm run seed`.
 *
 * The sample texts are short public domain excerpts, abridged for development.
 */
import { createClient } from "@supabase/supabase-js";

import { buildCalibrationCurve } from "../src/lib/domain/percentile";
import { SEEDS } from "../src/lib/sample-issues";
import { countWords } from "../src/lib/domain/text";

function isoDate(offsetDays: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const [index, seed] of SEEDS.entries()) {
    const { data: text, error } = await supabase
      .from("texts")
      .upsert(
        {
          ...seed.text,
          word_count: seed.text.body.reduce((total, p) => total + countWords(p), 0),
        },
        { onConflict: "issue_no" },
      )
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("dossiers").upsert({
      text_id: text.id,
      curator_note: seed.curator_note,
      angles: seed.angles,
      key_passages: seed.key_passages,
      anchor_answers: seed.anchors,
    });

    await supabase.from("questions").delete().eq("text_id", text.id);
    await supabase.from("questions").insert(
      seed.questions.map((question) => ({ ...question, text_id: text.id })),
    );

    // Today, then the next two days.
    await supabase.from("schedule").upsert({ date: isoDate(index), text_id: text.id });
    console.log(`seeded issue ${seed.text.issue_no} for ${isoDate(index)}`);
  }

  // A starting curve so the very first reader still gets a sane percentile.
  const sample = Array.from({ length: 200 }, (_, i) => 20 + (i / 199) * 70);
  for (const difficulty of [1, 2, 3, 4, 5, 6]) {
    const curve = buildCalibrationCurve(difficulty, sample);
    await supabase
      .from("calibration_curves")
      .upsert({ difficulty, points: curve.points, updated_at: new Date().toISOString() });
  }
  console.log("seeded calibration curves");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
