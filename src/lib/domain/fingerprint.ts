import { createHash } from "node:crypto";
import { normalize } from "./text";

/**
 * A near identical resubmission returns the cached result and does not spend a
 * try, so the fingerprint has to ignore case, punctuation and whitespace.
 */
export function fingerprint(questionId: string, body: string): string {
  return createHash("sha256").update(`${questionId}\u0000${normalize(body)}`).digest("hex");
}
