export interface SecretMatch {
  patternName: string;
  matched: string;
  confidence: number;
}

interface SecretPattern {
  name: string;
  regex: RegExp;
  confidence: number;
}

const PATTERNS: SecretPattern[] = [
  {
    name: "aws-access-key",
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    confidence: 1.0,
  },
  {
    name: "github-token",
    regex: /\b(ghp|gho|ghs|ghr)_[A-Za-z0-9_]{36,}\b/,
    confidence: 1.0,
  },
  {
    name: "stripe-secret-key",
    regex: /\b(sk_live|rk_live)_[A-Za-z0-9]{20,}\b/,
    confidence: 1.0,
  },
  {
    name: "private-key",
    regex: /-----BEGIN\s+(RSA|DSA|EC|OPENSSH|PGP)?\s*PRIVATE KEY-----/,
    confidence: 1.0,
  },
  {
    name: "database-url",
    regex: /\b(postgres|postgresql|mysql|mongodb|redis):\/\/[^\s"'`]+/,
    confidence: 0.95,
  },
  {
    name: "jwt",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    confidence: 0.9,
  },
  {
    name: "slack-webhook",
    regex: /hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{20,}/,
    confidence: 1.0,
  },
  {
    name: "gcp-api-key",
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/,
    confidence: 1.0,
  },
  {
    name: "generic-secret-assignment",
    regex: /(?:password|secret|token|api_key|apikey|api-key)\s*[:=]\s*["'][^"']{8,}["']/i,
    confidence: 0.8,
  },
];

export function matchSecretPatterns(line: string): SecretMatch[] {
  const results: SecretMatch[] = [];

  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(line);
    if (match !== null) {
      results.push({
        patternName: pattern.name,
        matched: match[0],
        confidence: pattern.confidence,
      });
    }
  }

  return results;
}
