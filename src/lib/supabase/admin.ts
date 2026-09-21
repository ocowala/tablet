import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service role client. It bypasses row level security, so it stays on the
 * server and is only used by the grading pipeline, the rollover job and admin.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
