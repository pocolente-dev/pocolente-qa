import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DeadCodeScanner } from "../src/dead-code-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;
const scanner = new DeadCodeScanner();

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "pocolente-dc-"));
  await mkdir(join(tempDir, "src"), { recursive: true });
});
afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeContext(diffs: DiffFile[]): ScanContext {
  return { diff: diffs, config: parseConfig(undefined), repoRoot: tempDir, baseBranch: "main", prBranch: "feature" };
}

describe("DeadCodeScanner", () => {
  it("has correct metadata", () => {
    expect(scanner.id).toBe("dead-code-scanner");
    expect(scanner.layer).toBe("correctness");
  });

  it("detects unused import", async () => {
    // File has import but never uses it
    const fileContent = 'import { unused } from "./lib";\nimport { used } from "./utils";\n\nconsole.log(used);\n';
    await writeFile(join(tempDir, "src/app.ts"), fileContent);

    const ctx = makeContext([{
      path: "src/app.ts",
      added: ['import { unused } from "./lib";', 'import { used } from "./utils";', '', 'console.log(used);'],
      removed: [], patch: "",
    }]);

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes("unused") && f.title.includes("unused"))).toBe(true);
    // Should NOT flag "used" since it appears in console.log
    expect(findings.some(f => f.title.includes('"used"'))).toBe(false);
  });

  it("detects unreachable code after return", async () => {
    const fileContent = 'function foo() {\n  return 42;\n  console.log("unreachable");\n}\n';
    await writeFile(join(tempDir, "src/app.ts"), fileContent);

    const ctx = makeContext([{
      path: "src/app.ts",
      added: ['function foo() {', '  return 42;', '  console.log("unreachable");', '}'],
      removed: [], patch: "",
    }]);

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("unreachable"))).toBe(true);
  });

  it("does NOT flag used imports", async () => {
    const fileContent = 'import { helper } from "./lib";\n\nhelper();\n';
    await writeFile(join(tempDir, "src/app.ts"), fileContent);

    const ctx = makeContext([{
      path: "src/app.ts",
      added: ['import { helper } from "./lib";', '', 'helper();'],
      removed: [], patch: "",
    }]);

    const findings = await scanner.scan(ctx);
    expect(findings.filter(f => f.title.includes("helper"))).toHaveLength(0);
  });

  it("only scans TS/JS files", async () => {
    const ctx = makeContext([{
      path: "readme.md",
      added: ['import { unused } from "./lib";'],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("handles missing files gracefully", async () => {
    const ctx = makeContext([{
      path: "src/nonexistent.ts",
      added: ['import { foo } from "./lib";'],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    // Should not crash, just skip
    expect(findings).toHaveLength(0);
  });

  it("respects deadCode.enabled config", async () => {
    const config = parseConfig({ correctness: { dead_code: { enabled: false } } });
    const ctx: ScanContext = {
      diff: [{ path: "src/app.ts", added: ['import { unused } from "./lib";'], removed: [], patch: "" }],
      config, repoRoot: tempDir, baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
