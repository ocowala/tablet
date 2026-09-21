"use client";

import { useEffect } from "react";

/**
 * The drop is 5am in the reader's home time zone, so the server needs to know
 * it. Signed in readers may change it once every thirty days, which the server
 * enforces.
 */
export function TimezoneSync({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;

    document.cookie = `tablet.tz=${encodeURIComponent(timezone)}; path=/; max-age=31536000; samesite=lax`;
    if (!signedIn) return;

    void fetch("/api/timezone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone }),
    }).catch(() => undefined);
  }, [signedIn]);

  return null;
}
