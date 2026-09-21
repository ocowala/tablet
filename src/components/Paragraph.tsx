"use client";

import { forwardRef } from "react";

import type { HighlightRecord } from "@/lib/types";

type Props = {
  index: number;
  body: string;
  highlights: HighlightRecord[];
  onRemoveHighlight: (id: string) => void;
};

type Segment = { text: string; highlight?: HighlightRecord };

/** Splits a paragraph into plain and highlighted runs. */
export function segmentsFor(body: string, highlights: HighlightRecord[]): Segment[] {
  const ordered = [...highlights]
    .filter((h) => h.end > h.start && h.start < body.length)
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const highlight of ordered) {
    const start = Math.max(cursor, highlight.start);
    const end = Math.min(body.length, highlight.end);
    if (end <= start) continue;
    if (start > cursor) segments.push({ text: body.slice(cursor, start) });
    segments.push({ text: body.slice(start, end), highlight });
    cursor = end;
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor) });
  return segments;
}

export const Paragraph = forwardRef<HTMLParagraphElement, Props>(function Paragraph(
  { index, body, highlights, onRemoveHighlight },
  ref,
) {
  const segments = segmentsFor(body, highlights);
  return (
    <p ref={ref} data-paragraph={index}>
      {segments.map((segment, i) =>
        segment.highlight ? (
          <mark
            key={i}
            className="hl"
            data-color={segment.highlight.color}
            onClick={() => onRemoveHighlight(segment.highlight!.id)}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </p>
  );
});
