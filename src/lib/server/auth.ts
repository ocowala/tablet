import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTimeZone } from "@/lib/domain/day";
import { DEMO_USER, isDemo } from "./demo";

export type CurrentUser = {
  id: string;
  handle: string;
  homeTimezone: string;
  timezoneChangedAt: Date | null;
};

/**
 * The signed in reader, creating their row on first sight. Readers land
 * straight on the text, so there is no onboarding step to collect a handle:
 * one is derived and can be changed later.
 */
export async function currentUser(): Promise<CurrentUser | null> {
  if (isDemo()) return DEMO_USER;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("users")
    .select("id, handle, home_timezone, timezone_changed_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      handle: existing.handle,
      homeTimezone: existing.home_timezone,
      timezoneChangedAt: existing.timezone_changed_at
        ? new Date(existing.timezone_changed_at)
        : null,
    };
  }

  const handle = deriveHandle(auth.user.email ?? auth.user.id);
  const { data: created, error } = await admin
    .from("users")
    .insert({ id: auth.user.id, handle, home_timezone: "UTC" })
    .select("id, handle, home_timezone, timezone_changed_at")
    .single();
  if (error) throw error;

  await admin.from("streaks").insert({ user_id: auth.user.id }).select().maybeSingle();

  return {
    id: created.id,
    handle: created.handle,
    homeTimezone: created.home_timezone,
    timezoneChangedAt: null,
  };
}

function deriveHandle(seed: string): string {
  const base = seed.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 14);
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `${base || "reader"}${suffix}`;
}

export function resolveTimezone(candidate: string | null | undefined, fallback: string): string {
  if (candidate && isValidTimeZone(candidate)) return candidate;
  return fallback;
}
