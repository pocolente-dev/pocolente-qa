import type { DiffFile } from "@pocolente/core";
import type { OwaspRule, RuleMatch } from "./types.js";

// File system / path operations that can be vulnerable to path traversal
const FILE_OP_RE = /\b(fs\.readFile|fs\.readFileSync|fs\.createReadStream|path\.join|path\.resolve)\s*\(/;

// Indicators of user-controlled input in arguments
const USER_INPUT_RE = /\b(req|request)\.(params|query|body)\b/;

export const pathTraversalRule: OwaspRule = {
  id: "path-traversal",
  name: "Path Traversal",
  cwe: "CWE-22",
  owaspCategory: "A01:2021-Broken-Access-Control",
  description:
    "Detected potential path traversal vulnerability: user-controlled input is used directly in a file system operation. Validate and sanitize paths to prevent directory traversal attacks.",

  testLine(line: string, lineNumber: number, _file: DiffFile): RuleMatch | null {
    // Must have a file/path operation
    const opMatch = FILE_OP_RE.exec(line);
    if (!opMatch) return null;

    // Must have user-controlled input indicators
    if (!USER_INPUT_RE.test(line)) return null;

    return {
      line: lineNumber,
      matchedText: opMatch[0],
      confidence: 0.9,
      suggestion:
        "Validate and sanitize file paths. Use path.resolve() with a whitelist of allowed base directories, and verify the resolved path stays within the expected directory.",
    };
  },
};
