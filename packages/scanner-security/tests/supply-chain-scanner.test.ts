import { describe, it, expect } from "vitest";
import { SupplyChainScanner } from "../src/supply-chain-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";

function makeContext(diffs: DiffFile[]): ScanContext {
  return {
    diff: diffs, config: parseConfig(undefined),
    repoRoot: "/tmp/test", baseBranch: "main", prBranch: "feature",
  };
}

describe("SupplyChainScanner", () => {
  const scanner = new SupplyChainScanner();

  it("has correct metadata", () => {
    expect(scanner.id).toBe("supply-chain-scanner");
    expect(scanner.layer).toBe("security");
  });

  it("detects typosquatting in package-lock.json", async () => {
    const ctx = makeContext([{
      path: "package-lock.json",
      added: ['    "lodas": {', '      "version": "1.0.0",'],
      removed: [],
      patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.title.toLowerCase().includes("typosquatting"))).toBe(true);
  });

  it("returns empty for legitimate packages", async () => {
    const ctx = makeContext([{
      path: "package-lock.json",
      added: ['    "lodash": {', '      "version": "4.17.21",'],
      removed: [],
      patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    // Only typosquatting check runs synchronously; OSV may or may not return results
    const typoFindings = findings.filter(f => f.title.toLowerCase().includes("typosquatting"));
    expect(typoFindings).toHaveLength(0);
  });

  it("only processes lockfile diffs", async () => {
    const ctx = makeContext([{
      path: "src/app.ts",
      added: ['const lodas = require("lodas");'],
      removed: [],
      patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("respects supplyChain.enabled config", async () => {
    const config = parseConfig({ security: { supply_chain: { enabled: false } } });
    const ctx: ScanContext = {
      diff: [{ path: "package-lock.json", added: ['    "lodas": {', '      "version": "1.0.0",'], removed: [], patch: "" }],
      config, repoRoot: "/tmp", baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
