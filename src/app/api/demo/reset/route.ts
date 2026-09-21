import { NextResponse } from "next/server";

import { isDemo, resetDemo } from "@/lib/server/demo";

export const runtime = "nodejs";

/** Clears the in-memory demo store. Only exists in demo mode. */
export async function POST() {
  if (!isDemo()) return NextResponse.json({ ok: false }, { status: 404 });
  resetDemo();
  return NextResponse.json({ ok: true });
}
