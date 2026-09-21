import { maxSimilarity } from "./similarity";
import { words } from "./text";

export const FLAGS = [
  "ai_pool_match",
  "peer_match",
  "curator_echo",
  "prompt_injection",
  "fabricated_quote",
  "unserious",
] as const;
export type Flag = (typeof FLAGS)[number];

/** Only `unserious` costs the reader anything. The rest are review signals. */
export const PENALISING_FLAGS: readonly Flag[] = ["unserious"];

export const SIMILARITY_THRESHOLD = 0.6;

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all )?(?:the )?(?:previous|prior|above) (?:instructions|prompts?)/i,
  /disregard (?:all )?(?:the )?(?:previous|prior|above)/i,
  /\byou are (?:an? )?(?:ai|assistant|language model|grader)\b/i,
  /\bsystem prompt\b/i,
  /\b(?:award|give|assign) (?:me )?(?:full|maximum|top|the highest) (?:marks|score|points|percentile)/i,
  /\bscore this (?:answer )?(?:a )?(?:5|five|100)\b/i,
  /<\/?(?:system|instructions?|prompt)>/i,
];

export function detectsInjection(body: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(body));
}

/** Cheap unseriousness signal: almost no distinct vocabulary. */
export function looksUnserious(body: string): boolean {
  const tokens = words(body);
  if (tokens.length === 0) return true;
  const distinct = new Set(tokens).size;
  return distinct / tokens.length < 0.35;
}

export type IntegrityInput = {
  body: string;
  /** Internal pool of AI written answers for this text. */
  aiPool: readonly string[];
  /** Other readers' answers to this question today. */
  peerAnswers: readonly string[];
  curatorNote: string;
  fabricatedQuote: boolean;
  /** The graders' own read on whether the answer is serious. */
  graderUnserious: boolean;
};

export type IntegrityReport = {
  flags: Flag[];
  signals: {
    aiPoolSimilarity: number;
    peerSimilarity: number;
    curatorSimilarity: number;
  };
};

export function runIntegrityChecks(input: IntegrityInput): IntegrityReport {
  const aiPoolSimilarity = maxSimilarity(input.body, input.aiPool);
  const peerSimilarity = maxSimilarity(input.body, input.peerAnswers);
  const curatorSimilarity = maxSimilarity(input.body, [input.curatorNote]);

  const flags: Flag[] = [];
  if (aiPoolSimilarity >= SIMILARITY_THRESHOLD) flags.push("ai_pool_match");
  if (peerSimilarity >= SIMILARITY_THRESHOLD) flags.push("peer_match");
  if (curatorSimilarity >= SIMILARITY_THRESHOLD) flags.push("curator_echo");
  if (detectsInjection(input.body)) flags.push("prompt_injection");
  if (input.fabricatedQuote) flags.push("fabricated_quote");
  if (input.graderUnserious || looksUnserious(input.body)) flags.push("unserious");

  return { flags, signals: { aiPoolSimilarity, peerSimilarity, curatorSimilarity } };
}

export function isPenalised(flags: readonly string[]): boolean {
  return PENALISING_FLAGS.some((flag) => flags.includes(flag));
}
