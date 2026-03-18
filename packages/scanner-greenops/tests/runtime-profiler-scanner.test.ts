import { describe, it, expect } from "vitest";
import { RuntimeProfilerScanner } from "../src/runtime-profiler-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext } from "@pocolente/core";

const scanner = new RuntimeProfilerScanner();

function makeContext(configOverrides: Record<string, unknown> = {}): ScanContext {
  return {
    diff: [],
    config: parseConfig({ runtime_profiling: { enabled: true, test_command: 'node -e "console.log(42)"', ...configOverrides } }),
    repoRoot: "/tmp",
    baseBranch: "main",
    prBranch: "feature",
  };
}

describe("RuntimeProfilerScanner", () => {
  it("has correct metadata", () => {
    expect(scanner.id).toBe("runtime-profiler-scanner");
    expect(scanner.layer).toBe("greenops");
  });

  it("returns empty when runtime profiling is disabled", async () => {
    const ctx: ScanContext = {
      diff: [], config: parseConfig(undefined),
      repoRoot: "/tmp", baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("runs test command and reports metrics when enabled", async () => {
    const ctx = makeContext();
    const findings = await scanner.scan(ctx);
    // Should produce at least one info finding with metrics
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.title.toLowerCase().includes("runtime") || f.title.toLowerCase().includes("profil"))).toBe(true);
    expect(findings[0].layer).toBe("greenops");
  });

  it("handles failed test command gracefully", async () => {
    const ctx = makeContext({ test_command: 'node -e "process.exit(1)"' });
    const findings = await scanner.scan(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    // Should report but not crash
    expect(findings.some(f => f.explanation.includes("exit") || f.explanation.includes("fail"))).toBe(true);
  });
});
