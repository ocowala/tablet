import { NextResponse } from "next/server";

import { addDays } from "@/lib/domain/day";
import { runRollover } from "@/lib/server/rollover";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorised(request: Request): boolean {
  const secret = process.env.ROLLOVER_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Day close. Runs hourly so every time zone's 24 hour window is caught, and is
 * idempotent per date.
 */
export async function POST(request: Request) {
  if (!authorised(request)) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? addDays(new Date().toISOString().slice(0, 10), -1);
  const force = url.searchParams.get("force") === "true";

  const report = await runRollover(date, force);
  return NextResponse.json({ ok: true, ...report });
}

export async function GET(request: Request) {
  return POST(request);
}
