import "server-only";

import { z } from "zod/v4";

import { countWords } from "@/lib/domain/text";
import { DEFAULT_MAX_TRIES, DEFAULT_PASS_PERCENTILE } from "@/lib/domain/threshold";
import type { CurrentUser } from "./auth";

export function isAdmin(user: CurrentUser | null): boolean {
  if (!user) return false;
  const allowed = (process.env.ADMIN_HANDLES ?? "")
    .split(",")
    .map((handle) => handle.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(user.handle.toLowerCase());
}

const anchorLevels = ["weak", "fair", "solid", "strong", "exceptional"] as const;

export const IssueSchema = z.object({
  text: z.object({
    issue_no: z.number().int().positive(),
    title: z.string().min(1),
    author: z.string().min(1),
    year: z.number().int().nullable().optional(),
    publication: z.string().nullable().optional(),
    body: z.array(z.string().min(1)).min(1),
    difficulty: z.number().int().min(1).max(6),
    license: z.string().min(1),
    source_url: z.string().url().nullable().optional(),
  }),
  schedule_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  dossier: z.object({
    curator_note: z
      .string()
      .refine((note) => {
        const count = countWords(note);
        return count >= 60 && count <= 150;
      }, "Curator note must be 60 to 150 words"),
    angles: z.array(z.string().min(1)).min(3).max(5),
    key_passages: z.array(z.string().min(1)).default([]),
    anchor_answers: z
      .array(z.object({ level: z.enum(anchorLevels), body: z.string().min(1) }))
      .length(5),
  }),
  questions: z
    .array(
      z.object({
        kind: z.enum(["probe", "why_today"]),
        order: z.number().int().min(0),
        prompt: z.string().min(1),
        trigger_paragraph: z.number().int().min(0),
        min_seconds: z.number().int().min(0).default(60),
        pass_percentile: z.number().int().min(1).max(99).default(DEFAULT_PASS_PERCENTILE),
        max_tries: z.number().int().min(1).max(5).optional(),
      }),
    )
    .min(1),
  ai_answer_pool: z
    .array(z.object({ kind: z.enum(["probe", "why_today"]), body: z.string().min(1) }))
    .default([]),
});

export type IssuePayload = z.infer<typeof IssueSchema>;

/** MVP shape: two probing questions, then why today. */
export function validateIssueShape(payload: IssuePayload): string[] {
  const problems: string[] = [];
  const probes = payload.questions.filter((question) => question.kind === "probe");
  const whyToday = payload.questions.filter((question) => question.kind === "why_today");
  if (probes.length !== 2) problems.push("Needs exactly two probing questions");
  if (whyToday.length !== 1) problems.push("Needs exactly one why today question");
  for (const question of payload.questions) {
    if (question.trigger_paragraph >= payload.text.body.length) {
      problems.push(`Question ${question.kind} ${question.order} triggers past the end of the text`);
    }
  }
  return problems;
}

export function defaultMaxTries(kind: "probe" | "why_today", given?: number): number {
  return given ?? DEFAULT_MAX_TRIES[kind];
}
