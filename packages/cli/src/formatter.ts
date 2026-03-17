import type { Finding, ScanStatus } from "@pocolente/core";

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function severityColor(severity: Finding["severity"]): string {
  switch (severity) {
    case "block": return RED;
    case "warn": return YELLOW;
    case "info": return DIM;
  }
}

export function formatFindings(
  findings: Finding[],
  status: ScanStatus,
  durationMs: number
): string {
  const lines: string[] = [];

  lines.push(`${BOLD}Pocolente QA — Scan Results${RESET}`);
  lines.push("");

  for (const finding of findings) {
    const color = severityColor(finding.severity);
    const label = finding.severity.toUpperCase();
    lines.push(`${color}${BOLD}[${label}] ${finding.title}${RESET}`);
    lines.push(`  ${CYAN}${finding.file}:${finding.line}${RESET}`);
    lines.push(`  ${DIM}${finding.explanation}${RESET}`);
    lines.push("");
  }

  const statusLabel = status === "block" ? `${RED}${BOLD}BLOCKED${RESET}` : `${GREEN}${BOLD}PASS${RESET}`;
  const durationSec = (durationMs / 1000).toFixed(1);
  lines.push(
    `Status: ${statusLabel} | ${findings.length} finding(s) | ${durationSec}s`
  );

  return lines.join("\n");
}
