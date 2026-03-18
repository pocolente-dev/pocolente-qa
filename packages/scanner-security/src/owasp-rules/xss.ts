import type { DiffFile } from "@pocolente/core";
import type { OwaspRule, RuleMatch } from "./types.js";

// dangerouslySetInnerHTML={{ __html: SOMETHING }} where SOMETHING is not a string literal
// Matches __html: followed by something that is NOT " or '
const DANGEROUS_HTML_VAR_RE = /__html:\s*(?!["'`])[^\s}]+/;

// innerHTML = SOMETHING where SOMETHING is not a string literal (not " or ') and not empty
const INNER_HTML_ASSIGN_RE = /\.innerHTML\s*=\s*(?!["'`]?\s*["'`]?\s*;)(?!["'`]\s*["'`])(?!["'])[^\s;]+/;

// v-html directive
const V_HTML_RE = /v-html\s*=/;

export const xssRule: OwaspRule = {
  id: "xss",
  name: "Cross-Site Scripting (XSS)",
  cwe: "CWE-79",
  owaspCategory: "A03:2021-Injection",
  description:
    "Detected potential XSS vulnerability: user-controlled data is inserted into HTML without sanitization. Use safe alternatives like textContent, or sanitize input with a trusted library.",

  testLine(line: string, lineNumber: number, _file: DiffFile): RuleMatch | null {
    // Check dangerouslySetInnerHTML with a variable (not a string literal)
    if (line.includes("dangerouslySetInnerHTML")) {
      if (DANGEROUS_HTML_VAR_RE.test(line)) {
        return {
          line: lineNumber,
          matchedText: "dangerouslySetInnerHTML",
          confidence: 0.9,
          suggestion:
            "Avoid dangerouslySetInnerHTML with dynamic content. If you must use it, sanitize with DOMPurify first.",
        };
      }
      return null;
    }

    // Check innerHTML assignment with a non-literal value
    if (line.includes(".innerHTML")) {
      // Match: .innerHTML = <something>
      const assignMatch = /\.innerHTML\s*=\s*(.+?)\s*;?\s*$/.exec(line);
      if (assignMatch) {
        const rhs = assignMatch[1].trim();
        // Safe: empty string or string literal (starts with " or ')
        const isStringLiteral = /^["'`].*["'`]$/.test(rhs) || rhs === '""' || rhs === "''" || rhs === "``";
        const isEmptyString = /^["'`]["'`]$/.test(rhs) || rhs === '""' || rhs === "''";
        if (!isStringLiteral && !isEmptyString) {
          return {
            line: lineNumber,
            matchedText: ".innerHTML =",
            confidence: 0.85,
            suggestion:
              "Use element.textContent instead of innerHTML for text content. If HTML is needed, sanitize with DOMPurify.",
          };
        }
      }
      return null;
    }

    // Check v-html directive (Vue.js)
    if (V_HTML_RE.test(line)) {
      return {
        line: lineNumber,
        matchedText: "v-html",
        confidence: 0.8,
        suggestion:
          "Avoid v-html with untrusted content. Use v-text for text, or sanitize HTML with DOMPurify before binding.",
      };
    }

    return null;
  },
};
