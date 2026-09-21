import type { Axis, QuestionKind } from "./domain/rubric";

export type Paragraphs = string[];

export type TextRecord = {
  id: string;
  issue_no: number;
  title: string;
  author: string;
  year: number | null;
  publication: string | null;
  body: Paragraphs;
  word_count: number;
  difficulty: number;
  license: string;
  source_url: string | null;
};

export type QuestionRecord = {
  id: string;
  text_id: string;
  kind: QuestionKind;
  order: number;
  prompt: string;
  trigger_paragraph: number;
  min_seconds: number;
  pass_percentile: number;
  max_tries: number;
};

/** What the client is allowed to know about a question. */
export type PublicQuestion = Omit<QuestionRecord, "pass_percentile">;

export type AnchorAnswer = {
  level: "weak" | "fair" | "solid" | "strong" | "exceptional";
  body: string;
};

export type DossierRecord = {
  text_id: string;
  curator_note: string;
  angles: string[];
  key_passages: string[];
  anchor_answers: AnchorAnswer[];
};

export type AttemptRecord = {
  id: string;
  user_id: string;
  question_id: string;
  try_no: number;
  body: string;
  fingerprint: string;
  rubric: Record<Axis, number> | null;
  score: number | null;
  percentile_provisional: number | null;
  percentile_final: number | null;
  flags: string[];
  created_at: string;
};

/** The only attempt shape that crosses to the client. No score, no threshold. */
export type PublicAttempt = {
  id: string;
  question_id: string;
  try_no: number;
  body: string;
  percentile: number;
  passed: boolean;
  tries_left: number;
  settled: boolean;
};

export type StreakRecord = {
  user_id: string;
  current: number;
  best: number;
  last_passed_date: string | null;
  freezes_available: number;
};

export type HighlightRecord = {
  id: string;
  paragraph: number;
  start: number;
  end: number;
  color: "yellow" | "blue";
};
