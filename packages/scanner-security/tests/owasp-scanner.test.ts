import { describe, it, expect } from "vitest";
import { OwaspScanner } from "../src/owasp-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";
import type { OwaspRule, RuleMatch } from "../src/owasp-rules/types.js";

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
  return { path, added, removed: [], patch: added.map((l) => `+${l}`).join("\n") };
}

const mockRule: OwaspRule = {
  id: "test-rule",
  name: "Test Rule",
  cwe: "CWE-000",
  owaspCategory: "A00:2021-Test",
  description: "A test rule",
  testLine(line: string): RuleMatch | null {
    if (line.includes("VULNERABLE")) {
      return { line: 0, matchedText: "VULNERABLE", confidence: 0.95, suggestion: "Fix it" };
    }
    return null;
  },
};

describe("OwaspScanner", () => {
  it("has correct metadata", () => {
    const scanner = new OwaspScanner([mockRule]);
    expect(scanner.id).toBe("owasp-scanner");
    expect(scanner.layer).toBe("security");
  });

  it("detects vulnerabilities using rules", async () => {
    const scanner = new OwaspScanner([mockRule]);
    const ctx = makeContext([makeDiff("src/app.ts", ['const x = "VULNERABLE";'])]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].cwe).toBe("CWE-000");
    expect(findings[0].owasp).toBe("A00:2021-Test");
    expect(findings[0].file).toBe("src/app.ts");
  });

  it("returns empty for clean code", async () => {
    const scanner = new OwaspScanner([mockRule]);
    const ctx = makeContext([makeDiff("src/app.ts", ["const x = 42;"])]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("only scans TS/JS files", async () => {
    const scanner = new OwaspScanner([mockRule]);
    const ctx = makeContext([
      makeDiff("readme.md", ['VULNERABLE']),
      makeDiff("src/app.ts", ['VULNERABLE']),
    ]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe("src/app.ts");
  });

  it("respects owasp.enabled config", async () => {
    const config = parseConfig({ security: { owasp: { enabled: false } } });
    const scanner = new OwaspScanner([mockRule]);
    const ctx: ScanContext = {
      diff: [makeDiff("src/app.ts", ['VULNERABLE'])],
      config, repoRoot: "/tmp", baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
