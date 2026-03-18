import { describe, it, expect } from "vitest";
import { ComplexityScanner } from "../src/complexity-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";

function makeContext(diffs: DiffFile[]): ScanContext {
  return { diff: diffs, config: parseConfig(undefined), repoRoot: "/tmp", baseBranch: "main", prBranch: "feature" };
}
function makeDiff(path: string, added: string[]): DiffFile {
  return { path, added, removed: [], patch: "" };
}

const scanner = new ComplexityScanner();

describe("ComplexityScanner", () => {
  it("has correct metadata", () => {
    expect(scanner.id).toBe("complexity-scanner");
    expect(scanner.layer).toBe("greenops");
  });

  it("detects nested forEach loops", async () => {
    const ctx = makeContext([makeDiff("src/app.ts", [
      "users.forEach(user => {",
      "  user.orders.forEach(order => {",
      "    processOrder(order);",
      "  });",
      "});",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("nested"))).toBe(true);
    expect(findings[0].estimatedEnergyImpact).toBe("high");
  });

  it("detects nested for loops", async () => {
    const ctx = makeContext([makeDiff("src/app.ts", [
      "for (const item of items) {",
      "  for (const sub of item.children) {",
      "    process(sub);",
      "  }",
      "}",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("nested"))).toBe(true);
  });

  it("detects N+1 query pattern", async () => {
    const ctx = makeContext([makeDiff("src/service.ts", [
      "for (const user of users) {",
      "  const profile = await db.query(`SELECT * FROM profiles WHERE user_id = ${user.id}`);",
      "}",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("n+1"))).toBe(true);
  });

  it("detects quadratic string concatenation", async () => {
    const ctx = makeContext([makeDiff("src/utils.ts", [
      "let result = '';",
      "for (const item of items) {",
      "  result += item.toString();",
      "}",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("string"))).toBe(true);
  });

  it("does NOT flag single-level loops", async () => {
    const ctx = makeContext([makeDiff("src/app.ts", [
      "items.forEach(item => process(item));",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.filter(f => f.title.toLowerCase().includes("nested"))).toHaveLength(0);
  });

  it("only scans TS/JS files", async () => {
    const ctx = makeContext([makeDiff("readme.md", [
      "users.forEach(u => { u.orders.forEach(o => {}); });",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("respects greenops.complexity.enabled config", async () => {
    const config = parseConfig({ greenops: { complexity: { enabled: false } } });
    const ctx: ScanContext = {
      diff: [makeDiff("src/app.ts", ["for (a of b) { for (c of d) { } }"])],
      config, repoRoot: "/tmp", baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
