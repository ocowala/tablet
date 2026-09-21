import "server-only";

import { issueDateFor } from "@/lib/domain/day";
import { fingerprint } from "@/lib/domain/fingerprint";
import { INTAKE_MESSAGES, validateAnswer } from "@/lib/domain/intake";
import { runIntegrityChecks } from "@/lib/domain/integrity";
import { provisionalPercentile } from "@/lib/domain/percentile";
import { toPublicQuestion } from "@/lib/domain/publish";
import { checkQuotes, hasFabricatedQuote } from "@/lib/domain/quotes";
import { applyPenalties, weightedScore, type RubricScores } from "@/lib/domain/rubric";
import { emptyStreak, type StreakState } from "@/lib/domain/streak";
import { outcomeFor } from "@/lib/domain/threshold";
import { countWords, words } from "@/lib/domain/text";
import { SEEDS } from "@/lib/sample-issues";
import type {
  HighlightRecord,
  PublicAttempt,
  QuestionRecord,
  TextRecord,
} from "@/lib/types";
import type { CurrentUser } from "./auth";
import type { TodayView } from "./reading";

/**
 * Demo mode. Runs the whole reading flow from the sample issues, in memory,
 * with no Supabase and no Anthropic key, so the app can be looked at locally.
 *
 * It is a mockup, not a shortcut: the pipeline order, the hidden thresholds
 * and the public shapes are the real ones. Only the store and the grader are
 * stand-ins, and both live in this file so they are easy to delete.
 */

export function isDemo(): boolean {
  if (process.env.TABLET_DEMO === "1") return true;
  if (process.env.TABLET_DEMO === "0") return false;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export const DEMO_USER: CurrentUser = {
  id: "demo-reader",
  handle: "reader",
  homeTimezone: "UTC",
  timezoneChangedAt: null,
};

const ISSUE = SEEDS[0];

export const DEMO_TEXT: TextRecord = {
  id: "demo-text-1",
  issue_no: ISSUE.text.issue_no,
  title: ISSUE.text.title,
  author: ISSUE.text.author,
  year: ISSUE.text.year,
  publication: ISSUE.text.publication,
  body: ISSUE.text.body,
  word_count: ISSUE.text.body.reduce((total, p) => total + countWords(p), 0),
  difficulty: ISSUE.text.difficulty,
  license: ISSUE.text.license,
  source_url: ISSUE.text.source_url,
};

export const DEMO_QUESTIONS: QuestionRecord[] = ISSUE.questions.map((question, index) => ({
  id: `demo-q-${index}`,
  text_id: DEMO_TEXT.id,
  kind: question.kind,
  order: question.order,
  prompt: question.prompt,
  trigger_paragraph: question.trigger_paragraph,
  // Shortened so the flow can actually be seen without a ninety second wait.
  min_seconds: Number(process.env.TABLET_DEMO_MIN_SECONDS ?? 4),
  pass_percentile: question.pass_percentile,
  max_tries: question.max_tries,
}));

type DemoAttempt = {
  id: string;
  questionId: string;
  tryNo: number;
  body: string;
  fingerprint: string;
  percentile: number;
  flags: string[];
};

type DemoState = {
  attempts: DemoAttempt[];
  highlights: HighlightRecord[];
  lastParagraph: number;
  streak: StreakState;
};

/** Survives hot reloads in development, which module scope alone does not. */
const store = ((globalThis as { __tabletDemo?: DemoState }).__tabletDemo ??= {
  attempts: [],
  highlights: [],
  lastParagraph: 0,
  streak: { ...emptyStreak(), current: 4, best: 9, lastPassedDate: null, freezesAvailable: 1 },
});

export function resetDemo() {
  store.attempts = [];
  store.highlights = [];
  store.lastParagraph = 0;
}

/**
 * A stand-in for the three grader passes. Deterministic and offline: it reads
 * the same signals the real rubric asks about, so the demo shows a spread of
 * percentiles rather than one canned number.
 */
function demoRubric(body: string, paragraphs: readonly string[]): RubricScores {
  const answer = words(body);
  const textVocabulary = new Set(words(paragraphs.join(" ")));
  const distinct = new Set(answer);

  const shared = [...distinct].filter((word) => word.length > 4 && textVocabulary.has(word)).length;
  const quoted = checkQuotes(body, paragraphs).filter((check) => check.found).length;
  const sentences = body.split(/[.?!]+\s/).filter((part) => part.trim().length > 0).length;
  const ownVocabulary = [...distinct].filter(
    (word) => word.length > 5 && !textVocabulary.has(word),
  ).length;
  const present = /\b(today|now|current|modern|this (?:week|year|moment)|lately|still)\b/i.test(body);

  const scale = (value: number, full: number) => Math.min(5, (value / full) * 5);

  return {
    textual_evidence: Math.min(5, scale(shared, 9) + quoted * 1.5),
    grasp: Math.min(5, scale(sentences, 4) + scale(shared, 14)),
    connection: Math.min(5, (present ? 2.5 : 0.5) + scale(ownVocabulary, 10)),
    originality: scale(ownVocabulary, 8),
  };
}

const DEMO_CURVE = {
  difficulty: DEMO_TEXT.difficulty,
  points: [
    { score: 0, percentile: 1 },
    { score: 30, percentile: 15 },
    { score: 45, percentile: 35 },
    { score: 60, percentile: 60 },
    { score: 75, percentile: 82 },
    { score: 90, percentile: 96 },
    { score: 100, percentile: 99 },
  ],
};

function publicAttempt(attempt: DemoAttempt): PublicAttempt {
  const question = DEMO_QUESTIONS.find((q) => q.id === attempt.questionId)!;
  const used = store.attempts.filter((a) => a.questionId === attempt.questionId).length;
  const outcome = outcomeFor(attempt.percentile, question.pass_percentile, used, question.max_tries);
  return {
    id: attempt.id,
    question_id: attempt.questionId,
    try_no: attempt.tryNo,
    body: attempt.body,
    percentile: attempt.percentile,
    passed: outcome.passed,
    tries_left: outcome.triesLeft,
    settled: outcome.settled,
  };
}

export function demoToday(now = new Date()): TodayView {
  return {
    date: issueDateFor(now, DEMO_USER.homeTimezone),
    text: DEMO_TEXT,
    questions: DEMO_QUESTIONS.map(toPublicQuestion),
    dossier: { curator_note: ISSUE.curator_note },
    session: { scrollProgress: 0, lastParagraph: store.lastParagraph, completedAt: null },
    attempts: store.attempts.map(publicAttempt),
    highlights: [...store.highlights],
    streak: store.streak,
  };
}

export function demoSubmit(
  questionId: string,
  body: string,
  largestInsertChars = 0,
):
  | { ok: true; attempt: PublicAttempt; cached: boolean }
  | { ok: false; error: string; message: string } {
  const question = DEMO_QUESTIONS.find((q) => q.id === questionId);
  if (!question) return { ok: false, error: "not_open", message: "Question not found." };

  const mark = fingerprint(question.id, body);
  const prior = store.attempts.filter((attempt) => attempt.questionId === question.id);

  const repeat = prior.find((attempt) => attempt.fingerprint === mark);
  if (repeat) return { ok: true, cached: true, attempt: publicAttempt(repeat) };

  if (prior.length >= question.max_tries) {
    return { ok: false, error: "no_tries", message: "No tries left on this question." };
  }

  const intake = validateAnswer(body, largestInsertChars);
  if (!intake.ok) return { ok: false, error: "intake", message: INTAKE_MESSAGES[intake.reason] };

  const quoteChecks = checkQuotes(body, DEMO_TEXT.body);
  const rubric = demoRubric(body, DEMO_TEXT.body);
  const integrity = runIntegrityChecks({
    body,
    aiPool: [],
    peerAnswers: store.attempts
      .filter((attempt) => attempt.questionId === question.id)
      .map((attempt) => attempt.body),
    curatorNote: ISSUE.curator_note,
    fabricatedQuote: hasFabricatedQuote(quoteChecks),
    graderUnserious: false,
  });

  const score = applyPenalties(weightedScore(rubric, question.kind), integrity.flags);
  const attempt: DemoAttempt = {
    id: `demo-attempt-${store.attempts.length + 1}`,
    questionId: question.id,
    tryNo: prior.length + 1,
    body,
    fingerprint: mark,
    percentile: provisionalPercentile(score, DEMO_CURVE),
    flags: integrity.flags,
  };
  store.attempts.push(attempt);

  return { ok: true, cached: false, attempt: publicAttempt(attempt) };
}

export function demoAddHighlight(
  highlight: Omit<HighlightRecord, "id">,
): HighlightRecord {
  const saved = { ...highlight, id: `demo-hl-${store.highlights.length + 1}` };
  store.highlights.push(saved);
  return saved;
}

export function demoRemoveHighlight(id: string) {
  store.highlights = store.highlights.filter((highlight) => highlight.id !== id);
}

export function demoSetPosition(lastParagraph: number) {
  store.lastParagraph = lastParagraph;
}

/** Stand-in top responses for the reveal. */
export function demoTopResponses(questionId: string) {
  const mine = store.attempts.filter((attempt) => attempt.questionId === questionId);
  const sample = [
    {
      handle: "aster",
      body: "The experiment could fail and he says so. Front only the essential facts means he does not know yet what they are, which is why the fishing image lands the way it does.",
      percentile: 96,
    },
    {
      handle: "oriel",
      body: "Resignation and deliberate living look the same from outside. Only one of them tells him anything, and that is the whole reason for the cabin.",
      percentile: 91,
    },
    {
      handle: "juniper",
      body: "A thousand stitches today to save nine tomorrow is effort spent defending against a future instead of living in a present.",
      percentile: 84,
    },
  ];
  return [
    ...mine.map((attempt) => ({
      handle: DEMO_USER.handle,
      body: attempt.body,
      percentile: attempt.percentile,
    })),
    ...sample,
  ]
    .sort((a, b) => b.percentile - a.percentile)
    .slice(0, 5);
}
