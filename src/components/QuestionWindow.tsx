"use client";

import { useEffect, useRef, useState } from "react";

import { AttemptDots } from "./AttemptDots";
import { PercentileLine } from "./PercentileLine";
import { COUNTDOWN_FROM, MAX_SINGLE_INSERT_CHARS, MAX_WORDS } from "@/lib/domain/intake";
import { countWords } from "@/lib/domain/text";
import type { PublicAttempt, PublicQuestion } from "@/lib/types";

export type SubmitResult =
  | { ok: true; attempt: PublicAttempt }
  | { ok: false; message: string };

type Props = {
  question: PublicQuestion;
  attempts: PublicAttempt[];
  signedIn: boolean;
  onSubmit: (body: string, largestInsertChars: number) => Promise<SubmitResult>;
  onAdvance: () => void;
  onSignIn: (email: string) => Promise<string>;
};

const DIM_AFTER_MS = 3000;

export function QuestionWindow({
  question,
  attempts,
  signedIn,
  onSubmit,
  onAdvance,
  onSignIn,
}: Props) {
  const latest = attempts.at(-1) ?? null;
  const [open, setOpen] = useState(true);
  const [typing, setTyping] = useState(false);
  const [editing, setEditing] = useState(attempts.length === 0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const largestInsert = useRef(0);
  const previousLength = useRef(0);
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const touchStart = useRef<number | null>(null);

  // A new question always starts fresh.
  useEffect(() => {
    setBody("");
    setEditing(attempts.length === 0);
    setMessage(null);
    largestInsert.current = 0;
    previousLength.current = 0;
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  useEffect(() => {
    if (editing) textarea.current?.focus();
  }, [editing]);

  useEffect(() => () => {
    if (dimTimer.current) clearTimeout(dimTimer.current);
  }, []);

  const wordCount = countWords(body);
  const showCount = wordCount >= COUNTDOWN_FROM;
  const canSubmit = body.trim().length > 0 && !busy;
  const triesUsed = attempts.length;
  const settled = latest?.settled ?? false;
  const passed = latest?.passed ?? false;

  const markTyping = () => {
    setTyping(true);
    if (dimTimer.current) clearTimeout(dimTimer.current);
    dimTimer.current = setTimeout(() => setTyping(false), DIM_AFTER_MS);
  };

  const handleChange = (value: string) => {
    const delta = value.length - previousLength.current;
    if (delta > largestInsert.current) largestInsert.current = delta;
    previousLength.current = value.length;
    setBody(value);
    markTyping();
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMessage(null);
    const result = await onSubmit(body.trim(), largestInsert.current);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setEditing(false);
    setTyping(false);
  };

  if (!open) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-20 rise-fade pt-10">
        <div className="page-pad measure pb-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="tap mx-auto flex w-full items-center justify-center"
            aria-label="Show the question"
          >
            <Chevron direction="up" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 rise-fade animate-rise pt-16"
      onTouchStart={(event) => (touchStart.current = event.touches[0].clientY)}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        if (start !== null && event.changedTouches[0].clientY - start > 60) setOpen(false);
        touchStart.current = null;
      }}
    >
      <div
        className="page-pad measure pb-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="tap mb-1 flex w-full items-center justify-center"
          aria-label="Close the question and reread"
        >
          <Chevron direction="down" />
        </button>

        <p
          className="prose-body transition-opacity duration-500"
          style={{ opacity: typing ? 0.55 : 1 }}
        >
          {question.prompt}
        </p>

        {editing ? (
          <>
            <textarea
              ref={textarea}
              value={body}
              onChange={(event) => handleChange(event.target.value)}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text");
                if (pasted.length > MAX_SINGLE_INSERT_CHARS) {
                  event.preventDefault();
                  setMessage("Type your answer rather than pasting it.");
                }
              }}
              rows={5}
              spellCheck={false}
              className="prose-body mt-4 w-full resize-none bg-transparent outline-none"
              style={{ color: "var(--ink)" }}
              aria-label="Your answer"
            />
            <div className="mt-2 flex items-center justify-between">
              <AttemptDots used={triesUsed} total={question.max_tries} />
              <div className="flex items-center gap-4">
                {showCount ? (
                  <span className="secondary text-[15px]">{MAX_WORDS - wordCount}</span>
                ) : null}
                {canSubmit ? (
                  <button type="button" onClick={submit} className="tap text-[17px]">
                    {busy ? "Reading" : "Submit"}
                  </button>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="prose-body mt-4 block w-full text-left"
              onClick={() => {
                if (settled) return;
                setBody(latest?.body ?? "");
                previousLength.current = (latest?.body ?? "").length;
                setEditing(true);
              }}
            >
              {latest?.body}
            </button>

            {latest ? <PercentileLine percentile={latest.percentile} /> : null}

            <div className="mt-6 flex items-center justify-between">
              <AttemptDots used={triesUsed} total={question.max_tries} />
              {passed || settled ? (
                <button type="button" onClick={onAdvance} className="tap text-[17px]">
                  {passed ? "Next" : "Move on"}
                </button>
              ) : (
                <span className="secondary text-[15px]">Tap your answer to revise</span>
              )}
            </div>
          </>
        )}

        {!signedIn ? (
          <form
            className="mt-5 flex items-center gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setMessage(await onSignIn(email));
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email, to keep your streak"
              className="prose-body flex-1 bg-transparent outline-none"
              style={{ color: "var(--ink)" }}
            />
            <button type="submit" className="tap text-[17px]">
              Send
            </button>
          </form>
        ) : null}

        {message ? <p className="secondary mt-3 text-[15px]">{message}</p> : null}
      </div>
    </div>
  );
}

function Chevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      width="22"
      height="12"
      viewBox="0 0 22 12"
      fill="none"
      aria-hidden="true"
      style={{ transform: direction === "up" ? "rotate(180deg)" : undefined }}
    >
      <path d="M1 1l10 9 10-9" stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
