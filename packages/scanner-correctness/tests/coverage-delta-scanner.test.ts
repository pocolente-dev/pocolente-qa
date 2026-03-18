import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CoverageDeltaScanner } from "../src/coverage-delta-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext } from "@pocolente/core";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;
const scanner = new CoverageDeltaScanner();

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "pocolente-cov-"));
  await mkdir(join(tempDir, "coverage"), { recursive: true });
});
afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("CoverageDeltaScanner", () => {
  it("has correct metadata", () => {
    expect(scanner.id).toBe("coverage-delta-scanner");
    expect(scanner.layer).toBe("correctness");
  });

  it("reports finding when coverage decreases beyond threshold", async () => {
    // Base: 90% coverage, PR: 70% coverage (20% decrease > 2% threshold)
    const baseLcov = "SF:src/app.ts\nLF:100\nLH:90\nend_of_record\n";
    const prLcov = "SF:src/app.ts\nLF:100\nLH:70\nend_of_record\n";
    await writeFile(join(tempDir, "coverage/base-lcov.info"), baseLcov);
    await writeFile(join(tempDir, "coverage/pr-lcov.info"), prLcov);

    const ctx: ScanContext = {
      diff: [], config: parseConfig(undefined),
      repoRoot: tempDir, baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.severity === "warn" && f.title.toLowerCase().includes("coverage"))).toBe(true);
  });

  it("does not flag when coverage is stable", async () => {
    const lcov = "SF:src/app.ts\nLF:100\nLH:90\nend_of_record\n";
    await writeFile(join(tempDir, "coverage/base-lcov.info"), lcov);
    await writeFile(join(tempDir, "coverage/pr-lcov.info"), lcov);

    const ctx: ScanContext = {
      diff: [], config: parseConfig(undefined),
      repoRoot: tempDir, baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings.filter(f => f.severity === "warn")).toHaveLength(0);
  });

  it("returns info finding when coverage files don't exist", async () => {
    const ctx: ScanContext = {
      diff: [], config: parseConfig(undefined),
      repoRoot: tempDir, baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("info");
    expect(findings[0].title.toLowerCase()).toContain("not found");
  });

  it("respects coverage.enabled config", async () => {
    const config = parseConfig({ correctness: { coverage: { enabled: false } } });
    const ctx: ScanContext = {
      diff: [], config, repoRoot: tempDir, baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
