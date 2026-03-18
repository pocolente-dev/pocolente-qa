import { describe, it, expect } from "vitest";
import { GenerationQualityScanner } from "../src/generation-quality-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";

function makeContext(diffs: DiffFile[]): ScanContext {
  return { diff: diffs, config: parseConfig(undefined), repoRoot: "/tmp/test", baseBranch: "main", prBranch: "feature" };
}
function makeDiff(path: string, added: string[]): DiffFile {
  return { path, added, removed: [], patch: "" };
}

const scanner = new GenerationQualityScanner();

describe("GenerationQualityScanner", () => {
  it("has correct metadata", () => {
    expect(scanner.id).toBe("generation-quality-scanner");
    expect(scanner.layer).toBe("correctness");
  });

  it("detects empty catch blocks", async () => {
    const ctx = makeContext([makeDiff("src/app.ts", [
      "try {", "  doSomething();", "} catch (e) {}", "",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("empty catch"))).toBe(true);
  });

  it("detects console.log in production code", async () => {
    const ctx = makeContext([makeDiff("src/service.ts", [
      'console.log("debug value:", data);',
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("console"))).toBe(true);
  });

  it("does NOT flag console.log in test files", async () => {
    const ctx = makeContext([makeDiff("src/service.test.ts", [
      'console.log("test output");',
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.filter(f => f.title.toLowerCase().includes("console"))).toHaveLength(0);
  });

  it("detects TODO without issue tracker link", async () => {
    const ctx = makeContext([makeDiff("src/app.ts", [
      "// TODO: fix this later",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("todo"))).toBe(true);
  });

  it("does NOT flag TODO with issue link", async () => {
    const ctx = makeContext([makeDiff("src/app.ts", [
      "// TODO(#123): fix this later",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.filter(f => f.title.toLowerCase().includes("todo"))).toHaveLength(0);
  });

  it("only scans TS/JS files", async () => {
    const ctx = makeContext([makeDiff("readme.md", [
      "console.log('example');",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("respects generationQuality.enabled config", async () => {
    const config = parseConfig({ correctness: { generation_quality: { enabled: false } } });
    const ctx: ScanContext = {
      diff: [makeDiff("src/app.ts", ["console.log('x');"])],
      config, repoRoot: "/tmp", baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
