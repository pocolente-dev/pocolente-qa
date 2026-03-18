import { describe, it, expect } from "vitest";
import { pathTraversalRule } from "../../src/owasp-rules/path-traversal.js";
import type { DiffFile } from "@pocolente/core";

const dummyFile: DiffFile = { path: "test.ts", added: [], removed: [], patch: "" };

describe("pathTraversalRule", () => {
  it("detects fs.readFile with req.params user input", () => {
    const line = "fs.readFile(req.params.path, callback);";
    const match = pathTraversalRule.testLine(line, 1, dummyFile);
    expect(match).not.toBeNull();
    expect(match!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects fs.readFileSync with userInput variable", () => {
    const line = "const data = fs.readFileSync(req.query.filename);";
    expect(pathTraversalRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("detects path.join with req.query.file user input", () => {
    const line = "const fullPath = path.join(baseDir, req.query.file);";
    expect(pathTraversalRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("does NOT flag fs.readFile with a literal path", () => {
    const line = 'fs.readFile("./config.json", callback);';
    expect(pathTraversalRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("does NOT flag path.join with __dirname and literal", () => {
    const line = 'const p = path.join(__dirname, "static");';
    expect(pathTraversalRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("has correct CWE and OWASP mapping", () => {
    expect(pathTraversalRule.cwe).toBe("CWE-22");
    expect(pathTraversalRule.owaspCategory).toBe("A01:2021-Broken-Access-Control");
  });
});
