import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { textId, paragraph, start, end, color } = (await request.json()) as {
    textId?: string;
    paragraph?: number;
    start?: number;
    end?: number;
    color?: string;
  };

  if (!textId || typeof paragraph !== "number" || typeof start !== "number" || typeof end !== "number") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("highlights")
    .insert({
      user_id: user.id,
      text_id: textId,
      paragraph,
      start,
      end,
      color: color === "blue" ? "blue" : "yellow",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("highlights").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
