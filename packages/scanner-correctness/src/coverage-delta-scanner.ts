import { readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import type { Scanner, ScanContext, Finding } from "@pocolente/core";
import { parseLcov, computeCoverageDelta, type FileCoverage } from "./coverage-parser.js";

// ─── Default paths (used when config paths are empty) ─────────────────────────

const DEFAULT_BASE_PATH = "coverage/base-lcov.info";
const DEFAULT_PR_PATH = "coverage/pr-lcov.info";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveCoveragePath(repoRoot: string, configPath: string, fallback: string): string {
  const p = configPath.trim() || fallback;
  return isAbsolute(p) ? p : join(repoRoot, p);
}

async function readCoverageFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseReport(content: string, format: string): FileCoverage[] {
  // Currently only LCOV is supported; istanbul-json and cobertura are stubs
  switch (format) {
    case "lcov":
    default:
      return parseLcov(content);
  }
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

export class CoverageDeltaScanner implements Scanner {
  id = "coverage-delta-scanner";
  name = "Test Coverage Delta Scanner";
  layer = "correctness" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    const cfg = context.config.correctness.coverage;

    if (!cfg.enabled) {
      return [];
    }

    const basePath = resolveCoveragePath(context.repoRoot, cfg.baseCoveragePath, DEFAULT_BASE_PATH);
    const prPath = resolveCoveragePath(context.repoRoot, cfg.prCoveragePath, DEFAULT_PR_PATH);

    const [baseContent, prContent] = await Promise.all([
      readCoverageFile(basePath),
      readCoverageFile(prPath),
    ]);

    // If either file is missing, report an informational finding
    if (baseContent === null || prContent === null) {
      return [
        {
          layer: "correctness",
          scanner: this.id,
          severity: "info",
          confidence: 1.0,
          file: "",
          line: "",
          title: "Coverage reports not found, skipping",
          explanation:
            "One or both coverage report files could not be read. " +
            `Expected base at "${basePath}" and PR at "${prPath}".`,
          suggestion:
            "Ensure coverage reports are generated before running the scanner. " +
            "Configure correctness.coverage.baseCoveragePath and prCoveragePath if needed.",
          cwe: null,
          owasp: null,
          estimatedEnergyImpact: null,
          rcsDelta: null,
        },
      ];
    }

    const format = cfg.coverageFormat || "lcov";
    const baseReport = parseReport(baseContent, format);
    const prReport = parseReport(prContent, format);

    const delta = computeCoverageDelta(baseReport, prReport);
    const findings: Finding[] = [];

    // Flag when coverage decreases beyond the configured threshold
    if (delta.overallDelta < 0 && Math.abs(delta.overallDelta) > cfg.maxDecreasePercent) {
      const decrease = Math.abs(delta.overallDelta).toFixed(2);
      findings.push({
        layer: "correctness",
        scanner: this.id,
        severity: "warn",
        confidence: 1.0,
        file: "",
        line: "",
        title: `Coverage decreased by ${decrease}%`,
        explanation:
          `Overall test coverage dropped by ${decrease}%, which exceeds the allowed ` +
          `maximum decrease of ${cfg.maxDecreasePercent}%.`,
        suggestion:
          "Add or fix tests to restore coverage before merging this PR.",
        cwe: null,
        owasp: null,
        estimatedEnergyImpact: null,
        rcsDelta: null,
      });
    }

    return findings;
  }
}
