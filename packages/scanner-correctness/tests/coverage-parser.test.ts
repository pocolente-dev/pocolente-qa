import { describe, it, expect } from "vitest";
import { parseLcov, computeCoverageDelta } from "../src/coverage-parser.js";

describe("parseLcov", () => {
  it("parses LCOV format with multiple files", () => {
    const content = [
      "SF:src/app.ts",
      "LF:100",
      "LH:85",
      "end_of_record",
      "SF:src/utils.ts",
      "LF:50",
      "LH:50",
      "end_of_record",
    ].join("\n");

    const result = parseLcov(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ file: "src/app.ts", totalLines: 100, coveredLines: 85 });
    expect(result[1]).toEqual({ file: "src/utils.ts", totalLines: 50, coveredLines: 50 });
  });

  it("returns empty for empty content", () => {
    expect(parseLcov("")).toHaveLength(0);
  });

  it("handles malformed records gracefully", () => {
    const content = "SF:src/app.ts\nend_of_record\n";
    const result = parseLcov(content);
    // Missing LF/LH — should skip or default to 0
    expect(result).toHaveLength(1);
    expect(result[0].totalLines).toBe(0);
  });
});

describe("computeCoverageDelta", () => {
  it("computes overall coverage delta", () => {
    const base = [
      { file: "src/app.ts", totalLines: 100, coveredLines: 90 },
      { file: "src/utils.ts", totalLines: 50, coveredLines: 50 },
    ];
    const pr = [
      { file: "src/app.ts", totalLines: 100, coveredLines: 80 },
      { file: "src/utils.ts", totalLines: 50, coveredLines: 50 },
    ];
    // Base: (90+50)/(100+50) = 93.3%, PR: (80+50)/(100+50) = 86.7%
    const delta = computeCoverageDelta(base, pr);
    expect(delta.overallDelta).toBeCloseTo(-6.67, 1);
  });

  it("computes per-file deltas", () => {
    const base = [{ file: "src/app.ts", totalLines: 100, coveredLines: 90 }];
    const pr = [{ file: "src/app.ts", totalLines: 100, coveredLines: 80 }];
    const delta = computeCoverageDelta(base, pr);
    expect(delta.perFile).toHaveLength(1);
    expect(delta.perFile[0].file).toBe("src/app.ts");
    expect(delta.perFile[0].delta).toBeCloseTo(-10, 1);
  });

  it("returns zero delta for identical reports", () => {
    const report = [{ file: "src/app.ts", totalLines: 100, coveredLines: 80 }];
    const delta = computeCoverageDelta(report, report);
    expect(delta.overallDelta).toBe(0);
  });

  it("handles empty reports", () => {
    const delta = computeCoverageDelta([], []);
    expect(delta.overallDelta).toBe(0);
  });
});
