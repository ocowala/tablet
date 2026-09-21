import { shingles, words } from "./text";

/** Jaccard overlap of word trigrams. Good at catching lightly edited copies. */
export function shingleSimilarity(a: string, b: string, size = 3): number {
  const left = shingles(a, size);
  const right = shingles(b, size);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const s of left) if (right.has(s)) shared++;
  return shared / (left.size + right.size - shared);
}

/** Cosine similarity over word counts. Catches reordered paraphrase. */
export function cosineSimilarity(a: string, b: string): number {
  const count = (input: string) => {
    const map = new Map<string, number>();
    for (const w of words(input)) map.set(w, (map.get(w) ?? 0) + 1);
    return map;
  };
  const left = count(a);
  const right = count(b);
  if (left.size === 0 || right.size === 0) return 0;
  let dot = 0;
  for (const [token, weight] of left) dot += weight * (right.get(token) ?? 0);
  const norm = (map: Map<string, number>) =>
    Math.sqrt([...map.values()].reduce((sum, v) => sum + v * v, 0));
  const denominator = norm(left) * norm(right);
  return denominator === 0 ? 0 : dot / denominator;
}

/** The blended score the integrity checks read. */
export function similarity(a: string, b: string): number {
  return Math.max(shingleSimilarity(a, b), cosineSimilarity(a, b) * 0.9);
}

export function maxSimilarity(body: string, pool: readonly string[]): number {
  let highest = 0;
  for (const candidate of pool) {
    const score = similarity(body, candidate);
    if (score > highest) highest = score;
  }
  return highest;
}
