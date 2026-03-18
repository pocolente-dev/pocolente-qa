import type { DiffFile } from "@pocolente/core";

export interface RuleMatch {
  line: number;
  matchedText: string;
  confidence: number;
  suggestion: string;
}

export interface OwaspRule {
  id: string;
  name: string;
  cwe: string;
  owaspCategory: string;
  description: string;
  testLine(line: string, lineNumber: number, file: DiffFile): RuleMatch | null;
}
