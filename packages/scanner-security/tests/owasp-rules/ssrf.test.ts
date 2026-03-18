import { describe, it, expect } from "vitest";
import { ssrfRule } from "../../src/owasp-rules/ssrf.js";
import type { DiffFile } from "@pocolente/core";

const dummyFile: DiffFile = { path: "test.ts", added: [], removed: [], patch: "" };

describe("ssrfRule", () => {
  it("detects fetch with a variable URL argument", () => {
    const line = "const res = await fetch(userUrl);";
    const match = ssrfRule.testLine(line, 1, dummyFile);
    expect(match).not.toBeNull();
    expect(match!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects axios.get with req.body.url", () => {
    const line = "const res = await axios.get(req.body.url);";
    expect(ssrfRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("detects http.get with a variable URL", () => {
    const line = "http.get(url, callback);";
    expect(ssrfRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("does NOT flag fetch with a literal URL", () => {
    const line = 'const res = await fetch("https://api.example.com");';
    expect(ssrfRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("does NOT flag fetch with literal string concatenation", () => {
    const line = 'const res = await fetch("https://api.example.com" + "/users");';
    expect(ssrfRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("has correct CWE and OWASP mapping", () => {
    expect(ssrfRule.cwe).toBe("CWE-918");
    expect(ssrfRule.owaspCategory).toBe("A10:2021-SSRF");
  });
});
