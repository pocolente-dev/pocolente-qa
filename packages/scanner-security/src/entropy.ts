export function shannonEntropy(str: string): number {
  if (str.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

interface EntropyMatch {
  matched: string;
  confidence: number;
  entropy: number;
}

const ASSIGNMENT_STRING_REGEX = /(?:=|:)\s*["']([^"']{20,})["']/;
const COMMENT_PREFIX = /^\s*(?:\/\/|\/\*|\*|#)/;
const IMPORT_PATTERN = /^\s*import\s/;
const URL_WITHOUT_CREDS = /^https?:\/\/[^:@]*$/;

const ENTROPY_THRESHOLD = 4.5;
const MIN_LENGTH = 20;

export function isHighEntropySecret(line: string): EntropyMatch | null {
  if (COMMENT_PREFIX.test(line)) return null;
  if (IMPORT_PATTERN.test(line)) return null;

  const match = ASSIGNMENT_STRING_REGEX.exec(line);
  if (!match) return null;

  const value = match[1];
  if (value.length < MIN_LENGTH) return null;
  if (URL_WITHOUT_CREDS.test(value)) return null;

  const entropy = shannonEntropy(value);
  if (entropy < ENTROPY_THRESHOLD) return null;

  const confidence = entropy >= 5.0 ? 0.85 : 0.80;

  return { matched: value, confidence, entropy };
}
