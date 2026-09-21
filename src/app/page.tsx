import { cookies } from "next/headers";

import { Reader } from "@/components/Reader";
import { TimezoneSync } from "@/components/TimezoneSync";
import { currentUser, resolveTimezone } from "@/lib/server/auth";
import { loadToday } from "@/lib/server/reading";

export const dynamic = "force-dynamic";

/** The app opens straight onto the text. There is nothing in front of it. */
export default async function Page() {
  const user = await currentUser();
  const cookieStore = await cookies();
  const timezone = resolveTimezone(
    user?.homeTimezone ?? cookieStore.get("tablet.tz")?.value,
    "UTC",
  );

  const today = await loadToday({ id: user?.id ?? null, homeTimezone: timezone });

  if (!today) {
    return (
      <main className="page-pad measure prose-body" style={{ paddingTop: "40vh" }}>
        <p className="secondary">No text today.</p>
        <TimezoneSync signedIn={Boolean(user)} />
      </main>
    );
  }

  return (
    <>
      <Reader
        date={today.date}
        text={today.text}
        questions={today.questions}
        curatorNote={today.dossier.curator_note}
        attempts={today.attempts}
        highlights={today.highlights}
        streak={today.streak.current}
        signedIn={Boolean(user)}
        lastParagraph={today.session.lastParagraph}
      />
      <TimezoneSync signedIn={Boolean(user)} />
    </>
  );
}
