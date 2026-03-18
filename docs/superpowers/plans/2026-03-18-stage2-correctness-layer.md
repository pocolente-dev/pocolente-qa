# Pocolente QA Harness — Stage 2: Correctness Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the correctness scan layer that catches bugs common in AI-generated code — unused imports, empty catch blocks, console.log in production, breaking API changes, test coverage regressions, and over-permissioned infrastructure configs.

**Architecture:** Creates a new `@pocolente/scanner-correctness` package with 4 scanners (Generation Quality, Dead Code, Behavioral Drift, Test Coverage Delta) plus a Bundle Size checker added to the existing supply chain scanner, and a Permission & Scope Analyzer in `@pocolente/scanner-security`. Scanners that need full file context (dead code, behavioral drift) read files from `context.repoRoot` using `fs.readFile`. The diff-based scanners operate on `context.diff` as before.

**Tech Stack:** TypeScript, Vitest (existing). New: `dockerfile-ast` for Dockerfile parsing. Uses Node.js built-in `fetch` for bundlephobia API.

---

## File Map

### `packages/scanner-correctness/` (new package)

| File | Responsibility |
|---|---|
| `package.json` | Package manifest, deps: @pocolente/core |
| `tsconfig.json` | Extends base |
| `tsup.config.ts` | Build config |
| `vitest.config.ts` | Test config |
| `src/index.ts` | Re-exports all scanners |
| `src/generation-quality-scanner.ts` | Empty catches, console.log, TODOs, naming |
| `src/generation-quality-rules.ts` | Individual rule implementations |
| `src/dead-code-scanner.ts` | Unused imports, unreachable code, unused variables |
| `src/behavioral-drift-scanner.ts` | Export surface changes between base and PR |
| `src/coverage-delta-scanner.ts` | Parse lcov/cobertura coverage reports |
| `src/coverage-parser.ts` | LCOV and Cobertura format parsers |
| `tests/generation-quality-scanner.test.ts` | Generation quality tests |
| `tests/dead-code-scanner.test.ts` | Dead code tests |
| `tests/behavioral-drift-scanner.test.ts` | Behavioral drift tests |
| `tests/coverage-delta-scanner.test.ts` | Coverage delta tests |
| `tests/coverage-parser.test.ts` | Coverage parser tests |

### `packages/scanner-security/` (modified)

| File | Responsibility |
|---|---|
| `src/permissions-scanner.ts` | K8s YAML + Dockerfile analysis |
| `tests/permissions-scanner.test.ts` | Permission scanner tests |

### `packages/cli/` and `packages/github-action/` (modified)

| File | Responsibility |
|---|---|
| `src/main.ts` | Register new correctness scanners + permissions scanner |

---

## Task 1: Scanner-Correctness Package Scaffolding

**Files:**
- Create: `packages/scanner-correctness/package.json`
- Create: `packages/scanner-correctness/tsconfig.json`
- Create: `packages/scanner-correctness/tsup.config.ts`
- Create: `packages/scanner-correctness/vitest.config.ts`
- Create: `packages/scanner-correctness/src/index.ts` (empty exports for now)

- [ ] **Step 1: Create package files**

`package.json`:
```json
{
  "name": "@pocolente/scanner-correctness",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": { "build": "tsup", "test": "vitest run" },
  "dependencies": { "@pocolente/core": "workspace:*" }
}
```

`tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`: same pattern as scanner-security.

`src/index.ts`: empty file with comment `// Exports added as scanners are implemented`

- [ ] **Step 2: Install deps**

Run: `pnpm install`

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @pocolente/scanner-correctness build`

- [ ] **Step 4: Commit**

```bash
git add packages/scanner-correctness/
git commit -m "feat: scaffold scanner-correctness package"
```

---

## Task 2: Generation Quality Scanner (TDD)

**Files:**
- Create: `packages/scanner-correctness/src/generation-quality-rules.ts`
- Create: `packages/scanner-correctness/src/generation-quality-scanner.ts`
- Create: `packages/scanner-correctness/tests/generation-quality-scanner.test.ts`
- Modify: `packages/scanner-correctness/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/scanner-correctness/tests/generation-quality-scanner.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { GenerationQualityScanner } from "../src/generation-quality-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";

function makeContext(diffs: DiffFile[]): ScanContext {
  return {
    diff: diffs, config: parseConfig(undefined),
    repoRoot: "/tmp/test", baseBranch: "main", prBranch: "feature",
  };
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
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement generation quality rules**

Create `packages/scanner-correctness/src/generation-quality-rules.ts`:

Export individual rule functions, each taking a line and returning a match or null:

1. **Empty catch block**: detect `catch\s*\([^)]*\)\s*\{\s*\}` on a single line, or `catch\s*\([^)]*\)\s*\{` followed by only whitespace/comments until `}`
2. **Console statement**: detect `console\.(log|debug|info|warn|error)\s*\(` — skip if file path matches test pattern (`*.test.*`, `*.spec.*`, `__tests__/`)
3. **Untracked TODO**: detect `\b(TODO|FIXME|HACK)\b` NOT followed by `(#\d+)` or `(JIRA-\d+)` or `(@\w+)` within the same line
4. **Overly generic names**: detect `const (data|result|temp|val|x|obj|item)\s*[=:]` when assigned to complex expressions (not simple literals)

Each rule returns: `{ title, explanation, suggestion, confidence }`

- [ ] **Step 4: Implement scanner**

Create `packages/scanner-correctness/src/generation-quality-scanner.ts`:

Implements `Scanner` interface. Layer: `"correctness"`. Iterates diff files (TS/JS only), runs each rule on each added line. Reads config from `context.config.correctness.generationQuality`.

- [ ] **Step 5: Export from index**

- [ ] **Step 6: Run tests — expect PASS**

- [ ] **Step 7: Commit**

```bash
git add packages/scanner-correctness/
git commit -m "feat(correctness): add Generation Quality Scanner with code smell rules"
```

---

## Task 3: Dead Code Detector (TDD)

**Files:**
- Create: `packages/scanner-correctness/src/dead-code-scanner.ts`
- Create: `packages/scanner-correctness/tests/dead-code-scanner.test.ts`
- Modify: `packages/scanner-correctness/src/index.ts`

The Dead Code Detector analyzes full file content (not just diff lines) to find unused imports and unreachable code. It reads files from `context.repoRoot`.

- [ ] **Step 1: Write failing test**

Create `packages/scanner-correctness/tests/dead-code-scanner.test.ts`:

Test `DeadCodeScanner`:
1. Detects unused import: file has `import { foo } from "./lib";` but `foo` never appears in rest of file
2. Detects unreachable code: statements after `return` in same block
3. Does NOT flag used imports
4. Does NOT flag re-exported imports (`export { foo } from "./lib"`)
5. Only scans files in the diff (doesn't scan entire repo)
6. Respects `deadCode.enabled` config

For testing, create temp files in a temp directory and set `context.repoRoot` to that directory. Use `beforeEach`/`afterEach` to manage fixtures.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement Dead Code Scanner**

Logic:
1. For each TS/JS file in the diff, read the full file from `context.repoRoot + "/" + file.path`
2. Parse all `import { X, Y } from "..."` statements (regex)
3. For each imported symbol, check if it appears elsewhere in the file (not just in the import line)
4. Parse for unreachable code: after `return;` or `return X;` or `throw X;`, check if next non-empty line in the same indentation block is code (not `}` or `catch` or `finally`)
5. Return findings for unused imports (warn) and unreachable code (warn)
6. Only report findings for lines that appear in the diff's `added` array (don't flag existing dead code)

Graceful failure: if file can't be read (e.g., deleted file in diff), skip it with no finding.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/scanner-correctness/
git commit -m "feat(correctness): add Dead Code Detector for unused imports and unreachable code"
```

---

## Task 4: Behavioral Drift Analyzer (TDD)

**Files:**
- Create: `packages/scanner-correctness/src/behavioral-drift-scanner.ts`
- Create: `packages/scanner-correctness/tests/behavioral-drift-scanner.test.ts`
- Modify: `packages/scanner-correctness/src/index.ts`

The Behavioral Drift Analyzer detects breaking API changes by comparing removed and added export lines in the diff.

- [ ] **Step 1: Write failing test**

Test `BehavioralDriftScanner`:
1. Detects removed export: diff has removed line `export function getData()` with no matching add — finding with severity "block"
2. Detects parameter count change: removed `export function fetch(url: string)` and added `export function fetch(url: string, options: object)` — finding with severity "warn" (parameter added, not removed — non-breaking)
3. Detects parameter removal: removed `export function fetch(url: string, timeout: number)` and added `export function fetch(url: string)` — severity "block" (breaking)
4. Does NOT flag non-exported function changes
5. Does NOT flag new exports (added without matching removal)
6. Respects `behavioralDrift.enabled` config

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement Behavioral Drift Scanner**

Logic — purely diff-based, no file reads needed:
1. For each TS/JS file in the diff, collect `removed` and `added` lines
2. Parse export patterns from removed lines: `export (function|class|const|let|type|interface) NAME`, `export default`, `export { NAME }`
3. Parse export patterns from added lines (same patterns)
4. Compare:
   - Removed export with no matching add = removed export (severity: block)
   - Removed export with matching add but different parameter count = parameter change (block if params removed, warn if params added)
   - Removed export with matching add but different return type annotation = type change (warn)
5. Return findings

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/scanner-correctness/
git commit -m "feat(correctness): add Behavioral Drift Analyzer for breaking export changes"
```

---

## Task 5: Coverage Report Parser (TDD)

**Files:**
- Create: `packages/scanner-correctness/src/coverage-parser.ts`
- Create: `packages/scanner-correctness/tests/coverage-parser.test.ts`

- [ ] **Step 1: Write failing test**

Test `parseLcov(content)` and `parseCobertura(content)`:

For LCOV:
```
SF:src/app.ts
LF:100
LH:85
end_of_record
SF:src/utils.ts
LF:50
LH:50
end_of_record
```
Expected: `[{ file: "src/app.ts", totalLines: 100, coveredLines: 85 }, { file: "src/utils.ts", totalLines: 50, coveredLines: 50 }]`

For Istanbul JSON: `{ "src/app.ts": { s: { "0": 1, "1": 0, "2": 1 }, ... } }` — extract statement coverage counts.

Test `computeCoverageDelta(base, pr)`:
- Returns overall delta percentage
- Returns per-file deltas for changed files
- Returns null if either report is empty

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement parsers**

`parseLcov`: regex-based parser that extracts `SF` (file), `LF` (lines found), `LH` (lines hit) from LCOV format.
`parseIstanbulJson`: parse Istanbul JSON format, count statements.
`computeCoverageDelta`: compare two coverage reports, return `{ overallDelta, perFile }`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/scanner-correctness/
git commit -m "feat(correctness): add LCOV and Istanbul coverage report parsers"
```

---

## Task 6: Test Coverage Delta Scanner (TDD)

**Files:**
- Create: `packages/scanner-correctness/src/coverage-delta-scanner.ts`
- Create: `packages/scanner-correctness/tests/coverage-delta-scanner.test.ts`
- Modify: `packages/scanner-correctness/src/index.ts`

- [ ] **Step 1: Write failing test**

Test `CoverageDeltaScanner`:
1. Reports finding when coverage decreases more than threshold (default 2%)
2. Reports info finding with coverage summary when coverage is stable
3. Returns empty when coverage files don't exist (graceful skip with info finding)
4. Respects `coverage.enabled` config

For testing, create temp lcov files in a temp directory and set coverage paths in config.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement scanner**

Reads coverage reports from `config.correctness.coverage.baseCoveragePath` and `config.correctness.coverage.prCoveragePath` (resolved relative to `context.repoRoot`). Parses with appropriate parser based on `config.correctness.coverage.coverageFormat`. Computes delta. Reports findings based on `config.correctness.coverage.maxDecreasePercent`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/scanner-correctness/
git commit -m "feat(correctness): add Test Coverage Delta Scanner"
```

---

## Task 7: Permission & Scope Analyzer (TDD)

**Files:**
- Create: `packages/scanner-security/src/permissions-scanner.ts`
- Create: `packages/scanner-security/tests/permissions-scanner.test.ts`
- Modify: `packages/scanner-security/src/index.ts`

- [ ] **Step 1: Install dockerfile-ast**

Run: `pnpm --filter @pocolente/scanner-security add dockerfile-ast`

- [ ] **Step 2: Write failing test**

Test `PermissionsScanner`:

For Kubernetes YAML:
1. Detects wildcard permissions: `resources: ["*"]` or `verbs: ["*"]`
2. Detects containers running as root: `securityContext.runAsUser: 0` or missing `runAsNonRoot: true`
3. Does NOT flag properly configured security contexts

For Dockerfiles:
1. Detects `USER root` without subsequent non-root USER
2. Detects missing USER directive entirely (defaults to root)
3. Does NOT flag Dockerfiles with `USER nonroot` or `USER 1000`

Only processes `.yml`, `.yaml`, and `Dockerfile*` files from the diff.

- [ ] **Step 3: Run test — expect FAIL**

- [ ] **Step 4: Implement scanner**

Logic:
- For YAML files: parse with `yaml` package, check for K8s patterns (kind: Role, RoleBinding, Deployment, Pod). Check securityContext, resources, verbs fields.
- For Dockerfiles: use `dockerfile-ast` to parse. Check for USER instructions, flag if last USER is root or no USER exists.
- Severity from `config.security.permissions.severity` (default warn)

- [ ] **Step 5: Export from scanner-security index**

- [ ] **Step 6: Run ALL scanner-security tests — expect PASS**

- [ ] **Step 7: Commit**

```bash
git add packages/scanner-security/
git commit -m "feat(security): add Permission & Scope Analyzer for K8s and Dockerfiles"
```

---

## Task 8: Wire All New Scanners

**Files:**
- Modify: `packages/github-action/src/main.ts`
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/github-action/package.json` (add scanner-correctness dep)
- Modify: `packages/cli/package.json` (add scanner-correctness dep)

- [ ] **Step 1: Add scanner-correctness dependency**

Update `packages/github-action/package.json` and `packages/cli/package.json` to add:
```json
"@pocolente/scanner-correctness": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 2: Update GitHub Action**

Import and register all new scanners:
```ts
import {
  GenerationQualityScanner,
  DeadCodeScanner,
  BehavioralDriftScanner,
  CoverageDeltaScanner,
} from "@pocolente/scanner-correctness";
import { PermissionsScanner } from "@pocolente/scanner-security";

const scanners = [
  // Security
  new SecretsScanner(),
  new OwaspScanner(ALL_OWASP_RULES),
  new SupplyChainScanner(),
  new PermissionsScanner(),
  // Correctness
  new GenerationQualityScanner(),
  new DeadCodeScanner(),
  new BehavioralDriftScanner(),
  new CoverageDeltaScanner(),
];
```

- [ ] **Step 3: Update CLI** (same scanner registration)

- [ ] **Step 4: Rebuild all**

Run: `pnpm -r build`

- [ ] **Step 5: Commit**

```bash
git add packages/github-action/ packages/cli/ pnpm-lock.yaml
git commit -m "feat: wire correctness scanners and permissions scanner into Action and CLI"
```

---

## Task 9: Full Build Verification

- [ ] **Step 1: Run ALL tests**

Run: `pnpm test`
Report exact count.

- [ ] **Step 2: Clean build**

Run: `pnpm -r build`

- [ ] **Step 3: CLI end-to-end**

Run: `node packages/cli/dist/main.js scan --format json`

- [ ] **Step 4: Verify Action bundle**

Run: `ls -la packages/github-action/dist/index.js`

- [ ] **Step 5: Git log**

Run: `git log --oneline -15`

- [ ] **Step 6: Final commit if needed**

---

## Done Criteria

Stage 2 is complete when:
1. `pnpm test` passes with all tests green (Stage 0 + 1 + 2)
2. Generation Quality Scanner detects: empty catches, console.log in prod, untracked TODOs
3. Dead Code Detector detects unused imports and unreachable code in TS/JS
4. Behavioral Drift Analyzer detects removed exports and parameter changes
5. Coverage Delta Scanner parses LCOV reports and flags coverage regressions
6. Permission & Scope Analyzer flags root containers and wildcard K8s permissions
7. All scanners wired into GitHub Action and CLI
