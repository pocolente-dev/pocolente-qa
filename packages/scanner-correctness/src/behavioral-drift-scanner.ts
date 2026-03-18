import type { Scanner, ScanContext, Finding } from "@pocolente/core";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TS_JS_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

// Matches: export function Foo(...) or export async function Foo(...)
const EXPORT_FUNCTION_RE =
  /^\s*export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/;

// Matches: export class Foo or export abstract class Foo
const EXPORT_CLASS_RE = /^\s*export\s+(?:abstract\s+)?class\s+(\w+)/;

// Matches: export const/let/type/interface NAME
const EXPORT_VAR_RE =
  /^\s*export\s+(?:const|let|var|type|interface)\s+(\w+)/;

// Matches: export default function or export default class
const EXPORT_DEFAULT_FUNC_RE =
  /^\s*export\s+default\s+(?:async\s+)?function\s*(\w*)\s*\(([^)]*)\)/;
const EXPORT_DEFAULT_CLASS_RE =
  /^\s*export\s+default\s+(?:abstract\s+)?class\s+(\w*)/;

// Matches: export { A, B, C }
const EXPORT_BRACE_RE = /^\s*export\s*\{([^}]+)\}/;

// ─── Export descriptor ────────────────────────────────────────────────────────

interface ExportDescriptor {
  name: string;
  kind: "function" | "class" | "variable" | "named-list";
  paramCount: number | null; // null for non-functions
  rawParams: string | null;
}

function countParams(paramStr: string): number {
  if (paramStr.trim() === "") return 0;
  // Split by comma but be careful about nested generics/types
  // Simple approach: count top-level commas
  let depth = 0;
  let count = 1;
  for (const ch of paramStr) {
    if (ch === "(" || ch === "<" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === ">" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) count++;
  }
  return count;
}

function parseExports(lines: string[]): ExportDescriptor[] {
  const exports: ExportDescriptor[] = [];

  for (const line of lines) {
    // export function / export async function
    const fnMatch = EXPORT_FUNCTION_RE.exec(line);
    if (fnMatch) {
      exports.push({
        name: fnMatch[1],
        kind: "function",
        paramCount: countParams(fnMatch[2]),
        rawParams: fnMatch[2],
      });
      continue;
    }

    // export default function
    const defaultFnMatch = EXPORT_DEFAULT_FUNC_RE.exec(line);
    if (defaultFnMatch) {
      exports.push({
        name: defaultFnMatch[1] || "default",
        kind: "function",
        paramCount: countParams(defaultFnMatch[2]),
        rawParams: defaultFnMatch[2],
      });
      continue;
    }

    // export class
    const classMatch = EXPORT_CLASS_RE.exec(line);
    if (classMatch) {
      exports.push({
        name: classMatch[1],
        kind: "class",
        paramCount: null,
        rawParams: null,
      });
      continue;
    }

    // export default class
    const defaultClassMatch = EXPORT_DEFAULT_CLASS_RE.exec(line);
    if (defaultClassMatch) {
      exports.push({
        name: defaultClassMatch[1] || "default",
        kind: "class",
        paramCount: null,
        rawParams: null,
      });
      continue;
    }

    // export const/let/var/type/interface
    const varMatch = EXPORT_VAR_RE.exec(line);
    if (varMatch) {
      exports.push({
        name: varMatch[1],
        kind: "variable",
        paramCount: null,
        rawParams: null,
      });
      continue;
    }

    // export { A, B, C }
    const braceMatch = EXPORT_BRACE_RE.exec(line);
    if (braceMatch) {
      const names = braceMatch[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean);
      for (const name of names) {
        exports.push({
          name,
          kind: "named-list",
          paramCount: null,
          rawParams: null,
        });
      }
    }
  }

  return exports;
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

export class BehavioralDriftScanner implements Scanner {
  id = "behavioral-drift-scanner";
  name = "Behavioral Drift Analyzer";
  layer = "correctness" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    const cfg = context.config.correctness.behavioralDrift;

    if (!cfg.enabled) {
      return [];
    }

    const blockSeverity = cfg.severity; // "block" by default
    const findings: Finding[] = [];

    for (const file of context.diff) {
      if (!TS_JS_EXT.test(file.path)) continue;

      const removedExports = parseExports(file.removed);
      const addedExports = parseExports(file.added);

      // Build a lookup map for added exports by name
      const addedByName = new Map<string, ExportDescriptor>();
      for (const exp of addedExports) {
        addedByName.set(exp.name, exp);
      }

      for (const removed of removedExports) {
        const added = addedByName.get(removed.name);

        if (!added) {
          // Export was removed entirely
          findings.push({
            layer: "correctness",
            scanner: this.id,
            severity: blockSeverity,
            confidence: 0.95,
            file: file.path,
            line: "0",
            title: `Removed export: "${removed.name}"`,
            explanation: `The exported symbol "${removed.name}" was removed. This is a breaking change for consumers.`,
            suggestion: `Restore the export or mark it as deprecated before removal.`,
            cwe: null,
            owasp: null,
            estimatedEnergyImpact: null,
            rcsDelta: null,
          });
        } else if (
          removed.kind === "function" &&
          added.kind === "function" &&
          removed.paramCount !== null &&
          added.paramCount !== null
        ) {
          if (added.paramCount < removed.paramCount) {
            // Parameter removed — breaking change
            findings.push({
              layer: "correctness",
              scanner: this.id,
              severity: blockSeverity,
              confidence: 0.9,
              file: file.path,
              line: "0",
              title: `Parameter removed from export: "${removed.name}"`,
              explanation: `"${removed.name}" had ${removed.paramCount} parameter(s) but now has ${added.paramCount}. Removing parameters is a breaking change.`,
              suggestion: `Keep the old parameter signature and add overloads or optional parameters instead.`,
              cwe: null,
              owasp: null,
              estimatedEnergyImpact: null,
              rcsDelta: null,
            });
          } else if (added.paramCount > removed.paramCount) {
            // Parameter added — potentially non-breaking (warn)
            findings.push({
              layer: "correctness",
              scanner: this.id,
              severity: "warn",
              confidence: 0.8,
              file: file.path,
              line: "0",
              title: `Parameter added to export: "${removed.name}"`,
              explanation: `"${removed.name}" had ${removed.paramCount} parameter(s) but now has ${added.paramCount}. Adding required parameters can break callers.`,
              suggestion: `Ensure the new parameter is optional (e.g. "param?: Type") to avoid breaking existing callers.`,
              cwe: null,
              owasp: null,
              estimatedEnergyImpact: null,
              rcsDelta: null,
            });
          }
        }
      }
    }

    return findings;
  }
}
