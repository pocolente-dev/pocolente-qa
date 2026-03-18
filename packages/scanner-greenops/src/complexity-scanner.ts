import type { Scanner, ScanContext, Finding } from "@pocolente/core";

const TS_JS_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

// Patterns that open a loop scope
const LOOP_OPEN_RE =
  /(?:(?:^|\s)(?:for|while)\s*\(|\.(?:forEach|map|reduce)\s*\()/;

// Patterns that signal the end of a block (closing brace, possibly with ;)
const BLOCK_CLOSE_RE = /^\s*\}[\s;)]*$/;

// N+1 query method patterns
const QUERY_RE =
  /\.(?:query|findOne|findUnique|findFirst|execute)\s*\(/;

// Quadratic string concatenation: `result +=`
const STRING_CONCAT_RE = /\+=\s/;

export class ComplexityScanner implements Scanner {
  id = "complexity-scanner";
  name = "Algorithmic Complexity Scanner";
  layer = "greenops" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    if (!context.config.greenops.complexity.enabled) {
      return [];
    }

    const severity = context.config.greenops.complexity.severity;
    const findings: Finding[] = [];

    for (const file of context.diff) {
      if (!TS_JS_EXTENSIONS.test(file.path)) {
        continue;
      }

      let loopDepth = 0;
      // Track indentation of each loop open so we can decrement correctly
      const loopIndentStack: number[] = [];

      for (let i = 0; i < file.added.length; i++) {
        const line = file.added[i];
        const trimmed = line.trimStart();
        const indent = line.length - trimmed.length;

        // Check for loop closing before opening to handle same-line `})`
        if (BLOCK_CLOSE_RE.test(line) && loopDepth > 0) {
          // Pop any loop frames whose indentation is >= current indent
          while (
            loopIndentStack.length > 0 &&
            loopIndentStack[loopIndentStack.length - 1] >= indent
          ) {
            loopIndentStack.pop();
            loopDepth--;
          }
        }

        const isLoopOpen = LOOP_OPEN_RE.test(line);

        if (isLoopOpen) {
          if (loopDepth >= 1) {
            // Nested loop detected
            findings.push({
              layer: "greenops",
              scanner: "complexity-scanner",
              severity,
              confidence: 0.85,
              file: file.path,
              line: String(i + 1),
              title: "Nested loop detected (O(n²) complexity)",
              explanation:
                "A nested loop was detected in the added lines. Nested loops result in O(n²) or worse time complexity, which can cause significant CPU and energy waste on large datasets.",
              suggestion:
                "Consider refactoring to use a Map/Set for lookups, or flatten the iteration to reduce complexity to O(n).",
              cwe: null,
              owasp: null,
              estimatedEnergyImpact: "high",
              rcsDelta: "+5",
            });
          }

          loopDepth++;
          loopIndentStack.push(indent);
          continue;
        }

        // N+1 query: database call inside a loop
        if (loopDepth >= 1 && QUERY_RE.test(line)) {
          findings.push({
            layer: "greenops",
            scanner: "complexity-scanner",
            severity,
            confidence: 0.9,
            file: file.path,
            line: String(i + 1),
            title: "N+1 query pattern: database call inside loop",
            explanation:
              "A database query was detected inside a loop. This N+1 pattern causes one database round-trip per iteration, leading to O(n) queries instead of O(1), which is extremely wasteful.",
            suggestion:
              "Batch the queries using an IN clause or load all required records before the loop (e.g., use findMany with an id list).",
            cwe: null,
            owasp: null,
            estimatedEnergyImpact: "high",
            rcsDelta: "+10",
          });
        }

        // Quadratic string concatenation inside a loop
        if (loopDepth >= 1 && STRING_CONCAT_RE.test(line)) {
          findings.push({
            layer: "greenops",
            scanner: "complexity-scanner",
            severity,
            confidence: 0.75,
            file: file.path,
            line: String(i + 1),
            title: "Quadratic string concatenation in loop",
            explanation:
              "String concatenation using += inside a loop creates a new string on every iteration, resulting in O(n²) memory allocations and copies.",
            suggestion:
              "Collect strings in an array and join them after the loop: `parts.push(item); result = parts.join('');`",
            cwe: null,
            owasp: null,
            estimatedEnergyImpact: "medium",
            rcsDelta: "+2",
          });
        }
      }
    }

    return findings;
  }
}
