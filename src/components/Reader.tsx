"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AaPopover } from "./AaPopover";
import { Header } from "./Header";
import { Paragraph } from "./Paragraph";
import { QuestionWindow, type SubmitResult } from "./QuestionWindow";
import { Reveal } from "./Reveal";
import { getHighlightColor, type HighlightColor } from "@/lib/client/prefs";
import { readSelection } from "@/lib/client/offsets";
import type { PublicAttempt, PublicQuestion, TextRecord } from "@/lib/types";
import type { HighlightRecord } from "@/lib/types";

type Props = {
  date: string;
  text: TextRecord;
  questions: PublicQuestion[];
  curatorNote: string;
  attempts: PublicAttempt[];
  highlights: HighlightRecord[];
  streak: number;
  signedIn: boolean;
  lastParagraph: number;
};

const SCROLL_PAUSE_MS = 900;

export function Reader(props: Props) {
  const [attempts, setAttempts] = useState<PublicAttempt[]>(props.attempts);
  const [highlights, setHighlights] = useState<HighlightRecord[]>(props.highlights);
  const [color, setColor] = useState<HighlightColor>("yellow");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [lastParagraph, setLastParagraph] = useState(props.lastParagraph);

  const container = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const startedAt = useRef(Date.now());
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paused = useRef(false);

  useEffect(() => setColor(getHighlightColor()), []);

  const attemptsFor = useCallback(
    (questionId: string) => attempts.filter((attempt) => attempt.question_id === questionId),
    [attempts],
  );

  /** The next question the reader has not finished with. */
  const pending = useMemo(() => {
    for (const question of props.questions) {
      const latest = attemptsFor(question.id).at(-1);
      if (!latest || !latest.settled) return question;
    }
    return null;
  }, [props.questions, attemptsFor]);

  /**
   * The question on screen. It is held open after a submit so the reader sees
   * their percentile, and only released when they choose to move on. Letting
   * it follow `pending` would swap the window out the instant an answer
   * settled, which is exactly when the reader has something to read.
   */
  const current = useMemo(
    () => props.questions.find((question) => question.id === activeId) ?? null,
    [props.questions, activeId],
  );

  const whyToday = props.questions.find((question) => question.kind === "why_today");
  const whyTodayDone = whyToday
    ? (attemptsFor(whyToday.id).at(-1)?.settled ?? false)
    : false;

  // Resume at the reader's last position.
  useEffect(() => {
    if (props.lastParagraph <= 0) return;
    const target = paragraphRefs.current[props.lastParagraph];
    if (target) target.scrollIntoView({ block: "start", behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track position, and notice when scrolling stops.
  useEffect(() => {
    const onScroll = () => {
      paused.current = false;
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      pauseTimer.current = setTimeout(() => {
        paused.current = true;
      }, SCROLL_PAUSE_MS);

      let top = 0;
      paragraphRefs.current.forEach((node, index) => {
        if (node && node.getBoundingClientRect().top <= 120) top = index;
      });
      setLastParagraph(top);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    pauseTimer.current = setTimeout(() => {
      paused.current = true;
    }, SCROLL_PAUSE_MS);
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
    };
  }, []);

  // Persist the reading position, quietly.
  useEffect(() => {
    if (!props.signedIn) return;
    const timer = setTimeout(() => {
      const total = Math.max(1, props.text.body.length - 1);
      void fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lastParagraph,
          scrollProgress: Math.min(1, lastParagraph / total),
        }),
      }).catch(() => undefined);
    }, 1200);
    return () => clearTimeout(timer);
  }, [lastParagraph, props.signedIn, props.text.body.length]);

  /**
   * A question surfaces only once the reader is past its trigger paragraph,
   * `min_seconds` have elapsed, and scrolling has stopped. Waiting for the
   * whole trigger paragraph to clear the viewport is what keeps the window
   * from ever rising mid sentence.
   */
  useEffect(() => {
    if (activeId || revealOpen || !pending) return;

    // Polled rather than driven by state, because the last of the three
    // conditions to come true is usually the clock, and a reader who has
    // stopped scrolling to think produces no events at all.
    const check = () => {
      if (!paused.current) return;
      if ((Date.now() - startedAt.current) / 1000 < pending.min_seconds) return;

      const trigger = paragraphRefs.current[pending.trigger_paragraph];
      if (trigger && trigger.getBoundingClientRect().bottom > window.innerHeight * 0.9) return;

      setActiveId(pending.id);
    };

    const timer = setInterval(check, 400);
    check();
    return () => clearInterval(timer);
  }, [pending, activeId, revealOpen]);

  /** Moving on closes the window and restarts the clock for the next one. */
  const advance = useCallback(() => {
    startedAt.current = Date.now();
    setActiveId(null);
  }, []);

  // The reveal waits for the reader to leave the why today window, so the
  // percentile on their last answer is not cut off by it.
  useEffect(() => {
    if (whyTodayDone && !activeId) setRevealOpen(true);
  }, [whyTodayDone, activeId]);

  const addHighlight = useCallback(async () => {
    const root = container.current;
    if (!root) return;
    const range = readSelection(root);
    if (!range) return;
    window.getSelection()?.removeAllRanges();

    const optimistic: HighlightRecord = {
      id: `local-${Date.now()}`,
      paragraph: range.paragraph,
      start: range.start,
      end: range.end,
      color,
    };
    setHighlights((all) => [...all, optimistic]);
    if (!props.signedIn) return;

    try {
      const response = await fetch("/api/highlights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...range, color, textId: props.text.id }),
      });
      const saved = (await response.json()) as { id?: string };
      if (saved.id) {
        setHighlights((all) =>
          all.map((h) => (h.id === optimistic.id ? { ...h, id: saved.id! } : h)),
        );
      }
    } catch {
      // The highlight stays on screen for this session.
    }
  }, [color, props.signedIn, props.text.id]);

  const removeHighlight = useCallback(
    (id: string) => {
      setHighlights((all) => all.filter((h) => h.id !== id));
      if (!props.signedIn || id.startsWith("local-")) return;
      void fetch(`/api/highlights?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
        () => undefined,
      );
    },
    [props.signedIn],
  );

  const submit = useCallback(
    async (body: string, largestInsertChars: number): Promise<SubmitResult> => {
      if (!current) return { ok: false, message: "Nothing to answer." };
      try {
        const response = await fetch("/api/attempts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ questionId: current.id, body, largestInsertChars }),
        });
        const payload = (await response.json()) as
          | { ok: true; attempt: PublicAttempt }
          | { ok: false; message: string };
        if (!payload.ok) return payload;
        setAttempts((all) => [
          ...all.filter((a) => a.id !== payload.attempt.id),
          payload.attempt,
        ]);
        return payload;
      } catch {
        return { ok: false, message: "Something went wrong. Try again." };
      }
    },
    [current],
  );

  const signIn = useCallback(async (email: string) => {
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return response.ok ? "Check your email." : "That did not send. Try again.";
    } catch {
      return "That did not send. Try again.";
    }
  }, []);

  return (
    <>
      <Header streak={props.streak} onOpenAppearance={() => setAppearanceOpen(true)} />
      <AaPopover
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        onColorChange={setColor}
      />

      <main
        ref={container}
        className="page-pad measure prose-body"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 56px)",
          paddingBottom: "60vh",
        }}
        onMouseUp={addHighlight}
        onTouchEnd={addHighlight}
      >
        {props.text.body.map((paragraph, index) => (
          <Paragraph
            key={index}
            index={index}
            body={paragraph}
            highlights={highlights.filter((h) => h.paragraph === index)}
            onRemoveHighlight={removeHighlight}
            ref={(node) => {
              paragraphRefs.current[index] = node;
            }}
          />
        ))}
      </main>

      {revealOpen ? (
        <Reveal
          text={props.text}
          curatorNote={props.curatorNote}
          percentile={
            whyToday ? (attemptsFor(whyToday.id).at(-1)?.percentile ?? null) : null
          }
          questionId={whyToday?.id ?? null}
        />
      ) : current ? (
        <QuestionWindow
          key={current.id}
          question={current}
          attempts={attemptsFor(current.id)}
          signedIn={props.signedIn}
          onSubmit={submit}
          onAdvance={advance}
          onSignIn={signIn}
        />
      ) : null}
    </>
  );
}
