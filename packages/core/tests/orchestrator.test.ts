import { describe, it, expect } from "vitest";
import type { Scanner, Finding, ScanContext, DiffFile } from "../src/index.js";
import { parseConfig } from "../src/index.js";
import { runScanners } from "../src/orchestrator.js";

function makeContext(): ScanContext {
  return {
    diff: [],
    config: parseConfig(undefined),
    repoRoot: "/tmp/repo",
    baseBranch: "main",
    prBranch: "feature/test",
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    layer: "correctness",
    scanner: "test-scanner",
    severity: "warn",
    confidence: 0.9,
    file: "src/index.ts",
    line: "10",
    title: "Test finding",
    explanation: "Explanation",
    suggestion: "Fix it",
    cwe: null,
    owasp: null,
    estimatedEnergyImpact: null,
    rcsDelta: null,
    ...overrides,
  };
}

describe("runScanners", () => {
  it("runs scanners in parallel and collects all results", async () => {
    const findingA = makeFinding({ title: "Finding A", scanner: "scanner-a" });
    const findingB = makeFinding({ title: "Finding B", scanner: "scanner-b" });

    const scannerA: Scanner = {
      id: "scanner-a",
      name: "Scanner A",
      layer: "correctness",
      scan: async () => [findingA],
    };

    const scannerB: Scanner = {
      id: "scanner-b",
      name: "Scanner B",
      layer: "security",
      scan: async () => [findingB],
    };

    const context = makeContext();
    const results = await runScanners([scannerA, scannerB], context);

    expect(results).toHaveLength(2);
    const resultA = results.find((r) => r.scannerId === "scanner-a");
    const resultB = results.find((r) => r.scannerId === "scanner-b");

    expect(resultA).toBeDefined();
    expect(resultA!.findings).toEqual([findingA]);
    expect(resultA!.layer).toBe("correctness");
    expect(resultA!.error).toBeNull();

    expect(resultB).toBeDefined();
    expect(resultB!.findings).toEqual([findingB]);
    expect(resultB!.layer).toBe("security");
    expect(resultB!.error).toBeNull();
  });

  it("catches scanner errors gracefully and continues other scanners", async () => {
    const errorMessage = "Something went wrong";

    const failingScanner: Scanner = {
      id: "failing-scanner",
      name: "Failing Scanner",
      layer: "security",
      scan: async () => {
        throw new Error(errorMessage);
      },
    };

    const goodFinding = makeFinding({ title: "Good finding", scanner: "good-scanner" });
    const goodScanner: Scanner = {
      id: "good-scanner",
      name: "Good Scanner",
      layer: "correctness",
      scan: async () => [goodFinding],
    };

    const context = makeContext();
    const results = await runScanners([failingScanner, goodScanner], context);

    expect(results).toHaveLength(2);

    const failResult = results.find((r) => r.scannerId === "failing-scanner");
    expect(failResult).toBeDefined();
    expect(failResult!.error).toBe(errorMessage);
    expect(failResult!.findings).toHaveLength(1);
    expect(failResult!.findings[0].severity).toBe("info");
    expect(failResult!.findings[0].title.toLowerCase()).toContain("failed");
    expect(failResult!.findings[0].explanation).toContain(errorMessage);

    const goodResult = results.find((r) => r.scannerId === "good-scanner");
    expect(goodResult).toBeDefined();
    expect(goodResult!.findings).toEqual([goodFinding]);
    expect(goodResult!.error).toBeNull();
  });

  it("pre-filters diff files by scan paths", async () => {
    const scanner: Scanner = {
      id: "counter", name: "Counter", layer: "security",
      scan: async (ctx) => {
        // Return one finding per diff file to count how many files were passed
        return ctx.diff.map(f => makeFinding({ file: f.path }));
      },
    };

    const config = parseConfig({
      scan_paths: { include: ["src/**"], exclude: ["**/*.test.*"] },
    });

    const context = {
      diff: [
        { path: "src/app.ts", added: ["x"], removed: [], patch: "" } as DiffFile,
        { path: "src/app.test.ts", added: ["x"], removed: [], patch: "" } as DiffFile,
        { path: "docs/readme.md", added: ["x"], removed: [], patch: "" } as DiffFile,
      ],
      config,
      repoRoot: "/tmp",
      baseBranch: "main",
      prBranch: "feature",
    };

    const results = await runScanners([scanner], context);
    // Only src/app.ts should pass (src/app.test.ts excluded, docs/readme.md not in include)
    expect(results[0].findings).toHaveLength(1);
    expect(results[0].findings[0].file).toBe("src/app.ts");
  });

  it("enforces timeout and produces an info finding for timed-out scanners", async () => {
    const slowScanner: Scanner = {
      id: "slow-scanner",
      name: "Slow Scanner",
      layer: "greenops",
      scan: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return [];
      },
    };

    const context = makeContext();
    const results = await runScanners([slowScanner], context, { timeoutMs: 100 });

    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result.scannerId).toBe("slow-scanner");
    expect(result.error).toBeTruthy();
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe("info");
    expect(result.findings[0].title.toLowerCase()).toContain("timed out");
  });
});
