import { describe, it, expect } from "vitest";
import { formatFindings } from "../src/formatter.js";
import type { Finding } from "@pocolente/core";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    layer: "security", scanner: "test", severity: "block", confidence: 1.0,
    file: "src/config.ts", line: "12", title: "Test finding",
    explanation: "Test explanation", suggestion: "Test suggestion",
    cwe: null, owasp: null, estimatedEnergyImpact: null, rcsDelta: null,
    ...overrides,
  };
}

describe("formatFindings", () => {
  it("shows BLOCKED for block status", () => {
    const output = formatFindings([makeFinding()], "block", 1000);
    expect(output).toContain("BLOCKED");
  });

  it("shows PASS for pass status", () => {
    const output = formatFindings([], "pass", 500);
    expect(output).toContain("PASS");
  });

  it("shows finding title and file location", () => {
    const output = formatFindings([makeFinding({ title: "AWS key found" })], "block", 1000);
    expect(output).toContain("AWS key found");
    expect(output).toContain("src/config.ts:12");
  });

  it("shows duration in seconds", () => {
    const output = formatFindings([], "pass", 5432);
    expect(output).toContain("5.4s");
  });
});
