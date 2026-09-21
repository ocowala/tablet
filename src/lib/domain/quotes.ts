import { normalize, normalizeQuotes } from "./text";

export type QuoteCheck = {
  quote: string;
  found: boolean;
};

/** Pulls double quoted spans of four words or more out of an answer. */
export function extractQuotes(body: string): string[] {
  const source = normalizeQuotes(body);
  const found: string[] = [];
  for (const match of source.matchAll(/"([^"]{8,400})"/g)) {
    const quote = match[1].trim();
    if (normalize(quote).split(" ").length >= 4) found.push(quote);
  }
  return found;
}

/**
 * Cited quotes are checked against the real text. A quote the text does not
 * contain is reported to the grader so it cannot earn evidence credit.
 */
export function checkQuotes(body: string, paragraphs: readonly string[]): QuoteCheck[] {
  const haystack = normalize(paragraphs.join(" "));
  return extractQuotes(body).map((quote) => ({
    quote,
    found: haystack.includes(normalize(quote)),
  }));
}

export function hasFabricatedQuote(checks: readonly QuoteCheck[]): boolean {
  return checks.some((check) => !check.found);
}
