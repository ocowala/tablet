import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPenalised } from "@/lib/domain/integrity";
import { demoTopResponses, isDemo } from "@/lib/server/demo";

export const runtime = "nodejs";

/**
 * The reveal's top responses. Served by the server so readers never gain read
 * access to each other's rows, and stripped of everything but the words.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ responses: [] });

  const questionId = new URL(request.url).searchParams.get("questionId");
  if (!questionId) return NextResponse.json({ responses: [] }, { status: 400 });

  if (isDemo()) return NextResponse.json({ responses: demoTopResponses(questionId) });

  // Only readers who have finished this question may read the others.
  const admin = createAdminClient();
  const { data: own } = await admin
    .from("attempts")
    .select("id")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .limit(1);
  if (!own || own.length === 0) return NextResponse.json({ responses: [] }, { status: 403 });

  const { data: rows } = await admin
    .from("attempts")
    .select("body, score, flags, percentile_provisional, percentile_final, users!inner(handle)")
    .eq("question_id", questionId)
    .order("score", { ascending: false })
    .limit(40);

  const responses = (rows ?? [])
    .filter((row) => !isPenalised((row.flags ?? []) as string[]))
    .slice(0, 5)
    .map((row) => ({
      handle: (row.users as unknown as { handle: string }).handle,
      body: row.body as string,
      percentile: (row.percentile_final ?? row.percentile_provisional ?? 99) as number,
    }));

  return NextResponse.json({ responses });
}
