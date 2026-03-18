// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileCoverage {
  file: string;
  totalLines: number;
  coveredLines: number;
}

export interface CoverageDelta {
  overallDelta: number;
  perFile: { file: string; delta: number }[];
}

// ─── LCOV Parser ──────────────────────────────────────────────────────────────

/**
 * Parses an LCOV-format coverage report string into an array of FileCoverage.
 *
 * LCOV records use the following directives:
 *   SF:<path>        — source file
 *   LF:<n>           — total lines found
 *   LH:<n>           — lines hit (covered)
 *   end_of_record    — end of current file record
 */
export function parseLcov(content: string): FileCoverage[] {
  if (!content.trim()) return [];

  const results: FileCoverage[] = [];
  const lines = content.split("\n");

  let currentFile: string | null = null;
  let totalLines = 0;
  let coveredLines = 0;

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith("SF:")) {
      currentFile = line.slice(3);
      totalLines = 0;
      coveredLines = 0;
    } else if (line.startsWith("LF:")) {
      const n = parseInt(line.slice(3), 10);
      totalLines = isNaN(n) ? 0 : n;
    } else if (line.startsWith("LH:")) {
      const n = parseInt(line.slice(3), 10);
      coveredLines = isNaN(n) ? 0 : n;
    } else if (line === "end_of_record") {
      if (currentFile !== null) {
        results.push({ file: currentFile, totalLines, coveredLines });
        currentFile = null;
        totalLines = 0;
        coveredLines = 0;
      }
    }
  }

  return results;
}

// ─── Coverage Delta ───────────────────────────────────────────────────────────

function computePercent(reports: FileCoverage[]): number {
  const totalLines = reports.reduce((sum, r) => sum + r.totalLines, 0);
  const coveredLines = reports.reduce((sum, r) => sum + r.coveredLines, 0);
  if (totalLines === 0) return 0;
  return (coveredLines / totalLines) * 100;
}

function filePercent(f: FileCoverage): number {
  if (f.totalLines === 0) return 0;
  return (f.coveredLines / f.totalLines) * 100;
}

/**
 * Computes the coverage delta between a base report and a PR report.
 *
 * - overallDelta: difference in overall coverage percentage (PR - base)
 * - perFile: per-file deltas for files present in both reports
 */
export function computeCoverageDelta(
  base: FileCoverage[],
  pr: FileCoverage[]
): CoverageDelta {
  if (base.length === 0 && pr.length === 0) {
    return { overallDelta: 0, perFile: [] };
  }

  const overallBase = computePercent(base);
  const overallPr = computePercent(pr);
  const overallDelta = overallPr - overallBase;

  // Build lookup maps by file path
  const baseMap = new Map<string, FileCoverage>(base.map((f) => [f.file, f]));
  const prMap = new Map<string, FileCoverage>(pr.map((f) => [f.file, f]));

  const perFile: { file: string; delta: number }[] = [];

  // Files present in both reports
  for (const [file, baseEntry] of baseMap) {
    const prEntry = prMap.get(file);
    if (prEntry) {
      const delta = filePercent(prEntry) - filePercent(baseEntry);
      perFile.push({ file, delta });
    }
  }

  // Files only in PR (new files — base coverage is 0%)
  for (const [file, prEntry] of prMap) {
    if (!baseMap.has(file)) {
      perFile.push({ file, delta: filePercent(prEntry) });
    }
  }

  return { overallDelta, perFile };
}
