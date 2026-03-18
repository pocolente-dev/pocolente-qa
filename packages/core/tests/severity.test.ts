import { describe, it, expect } from "vitest";
import type { Finding, Severity, ScanLayer } from "../src/types.js";
import { filterFindings, filterByConfidence, deduplicateFindings, computeStatus } from "../src/severity.js";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    layer: "correctness" as ScanLayer,
    scanner: "test-scanner",
    severity: "warn" as Severity,
    confidence: 0.9,
    file: "src/index.ts",
    line: "10",
    title: "Test finding",
    explanation: "This is an explanation",
    suggestion: "Fix it",
    cwe: null,
    owasp: null,
    estimatedEnergyImpact: null,
    rcsDelta: null,
    ...overrides,
  };
}

describe("filterFindings", () => {
  it("keeps findings at or above threshold", () => {
    const findings = [
      makeFinding({ severity: "block" }),
      makeFinding({ severity: "warn" }),
      makeFinding({ severity: "info" }),
    ];
    const result = filterFindings(findings, "warn");
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.severity)).toEqual(["block", "warn"]);
  });

  it("keeps all findings when threshold is info", () => {
    const findings = [
      makeFinding({ severity: "block" }),
      makeFinding({ severity: "warn" }),
      makeFinding({ severity: "info" }),
    ];
    const result = filterFindings(findings, "info");
    expect(result).toHaveLength(3);
  });

  it("keeps only block findings when threshold is block", () => {
    const findings = [
      makeFinding({ severity: "block" }),
      makeFinding({ severity: "warn" }),
      makeFinding({ severity: "info" }),
    ];
    const result = filterFindings(findings, "block");
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("block");
  });

  it("returns empty array when no findings meet threshold", () => {
    const findings = [makeFinding({ severity: "info" })];
    const result = filterFindings(findings, "block");
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(filterFindings([], "warn")).toHaveLength(0);
  });
});

describe("filterByConfidence", () => {
  it("removes findings below the confidence threshold", () => {
    const findings = [
      makeFinding({ confidence: 0.95 }),
      makeFinding({ confidence: 0.5, file: "b.ts" }),
      makeFinding({ confidence: 0.85, file: "c.ts" }),
    ];
    const result = filterByConfidence(findings, 0.85);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.confidence)).toEqual([0.95, 0.85]);
  });

  it("always keeps block-severity findings regardless of confidence", () => {
    const findings = [
      makeFinding({ severity: "block", confidence: 0.3 }),
      makeFinding({ severity: "warn", confidence: 0.3, file: "b.ts" }),
    ];
    const result = filterByConfidence(findings, 0.85);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("block");
  });

  it("keeps all findings when threshold is 0", () => {
    const findings = [
      makeFinding({ confidence: 0.1 }),
      makeFinding({ confidence: 0.01, file: "b.ts" }),
    ];
    expect(filterByConfidence(findings, 0)).toHaveLength(2);
  });

  it("returns empty for empty input", () => {
    expect(filterByConfidence([], 0.85)).toHaveLength(0);
  });
});

describe("deduplicateFindings", () => {
  it("removes duplicates by file:line:scanner composite key", () => {
    const findings = [
      makeFinding({ file: "a.ts", line: "5", scanner: "s1" }),
      makeFinding({ file: "a.ts", line: "5", scanner: "s1" }), // duplicate
      makeFinding({ file: "a.ts", line: "6", scanner: "s1" }), // different line
    ];
    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(2);
  });

  it("keeps findings with different scanners at same file:line", () => {
    const findings = [
      makeFinding({ file: "a.ts", line: "5", scanner: "s1" }),
      makeFinding({ file: "a.ts", line: "5", scanner: "s2" }),
    ];
    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(2);
  });

  it("keeps findings with different files at same line:scanner", () => {
    const findings = [
      makeFinding({ file: "a.ts", line: "5", scanner: "s1" }),
      makeFinding({ file: "b.ts", line: "5", scanner: "s1" }),
    ];
    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateFindings([])).toHaveLength(0);
  });

  it("returns single finding unchanged", () => {
    const findings = [makeFinding({ title: "Only one" })];
    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Only one");
  });
});

describe("computeStatus", () => {
  it("returns block when a finding equals blockOn threshold", () => {
    const findings = [makeFinding({ severity: "block" })];
    expect(computeStatus(findings, "block")).toBe("block");
  });

  it("returns block when a finding exceeds blockOn threshold", () => {
    const findings = [makeFinding({ severity: "block" })];
    expect(computeStatus(findings, "warn")).toBe("block");
  });

  it("returns pass when no findings meet blockOn threshold", () => {
    const findings = [makeFinding({ severity: "warn" })];
    expect(computeStatus(findings, "block")).toBe("pass");
  });

  it("returns pass when blockOn is none", () => {
    const findings = [makeFinding({ severity: "block" })];
    expect(computeStatus(findings, "none")).toBe("pass");
  });

  it("returns pass for empty findings", () => {
    expect(computeStatus([], "warn")).toBe("pass");
  });

  it("returns block when warn finding meets warn blockOn", () => {
    const findings = [makeFinding({ severity: "warn" })];
    expect(computeStatus(findings, "warn")).toBe("block");
  });
});
