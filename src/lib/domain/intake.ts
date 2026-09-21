import { countWords, words } from "./text";

export const MIN_WORDS = 25;
export const MAX_WORDS = 180;
/** Word count only appears in the last stretch of the allowance. */
export const COUNTDOWN_FROM = MAX_WORDS - 20;

export type IntakeRejection =
  | "too_short"
  | "too_long"
  | "not_english"
  | "bulk_insert";

export type IntakeResult =
  | { ok: true; wordCount: number }
  | { ok: false; reason: IntakeRejection; wordCount: number };

/**
 * A small English stopword set. An answer of 25 words or more that contains
 * almost none of these is very unlikely to be English prose.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "is", "it",
  "that", "this", "for", "on", "as", "with", "was", "are", "be", "by", "not",
  "he", "she", "they", "we", "you", "i", "his", "her", "their", "our", "its",
  "from", "at", "which", "what", "when", "how", "why", "who", "has", "have",
  "had", "do", "does", "did", "so", "than", "then", "there", "here", "about",
]);

export function englishStopwordRatio(body: string): number {
  const tokens = words(body);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const token of tokens) if (STOPWORDS.has(token)) hits++;
  return hits / tokens.length;
}

export function isLikelyEnglish(body: string): boolean {
  const tokens = words(body);
  if (tokens.length === 0) return false;
  const latin = (body.match(/\p{Script=Latin}/gu) ?? []).length;
  const letters = (body.match(/\p{L}/gu) ?? []).length;
  if (letters > 0 && latin / letters < 0.8) return false;
  // Short answers get a gentler bar because there is less room for stopwords.
  const floor = tokens.length < 40 ? 0.1 : 0.14;
  return englishStopwordRatio(body) >= floor;
}

/**
 * The client blocks large single-event insertions while typing. The server
 * trusts nothing, so it re-checks length, language and the reported paste size.
 */
export const MAX_SINGLE_INSERT_CHARS = 120;

export function validateAnswer(body: string, largestInsertChars = 0): IntakeResult {
  const wordCount = countWords(body);
  if (wordCount < MIN_WORDS) return { ok: false, reason: "too_short", wordCount };
  if (wordCount > MAX_WORDS) return { ok: false, reason: "too_long", wordCount };
  if (largestInsertChars > MAX_SINGLE_INSERT_CHARS) {
    return { ok: false, reason: "bulk_insert", wordCount };
  }
  if (!isLikelyEnglish(body)) return { ok: false, reason: "not_english", wordCount };
  return { ok: true, wordCount };
}

export const INTAKE_MESSAGES: Record<IntakeRejection, string> = {
  too_short: `Write at least ${MIN_WORDS} words.`,
  too_long: `Keep it under ${MAX_WORDS} words.`,
  not_english: "Write your answer in English.",
  bulk_insert: "Type your answer rather than pasting it.",
};
