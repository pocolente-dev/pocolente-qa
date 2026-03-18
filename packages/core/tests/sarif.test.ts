import { describe, it, expect } from "vitest";
import { toSarif } from "../src/sarif.js";
import type { Finding } from "../src/types.js";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    layer: "security", scanner: "secrets-scanner", severity: "block",
    confidence: 0.97, file: "src/config.ts", line: "12",
    title: "AWS key detected", explanation: "Found AKIA key",
    suggestion: "Use environment variables", cwe: "CWE-798",
    owasp: "A07:2021", estimatedEnergyImpact: null, rcsDelta: null,
    ...overrides,
  };
}

describe("toSarif", () => {
  it("produces valid SARIF structure", () => {
    const sarif = toSarif([makeFinding()], "pocolente-qa", "0.0.1");
    expect(sarif.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
  });

  it("maps findings to SARIF results", () => {
    const sarif = toSarif([makeFinding()], "pocolente-qa", "0.0.1");
    const results = sarif.runs[0].results;
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("secrets-scanner/CWE-798");
    expect(results[0].message.text).toBe("AWS key detected");
    expect(results[0].locations[0].physicalLocation.artifactLocation.uri).toBe("src/config.ts");
  });

  it("maps severity to SARIF level", () => {
    const sarif = toSarif([
      makeFinding({ severity: "block" }),
      makeFinding({ severity: "warn", file: "b.ts" }),
      makeFinding({ severity: "info", file: "c.ts" }),
    ], "test", "0.0.1");
    const results = sarif.runs[0].results;
    expect(results[0].level).toBe("error");
    expect(results[1].level).toBe("warning");
    expect(results[2].level).toBe("note");
  });

  it("includes tool information", () => {
    const sarif = toSarif([], "pocolente-qa", "1.2.3");
    const tool = sarif.runs[0].tool.driver;
    expect(tool.name).toBe("pocolente-qa");
    expect(tool.version).toBe("1.2.3");
  });

  it("handles findings without CWE", () => {
    const sarif = toSarif([makeFinding({ cwe: null })], "test", "0.0.1");
    expect(sarif.runs[0].results[0].ruleId).toBe("secrets-scanner");
  });

  it("includes line number in region", () => {
    const sarif = toSarif([makeFinding({ line: "42" })], "test", "0.0.1");
    expect(sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine).toBe(42);
  });
});
