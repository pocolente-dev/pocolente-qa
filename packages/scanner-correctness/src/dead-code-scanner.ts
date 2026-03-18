import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Scanner, ScanContext, Finding } from "@pocolente/core";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TS_JS_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

// Match named imports: import { A, B, C as D } from "..."
const NAMED_IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*/;
// Match default import: import Foo from "..."
const DEFAULT_IMPORT_RE = /import\s+(\w+)\s+from\s+/;

// Return or throw statement (beginning of line, possibly indented)
const RETURN_THROW_RE = /^(\s*)(return|throw)\b/;

// Lines that do NOT constitute executable code after a return/throw
const NON_EXECUTABLE_RE = /^\s*(\}|catch\s*[\w(]|finally\s*\{|else\s*[\w{]|\/\/|\/\*|\*)/;

// ─── Extract imported names from a single import line ─────────────────────────

function extractImportedNames(line: string): string[] {
  const names: string[] = [];

  // Named imports
  const namedMatch = NAMED_IMPORT_RE.exec(line);
  if (namedMatch) {
    const parts = namedMatch[1].split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      // Handle "X as Y" — the local name is Y
      const asMatch = /(\w+)\s+as\s+(\w+)/.exec(trimmed);
      if (asMatch) {
        names.push(asMatch[2]);
      } else if (/^\w+$/.test(trimmed)) {
        names.push(trimmed);
      }
    }
  }

  // Default import (only if no named imports matched)
  if (names.length === 0) {
    const defaultMatch = DEFAULT_IMPORT_RE.exec(line);
    if (defaultMatch) {
      names.push(defaultMatch[1]);
    }
  }

  return names;
}

// ─── Check if a name is used outside its import line ─────────────────────────

function isNameUsed(name: string, lines: string[], importLineIndex: number): boolean {
  const wordBoundary = new RegExp(`\\b${escapeRegex(name)}\\b`);
  for (let i = 0; i < lines.length; i++) {
    if (i === importLineIndex) continue;
    if (wordBoundary.test(lines[i])) return true;
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Find unreachable code after return/throw ─────────────────────────────────

interface UnreachableLine {
  lineIndex: number; // 0-based index in the file's lines
}

function findUnreachableLines(lines: string[]): UnreachableLine[] {
  const unreachable: UnreachableLine[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const match = RETURN_THROW_RE.exec(lines[i]);
    if (!match) continue;

    const indent = match[1].length;

    // Scan subsequent lines for executable code at same or deeper indentation
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j];
      const trimmed = nextLine.trim();

      // Skip blank lines
      if (trimmed === "") continue;

      // Measure indentation of next line
      const nextIndent = nextLine.length - nextLine.trimStart().length;

      // If indentation decreased, we've left the block — stop
      if (nextIndent < indent) break;

      // If line looks like a block delimiter or catch/finally/else — stop
      if (NON_EXECUTABLE_RE.test(nextLine)) break;

      // We found executable code at same or deeper indentation — it's unreachable
      unreachable.push({ lineIndex: j });
      break; // only report first unreachable line per return/throw
    }
  }

  return unreachable;
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

export class DeadCodeScanner implements Scanner {
  id = "dead-code-scanner";
  name = "Dead Code Detector";
  layer = "correctness" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    const cfg = context.config.correctness.deadCode;

    if (!cfg.enabled) {
      return [];
    }

    const severity = cfg.severity;
    const findings: Finding[] = [];

    for (const file of context.diff) {
      if (!TS_JS_EXT.test(file.path)) continue;

      // Read the full file content from disk
      const fullPath = join(context.repoRoot, file.path);
      let content: string;
      try {
        content = await readFile(fullPath, "utf8");
      } catch {
        // File does not exist or cannot be read — skip silently
        continue;
      }

      const lines = content.split("\n");
      const addedSet = new Set(file.added.filter((l) => l.trim() !== ""));

      // ── Rule 1: Unused imports ──────────────────────────────────────────────
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim().startsWith("import")) continue;
        if (!addedSet.has(line.trim()) && !addedSet.has(line)) continue;

        const importedNames = extractImportedNames(line);
        for (const name of importedNames) {
          if (!isNameUsed(name, lines, i)) {
            findings.push({
              layer: "correctness",
              scanner: this.id,
              severity,
              confidence: 0.85,
              file: file.path,
              line: String(i + 1),
              title: `Unused import: "${name}"`,
              explanation: `The imported name "${name}" is never referenced in this file.`,
              suggestion: `Remove the unused import "${name}" to keep the code clean.`,
              cwe: null,
              owasp: null,
              estimatedEnergyImpact: null,
              rcsDelta: null,
            });
          }
        }
      }

      // ── Rule 2: Unreachable code after return/throw ─────────────────────────
      const unreachableLines = findUnreachableLines(lines);
      for (const { lineIndex } of unreachableLines) {
        const lineContent = lines[lineIndex];
        // Only report if this line is in the added lines
        if (!addedSet.has(lineContent.trim()) && !addedSet.has(lineContent)) {
          continue;
        }

        findings.push({
          layer: "correctness",
          scanner: this.id,
          severity,
          confidence: 0.9,
          file: file.path,
          line: String(lineIndex + 1),
          title: "Unreachable code detected",
          explanation:
            "Code after a return or throw statement will never execute.",
          suggestion: "Remove the unreachable code or restructure the logic.",
          cwe: null,
          owasp: null,
          estimatedEnergyImpact: null,
          rcsDelta: null,
        });
      }
    }

    return findings;
  }
}
