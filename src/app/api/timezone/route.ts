import { NextResponse } from "next/server";

import { canChangeTimezone, isValidTimeZone } from "@/lib/domain/day";
import { currentUser } from "@/lib/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Home time zone, changeable once every thirty days. Server time decides. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { timezone } = (await request.json()) as { timezone?: string };
  if (!timezone || !isValidTimeZone(timezone)) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  if (timezone === user.homeTimezone) return NextResponse.json({ ok: true, changed: false });

  if (!canChangeTimezone(user.timezoneChangedAt, new Date())) {
    return NextResponse.json({ ok: false, reason: "cooldown" }, { status: 409 });
  }

  const admin = createAdminClient();
  await admin
    .from("users")
    .update({ home_timezone: timezone, timezone_changed_at: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, changed: true });
}
