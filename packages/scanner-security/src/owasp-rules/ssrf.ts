import type { DiffFile } from "@pocolente/core";
import type { OwaspRule, RuleMatch } from "./types.js";

// HTTP client call patterns
const HTTP_CLIENT_RE = /\b(fetch|axios|axios\.get|axios\.post|axios\.put|axios\.delete|http\.get|http\.request|got|request)\s*\(/;

// A string literal argument: starts with " or ' or `
const STRING_LITERAL_ARG_RE = /\(\s*["'`]/;

// Literal-only string concatenation: "..." + "..." (both sides are literals)
const LITERAL_CONCAT_RE = /\(\s*["'][^"']*["']\s*\+\s*["'][^"']*["']/;

export const ssrfRule: OwaspRule = {
  id: "ssrf",
  name: "Server-Side Request Forgery (SSRF)",
  cwe: "CWE-918",
  owaspCategory: "A10:2021-SSRF",
  description:
    "Detected potential SSRF vulnerability: a non-literal value is passed as a URL to an HTTP client. Validate URLs against an allowlist before making HTTP requests.",

  testLine(line: string, lineNumber: number, _file: DiffFile): RuleMatch | null {
    // Must have an HTTP client call
    const clientMatch = HTTP_CLIENT_RE.exec(line);
    if (!clientMatch) return null;

    // Find the position after the matched call's opening paren
    const callEnd = clientMatch.index + clientMatch[0].length;
    const rest = line.slice(callEnd);

    // If the argument starts with a string literal, it's safe
    if (/^\s*["'`]/.test(rest)) {
      // Also check for literal + literal concatenation (still safe)
      if (LITERAL_CONCAT_RE.test(line.slice(clientMatch.index))) {
        return null;
      }
      return null;
    }

    return {
      line: lineNumber,
      matchedText: clientMatch[0],
      confidence: 0.85,
      suggestion:
        "Validate URLs against an allowlist of permitted hosts before making HTTP requests. Never pass user-controlled input directly as a URL.",
    };
  },
};
