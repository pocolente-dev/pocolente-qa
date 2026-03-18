import { describe, it, expect } from "vitest";
import { ResourceScanner } from "../src/resource-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";

function makeContext(diffs: DiffFile[]): ScanContext {
  return { diff: diffs, config: parseConfig(undefined), repoRoot: "/tmp", baseBranch: "main", prBranch: "feature" };
}
function makeDiff(path: string, added: string[]): DiffFile {
  return { path, added, removed: [], patch: "" };
}

const scanner = new ResourceScanner();

describe("ResourceScanner", () => {
  it("has correct metadata", () => {
    expect(scanner.id).toBe("resource-scanner");
    expect(scanner.layer).toBe("greenops");
  });

  it("detects readFileSync in async function", async () => {
    const ctx = makeContext([makeDiff("src/handler.ts", [
      "async function handleRequest(req: Request) {",
      '  const data = fs.readFileSync("./config.json");',
      "  return data;",
      "}",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("sync"))).toBe(true);
  });

  it("detects writeFileSync in async context", async () => {
    const ctx = makeContext([makeDiff("src/handler.ts", [
      "export async function save() {",
      '  fs.writeFileSync("./output.json", data);',
      "}",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("sync"))).toBe(true);
  });

  it("does NOT flag sync file reads in non-async context", async () => {
    const ctx = makeContext([makeDiff("src/config.ts", [
      "function loadConfig() {",
      '  return fs.readFileSync("./config.json");',
      "}",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.filter(f => f.title.toLowerCase().includes("sync"))).toHaveLength(0);
  });

  it("detects unbounded array push in while(true)", async () => {
    const ctx = makeContext([makeDiff("src/collector.ts", [
      "const items: string[] = [];",
      "while (true) {",
      "  items.push(getNext());",
      "}",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("unbounded"))).toBe(true);
  });

  it("only scans TS/JS files", async () => {
    const ctx = makeContext([makeDiff("readme.md", [
      "async function x() { fs.readFileSync('y'); }",
    ])]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("respects greenops.resources.enabled config", async () => {
    const config = parseConfig({ greenops: { resources: { enabled: false } } });
    const ctx: ScanContext = {
      diff: [makeDiff("src/app.ts", ["async function x() { fs.readFileSync('y'); }"])],
      config, repoRoot: "/tmp", baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
