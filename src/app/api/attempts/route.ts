import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { submitAnswer } from "@/lib/server/grade";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sign in to answer." }, { status: 401 });
  }

  let payload: { questionId?: unknown; body?: unknown; largestInsertChars?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  if (typeof payload.questionId !== "string" || typeof payload.body !== "string") {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const insert =
    typeof payload.largestInsertChars === "number" ? payload.largestInsertChars : 0;

  const result = await submitAnswer(user, payload.questionId, payload.body, insert);
  // Failures are reader-facing messages only. Scores and thresholds never leave
  // the server.
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
