import type { PublicQuestion, QuestionRecord } from "@/lib/types";

/**
 * The one place a question is stripped for the client. Pass thresholds never
 * cross this line.
 */
export function toPublicQuestion(question: QuestionRecord): PublicQuestion {
  const { pass_percentile: _threshold, ...rest } = question;
  void _threshold;
  return rest;
}
