/** Shared text normalisation used by intake, fingerprints, similarity and quote checks. */

export function normalizeQuotes(input: string): string {
  return input
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...");
}

/** Lowercase, punctuation stripped, whitespace collapsed. */
export function normalize(input: string): string {
  return normalizeQuotes(input)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function words(input: string): string[] {
  const normalized = normalize(input);
  return normalized.length === 0 ? [] : normalized.split(" ");
}

export function countWords(input: string): number {
  return words(input).length;
}

export function shingles(input: string, size = 3): Set<string> {
  const tokens = words(input);
  const out = new Set<string>();
  if (tokens.length < size) {
    if (tokens.length > 0) out.add(tokens.join(" "));
    return out;
  }
  for (let i = 0; i + size <= tokens.length; i++) {
    out.add(tokens.slice(i, i + size).join(" "));
  }
  return out;
}
