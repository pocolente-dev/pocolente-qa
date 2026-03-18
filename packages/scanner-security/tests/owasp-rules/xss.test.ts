import { describe, it, expect } from "vitest";
import { xssRule } from "../../src/owasp-rules/xss.js";
import type { DiffFile } from "@pocolente/core";

const dummyFile: DiffFile = { path: "test.tsx", added: [], removed: [], patch: "" };

describe("xssRule", () => {
  it("detects dangerouslySetInnerHTML with variable", () => {
    const line = '<div dangerouslySetInnerHTML={{ __html: userContent }} />';
    expect(xssRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("does NOT flag dangerouslySetInnerHTML with string literal", () => {
    const line = '<div dangerouslySetInnerHTML={{ __html: "<b>bold</b>" }} />';
    expect(xssRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("detects innerHTML assignment with variable", () => {
    const line = 'element.innerHTML = userInput;';
    expect(xssRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("does NOT flag innerHTML with empty string", () => {
    const line = 'element.innerHTML = "";';
    expect(xssRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("detects v-html directive", () => {
    const line = '<div v-html="rawContent"></div>';
    expect(xssRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("does NOT flag textContent assignment", () => {
    const line = 'element.textContent = userInput;';
    expect(xssRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("has correct CWE and OWASP mapping", () => {
    expect(xssRule.cwe).toBe("CWE-79");
    expect(xssRule.owaspCategory).toBe("A03:2021-Injection");
  });
});
