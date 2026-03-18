import type { Scanner, ScanContext, Finding } from "@pocolente/core";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TS_JS_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const TEST_FILE = /(\.(test|spec)\.[a-z]+$)|([\\/]__tests__[\\/])/i;

// Rule 1: empty catch block on a single line  e.g.  } catch (e) {}
const EMPTY_CATCH_RE = /catch\s*\([^)]*\)\s*\{\s*\}/;

// Rule 2: console debug statements
const CONSOLE_RE = /console\.(log|debug|info)\s*\(/;

// Rule 3: untracked TODO/FIXME/HACK — NOT followed by (#123), (ABC-123), or (@user) on the same line
const TODO_BARE_RE = /\b(TODO|FIXME|HACK)\b(?!\s*\((?:#\d+|\w+-\d+|@\w+)\))/;

// ─── Scanner ──────────────────────────────────────────────────────────────────

export class GenerationQualityScanner implements Scanner {
  id = "generation-quality-scanner";
  name = "Generation Quality Scanner";
  layer = "correctness" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    const cfg = context.config.correctness.generationQuality;

    if (!cfg.enabled) {
      return [];
    }

    const severity = cfg.severity;
    const findings: Finding[] = [];

    for (const file of context.diff) {
      // Only scan TypeScript / JavaScript files
      if (!TS_JS_EXT.test(file.path)) continue;

      const isTestFile = TEST_FILE.test(file.path);

      for (let i = 0; i < file.added.length; i++) {
        const line = file.added[i];
        const lineNum = String(i + 1);

        // Rule 1: empty catch block
        if (EMPTY_CATCH_RE.test(line)) {
          findings.push({
            layer: "correctness",
            scanner: this.id,
            severity,
            confidence: 0.9,
            file: file.path,
            line: lineNum,
            title: "Empty catch block detected",
            explanation:
              "An empty catch block silently swallows exceptions, making debugging extremely difficult and hiding runtime errors.",
            suggestion:
              "Handle the error explicitly: log it, re-throw it, or return an appropriate error response.",
            cwe: "CWE-390",
            owasp: null,
            estimatedEnergyImpact: null,
            rcsDelta: null,
          });
        }

        // Rule 2: console statements — skip test files
        if (!isTestFile && CONSOLE_RE.test(line)) {
          findings.push({
            layer: "correctness",
            scanner: this.id,
            severity,
            confidence: 0.85,
            file: file.path,
            line: lineNum,
            title: "Console statement in production code",
            explanation:
              "console.log/debug/info statements left in production code can leak sensitive data and pollute logs.",
            suggestion:
              "Remove the console statement or replace it with a structured logger (e.g. pino, winston).",
            cwe: null,
            owasp: null,
            estimatedEnergyImpact: null,
            rcsDelta: null,
          });
        }

        // Rule 3: bare TODO/FIXME/HACK without issue tracker reference
        if (TODO_BARE_RE.test(line)) {
          findings.push({
            layer: "correctness",
            scanner: this.id,
            severity,
            confidence: 0.8,
            file: file.path,
            line: lineNum,
            title: "TODO without issue tracker link",
            explanation:
              "A TODO/FIXME/HACK comment was found without a linked issue (e.g. #123 or PROJ-456). Untracked TODOs often get forgotten.",
            suggestion:
              "Link the comment to an issue tracker item: // TODO(#123): description",
            cwe: null,
            owasp: null,
            estimatedEnergyImpact: null,
            rcsDelta: null,
          });
        }
      }
    }

    return findings;
  }
}
