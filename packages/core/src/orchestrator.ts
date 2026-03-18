import type { ScanContext, ScannerResult, Finding } from "./types.js";
import type { Scanner } from "./scanner.js";

function matchGlob(filePath: string, pattern: string): boolean {
  if (pattern === "**") return true;
  if (pattern.startsWith("**/")) {
    const suffix = pattern.slice(3);
    if (suffix.includes("*")) {
      // e.g., **/*.test.* → check if filename contains .test.
      const parts = suffix.split("*");
      return parts.every(part => part === "" || filePath.includes(part));
    }
    return filePath.includes(suffix);
  }
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3);
    return filePath.startsWith(prefix + "/") || filePath === prefix;
  }
  return filePath === pattern || filePath.startsWith(pattern.replace("**", ""));
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);
    // Allow Node.js to exit even if this timer is pending
    if (timer.unref) {
      timer.unref();
    }
  });
  return Promise.race([promise, timeoutPromise]);
}

async function runSingleScanner(
  scanner: Scanner,
  context: ScanContext,
  timeoutMs: number,
): Promise<ScannerResult> {
  const start = Date.now();

  try {
    const findings = await withTimeout<Finding[]>(
      scanner.scan(context),
      timeoutMs,
      `Scanner "${scanner.name}" timed out after ${timeoutMs}ms`,
    );
    const durationMs = Date.now() - start;
    return {
      scannerId: scanner.id,
      layer: scanner.layer,
      findings,
      durationMs,
      error: null,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout =
      message.includes("timed out") ||
      message.toLowerCase().includes("timeout");

    const errorFinding: Finding = {
      layer: scanner.layer,
      scanner: scanner.id,
      severity: "info",
      confidence: 1,
      file: "",
      line: "",
      title: isTimeout
        ? `Scanner "${scanner.name}" timed out`
        : `Scanner "${scanner.name}" failed`,
      explanation: message,
      suggestion: "Check scanner configuration or contact the scanner author.",
      cwe: null,
      owasp: null,
      estimatedEnergyImpact: null,
      rcsDelta: null,
    };

    return {
      scannerId: scanner.id,
      layer: scanner.layer,
      findings: [errorFinding],
      durationMs,
      error: message,
    };
  }
}

export async function runScanners(
  scanners: Scanner[],
  context: ScanContext,
  options?: { timeoutMs?: number },
): Promise<ScannerResult[]> {
  const timeoutMs = options?.timeoutMs ?? 15_000;

  // Pre-filter diff by scan paths
  const config = context.config;
  const filteredDiff = context.diff.filter(file => {
    const matchesInclude = config.scanPaths.include.some(pattern => matchGlob(file.path, pattern));
    const matchesExclude = config.scanPaths.exclude.some(pattern => matchGlob(file.path, pattern));
    return matchesInclude && !matchesExclude;
  });
  const filteredContext = { ...context, diff: filteredDiff };

  return Promise.all(scanners.map((scanner) => runSingleScanner(scanner, filteredContext, timeoutMs)));
}
