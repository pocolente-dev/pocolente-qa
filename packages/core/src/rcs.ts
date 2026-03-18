import type { Finding } from "./types.js";

export function computeRcs(findings: Finding[]): number {
  return findings
    .filter((f) => f.layer === "greenops" && f.rcsDelta)
    .reduce((sum, f) => {
      const delta = parseInt(f.rcsDelta!, 10);
      return sum + (isNaN(delta) ? 0 : delta);
    }, 0);
}

export type RcsBadgeColor = "green" | "yellow" | "red";

export function rcsBadge(delta: number, threshold: number): RcsBadgeColor {
  if (delta <= 0) return "green";
  if (delta <= threshold) return "yellow";
  return "red";
}
