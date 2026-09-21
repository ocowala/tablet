import { NextResponse } from "next/server";

import { issueDateFor } from "@/lib/domain/day";
import { currentUser } from "@/lib/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoSetPosition, isDemo } from "@/lib/server/demo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { lastParagraph, scrollProgress } = (await request.json()) as {
    lastParagraph?: number;
    scrollProgress?: number;
  };

  if (isDemo()) {
    demoSetPosition(Math.max(0, Math.floor(lastParagraph ?? 0)));
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  const date = issueDateFor(new Date(), user.homeTimezone);
  const { data: scheduled } = await admin
    .from("schedule")
    .select("text_id")
    .eq("date", date)
    .maybeSingle();
  if (!scheduled) return NextResponse.json({ ok: false }, { status: 404 });

  await admin.from("sessions").upsert({
    user_id: user.id,
    date,
    text_id: scheduled.text_id,
    last_paragraph: Math.max(0, Math.floor(lastParagraph ?? 0)),
    scroll_progress: Math.min(1, Math.max(0, scrollProgress ?? 0)),
  });

  return NextResponse.json({ ok: true });
}
