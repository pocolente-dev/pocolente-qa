import { describe, it, expect } from "vitest";
import { insecureDeserializationRule } from "../../src/owasp-rules/insecure-deserialization.js";
import type { DiffFile } from "@pocolente/core";

const dummyFile: DiffFile = { path: "test.ts", added: [], removed: [], patch: "" };

describe("insecureDeserializationRule", () => {
  it("detects yaml.load without schema parameter", () => {
    const line = "const data = yaml.load(input);";
    const match = insecureDeserializationRule.testLine(line, 1, dummyFile);
    expect(match).not.toBeNull();
    expect(match!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects require of node-serialize", () => {
    const line = 'const serialize = require("node-serialize");';
    expect(insecureDeserializationRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("detects import from node-serialize", () => {
    const line = 'import serialize from "node-serialize";';
    expect(insecureDeserializationRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("does NOT flag yaml.load with schema parameter", () => {
    const line = "const data = yaml.load(input, { schema: yaml.SAFE_SCHEMA });";
    expect(insecureDeserializationRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("does NOT flag JSON.parse", () => {
    const line = "const obj = JSON.parse(data);";
    expect(insecureDeserializationRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("has correct CWE and OWASP mapping", () => {
    expect(insecureDeserializationRule.cwe).toBe("CWE-502");
    expect(insecureDeserializationRule.owaspCategory).toBe("A08:2021-Software-and-Data-Integrity-Failures");
  });
});
