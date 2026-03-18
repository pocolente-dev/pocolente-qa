import type { Finding, ScanLayer } from "./types.js";
import type { ScanStatus } from "./severity.js";

const SEVERITY_ORDER: Record<string, number> = {
  block: 3,
  warn: 2,
  info: 1,
};

const LAYER_DISPLAY: Record<ScanLayer, string> = {
  correctness: "Correctness",
  security: "Security",
  greenops: "GreenOps",
};

const LAYERS: ScanLayer[] = ["correctness", "security", "greenops"];

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function countBySeverity(findings: Finding[], layer: ScanLayer): string {
  const layerFindings = findings.filter((f) => f.layer === layer);
  if (layerFindings.length === 0) return "—";
  const counts: Record<string, number> = {};
  for (const f of layerFindings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }
  return (["block", "warn", "info"] as const)
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s}`)
    .join(", ");
}

function layerStatus(findings: Finding[], layer: ScanLayer): string {
  const layerFindings = findings.filter((f) => f.layer === layer);
  if (layerFindings.length === 0) return "✅ Clean";
  if (layerFindings.some((f) => f.severity === "block")) return "🚫 Blocked";
  if (layerFindings.some((f) => f.severity === "warn")) return "⚠️ Warning";
  return "ℹ️ Info";
}

function renderFinding(finding: Finding): string {
  const severityLabel = finding.severity.toUpperCase();
  const lines: string[] = [];
  lines.push(
    `<details><summary><strong>${finding.title}</strong> — <code>${finding.file}:${finding.line}</code> [${severityLabel}]</summary>`
  );
  lines.push("");
  lines.push(`**Layer:** ${LAYER_DISPLAY[finding.layer]}  `);
  lines.push(`**Scanner:** ${finding.scanner}  `);
  lines.push(`**Confidence:** ${finding.confidence}  `);
  if (finding.cwe) {
    lines.push(`**CWE:** ${finding.cwe}  `);
  }
  if (finding.owasp) {
    lines.push(`**OWASP:** ${finding.owasp}  `);
  }
  lines.push("");
  lines.push(`**Explanation:** ${finding.explanation}`);
  lines.push("");
  lines.push(`**Suggestion:** ${finding.suggestion}`);
  lines.push("");
  lines.push("</details>");
  return lines.join("\n");
}

const RCS_BADGE_LABEL: Record<string, string> = {
  green: "🟢 improving",
  yellow: "🟡 stable",
  red: "🔴 degrading",
};

/**
 * Renders a GitHub PR comment in Markdown with the "Lens View" UX.
 */
export function renderComment(
  findings: Finding[],
  status: ScanStatus,
  durationMs: number,
  rcs?: { delta: number; badge: string }
): string {
  const sortedFindings = [...findings].sort(
    (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
  );

  const resultLine =
    status === "block"
      ? "🚫 **Merge blocked** — one or more blocking issues were found."
      : "✅ **All checks passed** — no blocking issues found.";

  const tableRows = LAYERS.map((layer) => {
    const displayName = LAYER_DISPLAY[layer];
    const counts = countBySeverity(findings, layer);
    const layerStat = layerStatus(findings, layer);
    return `| ${displayName} | ${counts} | ${layerStat} |`;
  });

  const parts: string[] = [
    "## Pocolente QA — PR Scan Results",
    "",
    "| Layer | Findings | Status |",
    "|-------|----------|--------|",
    ...tableRows,
    "",
    resultLine,
    "",
    "---",
    "",
  ];

  if (sortedFindings.length > 0) {
    for (const finding of sortedFindings) {
      parts.push(renderFinding(finding));
      parts.push("");
    }
  }

  if (rcs) {
    const badgeLabel = RCS_BADGE_LABEL[rcs.badge] ?? rcs.badge;
    const deltaStr = rcs.delta > 0 ? `+${rcs.delta}` : `${rcs.delta}`;
    parts.push(`<sub>RCS: ${badgeLabel} (${deltaStr}) · Scanned in ${formatDuration(durationMs)}</sub>`);
  } else {
    parts.push(`<sub>Scanned in ${formatDuration(durationMs)}</sub>`);
  }

  return parts.join("\n");
}
