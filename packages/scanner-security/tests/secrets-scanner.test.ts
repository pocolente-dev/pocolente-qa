import { describe, it, expect } from "vitest";
import type { DiffFile, ScanContext } from "@pocolente/core";
import { parseConfig } from "@pocolente/core";
import { SecretsScanner } from "../src/secrets-scanner.js";

function makeContext(diffs: DiffFile[]): ScanContext {
  return {
    diff: diffs,
    config: parseConfig(undefined),
    repoRoot: "/tmp/test",
    baseBranch: "main",
    prBranch: "feature",
  };
}

function makeDiff(path: string, added: string[]): DiffFile {
  return {
    path,
    added,
    removed: [],
    patch: added.map((l) => `+${l}`).join("\n"),
  };
}

describe("SecretsScanner", () => {
  const scanner = new SecretsScanner();

  it("has correct id and layer", () => {
    expect(scanner.id).toBe("secrets-scanner");
    expect(scanner.layer).toBe("security");
  });

  it("detects AWS key in added lines", async () => {
    const diff = makeDiff("src/config.ts", [
      'const key = "AKIAIOSFODNN7EXAMPLE";',
    ]);
    const ctx = makeContext([diff]);
    const findings = await scanner.scan(ctx);
    expect(findings.length).toBeGreaterThan(0);
    const finding = findings[0];
    expect(finding.severity).toBe("block");
    expect(finding.title).toMatch(/AWS/i);
    expect(finding.file).toBe("src/config.ts");
  });

  it("detects multiple secrets in a single file", async () => {
    const diff = makeDiff("src/secrets.ts", [
      'const key = "AKIAIOSFODNN7EXAMPLE";',
      'const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";',
    ]);
    const ctx = makeContext([diff]);
    const findings = await scanner.scan(ctx);
    expect(findings.length).toBe(2);
  });

  it("returns empty findings for clean code", async () => {
    const diff = makeDiff("src/clean.ts", [
      'const name = "hello world";',
      "function greet(name: string) { return `Hello, ${name}`; }",
    ]);
    const ctx = makeContext([diff]);
    const findings = await scanner.scan(ctx);
    expect(findings).toEqual([]);
  });

  it("respects allowlist", async () => {
    const config = parseConfig({
      security: {
        secrets: { allowlist: ["AKIAIOSFODNN7EXAMPLE"] },
      },
    });
    const diff = makeDiff("src/config.ts", [
      'const key = "AKIAIOSFODNN7EXAMPLE";',
    ]);
    const ctx: ScanContext = {
      diff: [diff],
      config,
      repoRoot: "/tmp/test",
      baseBranch: "main",
      prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings.length).toBe(0);
  });

  it("only scans added lines, not removed lines", async () => {
    const diff: DiffFile = {
      path: "src/old.ts",
      added: [],
      removed: ['const key = "AKIAIOSFODNN7EXAMPLE";'],
      patch: '-const key = "AKIAIOSFODNN7EXAMPLE";',
    };
    const ctx = makeContext([diff]);
    const findings = await scanner.scan(ctx);
    expect(findings.length).toBe(0);
  });

  it("detects high-entropy strings via entropy fallback", async () => {
    const ctx = makeContext([
      makeDiff("src/config.ts", [
        'const apiToken = "xK9mB2pL7wQ4vR8nF3jZ5cH1tY6uE0aGdS";',
      ]),
    ]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("High-entropy");
    expect(findings[0].confidence).toBeGreaterThanOrEqual(0.8);
    expect(findings[0].confidence).toBeLessThanOrEqual(0.85);
  });

  it("does not flag low-entropy strings", async () => {
    const ctx = makeContext([
      makeDiff("src/config.ts", [
        'const message = "This is a normal long string with low entropy value";',
      ]),
    ]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("prefers pattern match over entropy match on same line", async () => {
    const ctx = makeContext([
      makeDiff("src/config.ts", [
        'const key = "AKIAIOSFODNN7EXAMPLE";',
      ]),
    ]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("AWS");
  });
});
