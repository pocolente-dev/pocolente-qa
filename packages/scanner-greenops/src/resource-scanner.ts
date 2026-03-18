import type { Scanner, ScanContext, Finding } from "@pocolente/core";

const TS_JS_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

// Sync I/O APIs that block the event loop
const SYNC_FS_RE =
  /\b(?:readFileSync|writeFileSync|accessSync|statSync|readdirSync|mkdirSync)\s*\(/;

// Indicators that a file has async context
const ASYNC_CONTEXT_RE = /\basync\s+(?:function|\(|[a-zA-Z_$])|\bawait\s+/;

// Unbounded growth: .push( inside while(true), while(1), or for(;;)
const INFINITE_LOOP_RE = /\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;/;
const PUSH_RE = /\.push\s*\(/;

export class ResourceScanner implements Scanner {
  id = "resource-scanner";
  name = "Resource Allocation Scanner";
  layer = "greenops" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    if (!context.config.greenops.resources.enabled) {
      return [];
    }

    const severity = context.config.greenops.resources.severity;
    const findings: Finding[] = [];

    for (const file of context.diff) {
      if (!TS_JS_EXTENSIONS.test(file.path)) {
        continue;
      }

      // Check if the file's added lines contain async context
      const fileText = file.added.join("\n");
      const hasAsyncContext = ASYNC_CONTEXT_RE.test(fileText);

      // Track whether we are inside an infinite loop block
      let infiniteLoopDepth = 0;
      const loopBraceStack: number[] = [];

      for (let i = 0; i < file.added.length; i++) {
        const line = file.added[i];

        // Track infinite loop entry
        if (INFINITE_LOOP_RE.test(line)) {
          infiniteLoopDepth++;
          loopBraceStack.push(countOpenBraces(line) - countCloseBraces(line));
        } else if (infiniteLoopDepth > 0) {
          // Track brace depth to detect loop exit
          const net = countOpenBraces(line) - countCloseBraces(line);
          if (loopBraceStack.length > 0) {
            loopBraceStack[loopBraceStack.length - 1] += net;
            if (loopBraceStack[loopBraceStack.length - 1] <= -1) {
              loopBraceStack.pop();
              infiniteLoopDepth--;
            }
          }
        }

        // Rule 1: Sync I/O in async context
        if (hasAsyncContext && SYNC_FS_RE.test(line)) {
          const match = line.match(SYNC_FS_RE);
          const method = match ? match[0].replace(/\s*\($/, "") : "sync I/O";
          findings.push({
            layer: "greenops",
            scanner: "resource-scanner",
            severity,
            confidence: 0.95,
            file: file.path,
            line: String(i + 1),
            title: `Sync I/O (${method}) used in async context`,
            explanation:
              `${method} blocks the Node.js event loop while waiting for I/O to complete. ` +
              "In an async function this prevents other requests from being processed, " +
              "wasting CPU time and increasing energy consumption.",
            suggestion:
              `Replace ${method} with its async equivalent (e.g., fs.promises.readFile / fs.readFile) ` +
              "and await the result to keep the event loop free.",
            cwe: null,
            owasp: null,
            estimatedEnergyImpact: "medium",
            rcsDelta: "+3",
          });
        }

        // Rule 2: Unbounded array growth inside an infinite loop
        if (infiniteLoopDepth > 0 && PUSH_RE.test(line)) {
          findings.push({
            layer: "greenops",
            scanner: "resource-scanner",
            severity,
            confidence: 0.80,
            file: file.path,
            line: String(i + 1),
            title: "Unbounded array growth inside infinite loop",
            explanation:
              "An array .push() was detected inside a while(true) or for(;;) loop. " +
              "Without a size bound this causes unbounded memory growth that will eventually exhaust heap memory.",
            suggestion:
              "Add a size cap (e.g., if (items.length >= MAX) break;), use a bounded ring-buffer, " +
              "or process items as they arrive rather than accumulating them.",
            cwe: null,
            owasp: null,
            estimatedEnergyImpact: "medium",
            rcsDelta: "+3",
          });
        }
      }
    }

    return findings;
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function countOpenBraces(line: string): number {
  return (line.match(/\{/g) ?? []).length;
}

function countCloseBraces(line: string): number {
  return (line.match(/\}/g) ?? []).length;
}
