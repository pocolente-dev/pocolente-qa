import { describe, it, expect } from "vitest";
import type { Finding, Severity, ScanLayer } from "../src/types.js";
import type { ScanStatus } from "../src/severity.js";
import { renderComment } from "../src/renderer.js";

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

describe("renderComment", () => {
  it("renders the Pocolente QA header", () => {
    const result = renderComment([], "pass", 1000);
    expect(result).toContain("Pocolente QA");
  });

  it("shows All checks passed when status is pass", () => {
    const result = renderComment([], "pass", 1000);
    expect(result).toContain("All checks passed");
  });

  it("shows Merge blocked when status is block", () => {
    const findings = [makeFinding({ severity: "block" })];
    const result = renderComment(findings, "block", 1000);
    expect(result).toContain("Merge blocked");
  });

  it("renders summary table with layer names", () => {
    const result = renderComment([], "pass", 1000);
    expect(result).toContain("Correctness");
    expect(result).toContain("Security");
    expect(result).toContain("GreenOps");
  });

  it("shows finding counts per layer", () => {
    const findings = [
      makeFinding({ layer: "correctness", severity: "block" }),
      makeFinding({ layer: "security", severity: "warn" }),
    ];
    const result = renderComment(findings, "block", 1000);
    expect(result).toContain("1 block");
    expect(result).toContain("1 warn");
  });

  it("renders HTML details tags for each finding", () => {
    const findings = [makeFinding({ title: "My Finding", file: "src/foo.ts", line: "42" })];
    const result = renderComment(findings, "pass", 1000);
    expect(result).toContain("<details>");
    expect(result).toContain("</details>");
    expect(result).toContain("My Finding");
    expect(result).toContain("src/foo.ts:42");
  });

  it("shows CWE when present in finding", () => {
    const findings = [makeFinding({ cwe: "CWE-89" })];
    const result = renderComment(findings, "pass", 1000);
    expect(result).toContain("CWE-89");
  });

  it("does not show CWE when absent", () => {
    const findings = [makeFinding({ cwe: null })];
    const result = renderComment(findings, "pass", 1000);
    expect(result).not.toContain("CWE-");
  });

  it("orders findings by severity: block first, then warn, then info", () => {
    const findings = [
      makeFinding({ severity: "info", title: "Info Finding" }),
      makeFinding({ severity: "block", title: "Block Finding" }),
      makeFinding({ severity: "warn", title: "Warn Finding" }),
    ];
    const result = renderComment(findings, "block", 1000);
    const blockPos = result.indexOf("Block Finding");
    const warnPos = result.indexOf("Warn Finding");
    const infoPos = result.indexOf("Info Finding");
    expect(blockPos).toBeLessThan(warnPos);
    expect(warnPos).toBeLessThan(infoPos);
  });

  it("formats duration in seconds with one decimal place", () => {
    const result = renderComment([], "pass", 5432);
    expect(result).toContain("5.4s");
  });

  it("formats duration less than 1 second correctly", () => {
    const result = renderComment([], "pass", 432);
    expect(result).toContain("0.4s");
  });

  it("renders finding severity label in summary", () => {
    const findings = [makeFinding({ severity: "block" })];
    const result = renderComment(findings, "block", 1000);
    expect(result).toContain("BLOCK");
  });

  it("includes explanation and suggestion in details", () => {
    const findings = [
      makeFinding({ explanation: "This is bad", suggestion: "Do this instead" }),
    ];
    const result = renderComment(findings, "pass", 1000);
    expect(result).toContain("This is bad");
    expect(result).toContain("Do this instead");
  });

  it("includes OWASP when present", () => {
    const findings = [makeFinding({ owasp: "A01:2021" })];
    const result = renderComment(findings, "pass", 1000);
    expect(result).toContain("A01:2021");
  });

  it("includes scanner and confidence in details", () => {
    const findings = [makeFinding({ scanner: "my-scanner", confidence: 0.75 })];
    const result = renderComment(findings, "pass", 1000);
    expect(result).toContain("my-scanner");
    expect(result).toContain("0.75");
  });

  it("renders footer with scan duration", () => {
    const result = renderComment([], "pass", 2000);
    expect(result).toContain("Scanned in");
    expect(result).toContain("2.0s");
  });

  it("handles empty findings with pass status", () => {
    const result = renderComment([], "pass", 100);
    expect(result).toContain("Pocolente QA");
    expect(result).toContain("All checks passed");
    expect(result).not.toContain("<details>");
  });
});
