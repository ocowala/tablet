"use client";

import { useEffect, useState } from "react";

import type { TextRecord } from "@/lib/types";

type TopResponse = { handle: string; body: string; percentile: number };

type Props = {
  text: TextRecord;
  curatorNote: string;
  percentile: number | null;
  questionId: string | null;
};

/** Title, author, year, the curator's note, the reader's percentile. */
export function Reveal({ text, curatorNote, percentile, questionId }: Props) {
  const [showTop, setShowTop] = useState(false);
  const [top, setTop] = useState<TopResponse[] | null>(null);

  useEffect(() => {
    if (!showTop || top || !questionId) return;
    void fetch(`/api/top-responses?questionId=${encodeURIComponent(questionId)}`)
      .then((response) => response.json())
      .then((payload: { responses?: TopResponse[] }) => setTop(payload.responses ?? []))
      .catch(() => setTop([]));
  }, [showTop, top, questionId]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-30 overflow-y-auto"
      style={{ background: "var(--page)" }}
    >
      <div
        className="page-pad measure"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 18vh)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)",
        }}
      >
        <h1 className="prose-body" style={{ fontSize: "1.6em", lineHeight: 1.25 }}>
          {text.title}
        </h1>
        <p className="secondary prose-body mt-2">
          {text.author}
          {text.year ? `, ${text.year}` : ""}
          {text.publication ? `. ${text.publication}` : ""}
        </p>

        <p className="prose-body mt-8">{curatorNote}</p>

        {percentile !== null ? (
          <div className="mt-10 text-center">
            <div className="leading-none" style={{ fontSize: "3.4rem", fontWeight: 300 }}>
              {percentile}%
            </div>
            <div className="secondary text-[15px]">of readers</div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setShowTop((open) => !open)}
          className="tap mx-auto mt-10 flex w-full items-center justify-center"
          aria-label="Top responses"
          aria-expanded={showTop}
        >
          <svg
            width="22"
            height="12"
            viewBox="0 0 22 12"
            fill="none"
            aria-hidden="true"
            style={{ transform: showTop ? "rotate(180deg)" : undefined }}
          >
            <path d="M1 1l10 9 10-9" stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

        {showTop ? (
          <div className="animate-fade-in mt-8">
            {top === null ? (
              <p className="secondary prose-body">Reading</p>
            ) : top.length === 0 ? (
              <p className="secondary prose-body">No responses yet today.</p>
            ) : (
              top.map((response, index) => (
                <div key={index} className="mt-8 first:mt-0">
                  <p className="prose-body">{response.body}</p>
                  <p className="secondary mt-2 text-[15px]">{response.handle}</p>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
