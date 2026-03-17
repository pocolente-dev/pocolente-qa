import type { Finding, Severity } from "./types.js";

export type ScanStatus = "pass" | "block";

const SEVERITY_ORDER: Record<Severity, number> = {
  block: 3,
  warn: 2,
  info: 1,
};

/**
 * Filters findings to only those at or above the given severity threshold.
 */
export function filterFindings(findings: Finding[], threshold: Severity): Finding[] {
  const minLevel = SEVERITY_ORDER[threshold];
  return findings.filter((f) => SEVERITY_ORDER[f.severity] >= minLevel);
}

/**
 * Removes duplicate findings by composite key: file:line:scanner.
 */
export function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.file}:${f.line}:${f.scanner}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Returns "block" if any finding severity is >= blockOn threshold.
 * Returns "pass" if blockOn is "none" or no findings meet the threshold.
 */
export function computeStatus(
  findings: Finding[],
  blockOn: Severity | "none"
): ScanStatus {
  if (blockOn === "none") return "pass";
  const minLevel = SEVERITY_ORDER[blockOn];
  const hasBlocking = findings.some((f) => SEVERITY_ORDER[f.severity] >= minLevel);
  return hasBlocking ? "block" : "pass";
}
