# Pocolente QA Harness — Stage 0: Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the monorepo skeleton, core type system, config parser, scanner plugin interface, secrets scanner, GitHub Action entry point, and CLI — producing a fully working end-to-end pipeline where a PR triggers the Action, the Secrets Scanner runs, a PR comment is posted, and a commit status is set.

**Architecture:** pnpm monorepo with 4 packages (`core`, `scanner-security`, `github-action`, `cli`). The `core` package defines the type system, config parser, scanner plugin interface, severity engine, and PR comment renderer. `scanner-security` houses the Secrets Scanner. `github-action` is the GitHub Action entry point that orchestrates scanning and posts results. `cli` is a thin wrapper that runs the same scanner engine locally. All packages are TypeScript, compiled with `tsup`, and the GitHub Action is bundled into a single JS file with `esbuild`.

**Tech Stack:** TypeScript, Node.js 20, pnpm workspaces, Zod, Octokit, simple-git, tsup, esbuild, Vitest

---

## File Map

### Root

| File | Responsibility |
|---|---|
| `package.json` | pnpm workspace root, scripts |
| `pnpm-workspace.yaml` | workspace package globs |
| `tsconfig.base.json` | shared TypeScript config |
| `.gitignore` | node_modules, dist, coverage |
| `.pocolente.yml` | dogfood config — Pocolente scans itself |
| `vitest.workspace.ts` | Vitest workspace config for monorepo |

### `packages/core/`

| File | Responsibility |
|---|---|
| `src/types.ts` | `Finding`, `Severity`, `ScanLayer`, `ScannerResult`, `ScanContext` types |
| `src/scanner.ts` | `Scanner` interface (plugin contract) |
| `src/config.ts` | Zod schema for `.pocolente.yml`, parser, defaults |
| `src/severity.ts` | Severity filtering, deduplication, threshold engine |
| `src/renderer.ts` | `Finding[]` to markdown PR comment string |
| `src/orchestrator.ts` | Runs scanners in parallel, enforces timeouts, collects results |
| `src/diff.ts` | Unified diff parser (shared by Action and CLI) |
| `src/index.ts` | Public API re-exports |
| `tests/config.test.ts` | Config parser tests |
| `tests/severity.test.ts` | Severity engine tests |
| `tests/renderer.test.ts` | PR comment renderer tests |
| `tests/orchestrator.test.ts` | Orchestrator tests (timeout, failure handling) |
| `tests/diff.test.ts` | Diff parser tests |
| `package.json` | Package manifest |
| `tsconfig.json` | Extends base, sets paths |
| `tsup.config.ts` | Build config |

### `packages/scanner-security/`

| File | Responsibility |
|---|---|
| `src/secrets-scanner.ts` | Secrets Scanner implementation |
| `src/secrets-patterns.ts` | Regex pattern library for known credential formats |
| `src/index.ts` | Re-exports |
| `tests/secrets-scanner.test.ts` | Secrets Scanner tests |
| `tests/fixtures/` | Sample diffs containing secrets and clean code |
| `package.json` | Package manifest |
| `tsconfig.json` | Extends base |
| `tsup.config.ts` | Build config |

### `packages/github-action/`

| File | Responsibility |
|---|---|
| `src/main.ts` | Action entry point: parse inputs, orchestrate scan, post comment |
| `src/github.ts` | Octokit wrapper: post PR comment, set commit status |
| `action.yml` | GitHub Action manifest |
| `package.json` | Package manifest (build script runs esbuild directly) |
| `tsconfig.json` | Extends base |

### `packages/cli/`

| File | Responsibility |
|---|---|
| `src/main.ts` | CLI entry point: parse args, run scan, print output |
| `src/formatter.ts` | Terminal formatter: colors, tables |
| `package.json` | Package manifest, `bin` field |
| `tsconfig.json` | Extends base |
| `tsup.config.ts` | Build config |

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `vitest.workspace.ts`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/tsup.config.ts`
- Create: `packages/scanner-security/package.json`, `packages/scanner-security/tsconfig.json`, `packages/scanner-security/tsup.config.ts`
- Create: `packages/github-action/package.json`, `packages/github-action/tsconfig.json`
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`, `packages/cli/tsup.config.ts`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "pocolente",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "tsup": "^8.0.0"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
coverage/
.pocolente/
*.tsbuildinfo
```

- [ ] **Step 5: Create `vitest.workspace.ts`**

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace(["packages/*"]);
```

Note: Vitest 3.x expects directory paths pointing to packages with their own `vitest.config.ts`, not direct paths to config files.

- [ ] **Step 6: Create `packages/core/package.json`**

```json
{
  "name": "@pocolente/core",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run"
  },
  "dependencies": {
    "yaml": "^2.7.0",
    "zod": "^3.24.0"
  }
}
```

- [ ] **Step 7: Create `packages/core/tsconfig.json` and `tsup.config.ts`**

tsconfig.json:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

tsup.config.ts:
```ts
import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
});
```

- [ ] **Step 8: Create `packages/scanner-security/package.json`, `tsconfig.json`, `tsup.config.ts`**

package.json:
```json
{
  "name": "@pocolente/scanner-security",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": { "build": "tsup", "test": "vitest run" },
  "dependencies": { "@pocolente/core": "workspace:*" }
}
```

tsconfig.json: same pattern as core. tsup.config.ts: same pattern as core.

- [ ] **Step 9: Create `packages/github-action/package.json` and `tsconfig.json`**

package.json:
```json
{
  "name": "@pocolente/github-action",
  "version": "0.0.1",
  "type": "module",
  "scripts": { "build": "npx esbuild src/main.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/index.js --banner:js=\"import { createRequire } from 'module'; const require = createRequire(import.meta.url);\"" },
  "dependencies": {
    "@pocolente/core": "workspace:*",
    "@pocolente/scanner-security": "workspace:*",
    "@actions/core": "^1.11.0",
    "@actions/github": "^6.0.0",
    "simple-git": "^3.27.0"
  },
  "devDependencies": { "esbuild": "^0.24.0" }
}
```

- [ ] **Step 10: Create `packages/cli/package.json`, `tsconfig.json`, `tsup.config.ts`**

package.json:
```json
{
  "name": "@pocolente/cli",
  "version": "0.0.1",
  "type": "module",
  "bin": { "pocolente": "dist/main.js" },
  "files": ["dist"],
  "scripts": { "build": "tsup", "test": "vitest run" },
  "dependencies": {
    "@pocolente/core": "workspace:*",
    "@pocolente/scanner-security": "workspace:*",
    "simple-git": "^3.27.0"
  }
}
```

tsup.config.ts:
```ts
import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
```

- [ ] **Step 11: Install dependencies**

Run: `pnpm install`
Expected: successful install, pnpm-lock.yaml created

- [ ] **Step 12: Verify workspace**

Run: `pnpm -r ls --depth 0`
Expected: lists all 4 packages

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold pnpm monorepo with 4 packages"
```

---

## Task 2: Core Types

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/scanner.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/src/types.ts`**

```ts
export type Severity = "block" | "warn" | "info";

export type ScanLayer = "correctness" | "security" | "greenops";

export interface Finding {
  layer: ScanLayer;
  scanner: string;
  severity: Severity;
  confidence: number;
  file: string;
  line: string;
  title: string;
  explanation: string;
  suggestion: string;
  cwe: string | null;
  owasp: string | null;
  estimatedEnergyImpact: string | null;
  rcsDelta: string | null;
}

export interface ScannerResult {
  scannerId: string;
  layer: ScanLayer;
  findings: Finding[];
  durationMs: number;
  error: string | null;
}

export interface DiffFile {
  path: string;
  added: string[];
  removed: string[];
  patch: string;
}

export interface ScanContext {
  diff: DiffFile[];
  config: PocolenteConfig;
  repoRoot: string;
  baseBranch: string;
  prBranch: string;
  /** Populated by tree-sitter in Stage 1+. Not used in Stage 0. */
  parsedASTs?: Map<string, unknown>;
}

// Forward declaration — full type defined in config.ts
export type PocolenteConfig = Record<string, unknown>;
```

- [ ] **Step 2: Create `packages/core/src/scanner.ts`**

```ts
import type { ScanLayer, Finding, ScanContext } from "./types.js";

export interface Scanner {
  id: string;
  name: string;
  layer: ScanLayer;
  scan(context: ScanContext): Promise<Finding[]>;
}
```

- [ ] **Step 3: Create `packages/core/src/index.ts`**

```ts
export type { Severity, ScanLayer, Finding, ScannerResult, DiffFile, ScanContext } from "./types.js";
export type { Scanner } from "./scanner.js";
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm --filter @pocolente/core build`
Expected: dist/ created with .js and .d.ts files

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/
git commit -m "feat(core): add Finding, Scanner, ScanContext types"
```

---

## Task 3: Config Parser

**Files:**
- Create: `packages/core/src/config.ts`
- Create: `packages/core/tests/config.test.ts`
- Create: `packages/core/vitest.config.ts`
- Modify: `packages/core/src/types.ts` (replace PocolenteConfig forward declaration)
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
```

- [ ] **Step 2: Write failing test for config parser**

Create `packages/core/tests/config.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  it("returns defaults for empty input", () => {
    const config = parseConfig({});
    expect(config.version).toBe(1);
    expect(config.severityThreshold).toBe("warn");
    expect(config.blockPrOn).toBe("block");
    expect(config.correctness.enabled).toBe(true);
    expect(config.security.enabled).toBe(true);
    expect(config.greenops.enabled).toBe(true);
  });

  it("returns defaults for undefined input", () => {
    const config = parseConfig(undefined);
    expect(config.version).toBe(1);
  });

  it("overrides defaults with provided values", () => {
    const config = parseConfig({
      severity_threshold: "info",
      block_pr_on: "warn",
      security: { enabled: false },
    });
    expect(config.severityThreshold).toBe("info");
    expect(config.blockPrOn).toBe("warn");
    expect(config.security.enabled).toBe(false);
    expect(config.correctness.enabled).toBe(true);
  });

  it("parses scan_paths with defaults", () => {
    const config = parseConfig({});
    expect(config.scanPaths.include).toEqual(["src/**", "lib/**", "packages/**"]);
    expect(config.scanPaths.exclude).toEqual(["**/*.test.*", "**/*.spec.*", "vendor/**"]);
  });

  it("handles invalid severity gracefully", () => {
    expect(() => parseConfig({ severity_threshold: "invalid" })).toThrow();
  });

  it("warns on runtime_profiling.enabled = true", () => {
    const config = parseConfig({ runtime_profiling: { enabled: true } });
    expect(config.warnings).toContain(
      "Runtime profiling is not yet available. This setting will be ignored."
    );
    expect(config.runtimeProfiling.enabled).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @pocolente/core test`
Expected: FAIL — parseConfig does not exist

- [ ] **Step 4: Implement config parser**

Create `packages/core/src/config.ts` with Zod schemas for all config sections (correctness, security, greenops, runtime_profiling, reporting), a `PocolenteConfig` interface, and a `parseConfig(raw: unknown)` function that:
- Parses raw YAML-like object through Zod with defaults
- Converts snake_case keys to camelCase in output
- Forces `runtimeProfiling.enabled = false` (until Stage 5)
- Collects warnings for unavailable features
- Exports `DEFAULT_CONFIG` as `parseConfig(undefined)`

See spec for all config fields and their defaults.

- [ ] **Step 5: Update types.ts to import real PocolenteConfig**

Replace the forward declaration with:
```ts
export type { PocolenteConfig } from "./config.js";
```

- [ ] **Step 6: Update index.ts exports**

Add: `export { parseConfig, DEFAULT_CONFIG } from "./config.js";`
Add: `export type { PocolenteConfig } from "./config.js";`

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @pocolente/core test`
Expected: all 6 tests PASS

- [ ] **Step 8: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add Zod config parser with defaults and validation"
```

---

## Task 4: YAML Config File Loader

**Files:**
- Create: `packages/core/src/loader.ts`
- Create: `packages/core/tests/loader.test.ts`
- Create: `packages/core/tests/fixtures/valid.yml`
- Create: `packages/core/tests/fixtures/minimal.yml`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create test fixtures**

`valid.yml`: a YAML file with some overrides (severity_threshold: info, greenops disabled).
`minimal.yml`: just `version: 1`.

- [ ] **Step 2: Write failing test**

Test that `loadConfig(path)` returns parsed config for valid files, fills defaults for minimal files, and returns defaults when file does not exist.

- [ ] **Step 3: Run test — expect FAIL**

- [ ] **Step 4: Implement loader**

`packages/core/src/loader.ts`: reads file with `fs/promises`, parses YAML, calls `parseConfig()`. On ENOENT, returns `parseConfig(undefined)`.

- [ ] **Step 5: Export from index**

- [ ] **Step 6: Run tests — expect PASS**

- [ ] **Step 7: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add YAML config file loader with fallback to defaults"
```

---

## Task 5: Severity Engine

**Files:**
- Create: `packages/core/src/severity.ts`
- Create: `packages/core/tests/severity.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

Test `filterFindings(findings, threshold)` — filters out findings below threshold.
Test `deduplicateFindings(findings)` — removes duplicates by file+line+scanner key.
Test `computeStatus(findings, blockOn)` — returns "pass" or "block" based on whether any finding meets the block threshold. Returns "pass" when blockOn is "none".

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement severity engine**

`filterFindings`: uses severity ordering (block=3, warn=2, info=1), keeps findings >= threshold.
`deduplicateFindings`: Set-based dedup on `file:line:scanner` key.
`computeStatus`: returns "block" if any finding severity >= blockOn threshold.

- [ ] **Step 4: Export from index**

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add severity filtering, deduplication, and status engine"
```

---

## Task 6: PR Comment Markdown Renderer

**Files:**
- Create: `packages/core/src/renderer.ts`
- Create: `packages/core/tests/renderer.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

Test that `renderComment(findings, status, durationMs)`:
- Renders summary table with layer names and finding counts
- Shows "Merge blocked" when status is "block"
- Shows "All checks passed" when status is "pass"
- Renders collapsible `<details>` for each finding with title, file:line, CWE if present
- Orders findings by severity (block first, then warn, then info)
- Includes scan duration in footer

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement renderer**

Generates markdown following the "Lens View" UX from the spec:
- Summary table (Layer | Findings | Status)
- Result line
- Collapsible details per finding, sorted by severity descending
- Footer with duration

- [ ] **Step 4: Export from index**

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add PR comment markdown renderer with lens view UX"
```

---

## Task 7: Orchestrator

**Files:**
- Create: `packages/core/src/orchestrator.ts`
- Create: `packages/core/tests/orchestrator.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

Test `runScanners(scanners, context, options)`:
- Runs multiple scanners in parallel, collects all results
- Catches scanner errors gracefully — produces info-level finding instead of crashing
- Enforces per-scanner timeout — produces info-level "timed out" finding

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement orchestrator**

`runScanners`: runs all scanners via `Promise.all`, each wrapped in `runSingleScanner` which:
- Times the scan
- Catches thrown errors, wraps in info-level finding
- Enforces timeout via a `withTimeout` helper (race between scan promise and setTimeout rejection)

- [ ] **Step 4: Export from index**

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add scanner orchestrator with parallel execution and timeout"
```

---

## Task 8: Diff Parser

**Files:**
- Create: `packages/core/src/diff.ts`
- Create: `packages/core/tests/diff.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

Test `parseDiff(diffOutput)`:
- Parses multiple files from a unified diff string
- Separates added and removed lines correctly
- Returns empty array for empty input

Use a sample unified diff constant in the test.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement diff parser**

Split on `^diff --git` markers. For each chunk, extract path from `b/path` line. Walk lines: `+` prefix (not `+++`) = added, `-` prefix (not `---`) = removed. **Important: strip the `+`/`-` prefix from line content** before storing in `added`/`removed` arrays — downstream scanners expect raw source lines, not diff-prefixed lines. Returns `DiffFile[]`.

- [ ] **Step 4: Export from index**

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add unified diff parser"
```

---

## Task 9: Secrets Scanner — Pattern Library

**Files:**
- Create: `packages/scanner-security/src/secrets-patterns.ts`
- Create: `packages/scanner-security/tests/secrets-patterns.test.ts`
- Create: `packages/scanner-security/vitest.config.ts`
- Create: `packages/scanner-security/src/index.ts`

- [ ] **Step 1: Create vitest.config.ts**

- [ ] **Step 2: Write failing test**

Test `matchSecretPatterns(line)` detects: AWS access key (AKIA...), GitHub token (ghp_...), Stripe secret key (sk_live_...), PEM private key header, database URL (postgres://...), JWT (eyJ...). Returns empty for clean lines.

- [ ] **Step 3: Run test — expect FAIL**

- [ ] **Step 4: Implement pattern library**

Define `SecretPattern` array with name, regex, confidence per pattern. `matchSecretPatterns` iterates patterns, returns all matches with pattern name, matched text, and confidence.

Patterns: aws-access-key, github-token, stripe-secret-key, private-key, database-url, jwt, slack-webhook, gcp-api-key, generic-secret-assignment.

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/scanner-security/
git commit -m "feat(security): add secrets pattern library with 9 credential formats"
```

---

## Task 10: Secrets Scanner Implementation

**Files:**
- Create: `packages/scanner-security/src/secrets-scanner.ts`
- Create: `packages/scanner-security/tests/secrets-scanner.test.ts`
- Modify: `packages/scanner-security/src/index.ts`

- [ ] **Step 1: Write failing test**

Test `SecretsScanner`:
- Has correct id ("secrets-scanner") and layer ("security")
- Detects AWS key in added lines, returns finding with severity "block"
- Detects multiple secrets in a single file
- Returns empty findings for clean code
- Respects allowlist from config
- Only scans added lines, not removed lines

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement SecretsScanner**

Implements `Scanner` interface. Iterates diff files, scans each added line through `matchSecretPatterns`. Skips allowlisted matches. Produces Finding with CWE-798, severity from config.

- [ ] **Step 4: Export from index**

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/scanner-security/
git commit -m "feat(security): implement SecretsScanner with allowlist and diff-only scanning"
```

---

## Task 11: GitHub Action — GitHub API Wrapper

**Files:**
- Create: `packages/github-action/src/github.ts`

- [ ] **Step 1: Implement GitHub API wrapper**

Uses `@actions/github` to get Octokit and context. Exposes:
- `postComment(body)`: finds existing Pocolente comment and updates it, or creates new one
- `setCommitStatus(state, description)`: sets commit status with context "Pocolente QA"

- [ ] **Step 2: Commit**

```bash
git add packages/github-action/src/github.ts
git commit -m "feat(action): add GitHub API wrapper for comments and commit status"
```

---

## Task 12: GitHub Action — Entry Point and Bundle

**Files:**
- Create: `packages/github-action/src/main.ts`
- Create: `packages/github-action/action.yml`

Note: esbuild is invoked directly via the `build` script in package.json (no separate config file needed). The build script runs: `npx esbuild src/main.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/index.js`

- [ ] **Step 1: Create Action entry point**

`packages/github-action/src/main.ts`:
1. Read inputs (github-token, config-path) via `@actions/core`
2. Load config via `loadConfig(configPath)`
3. Compute diff via simple-git (`git diff --unified=0 origin/${GITHUB_BASE_REF}...HEAD`)
4. Parse diff via `parseDiff()` from `@pocolente/core`
5. Register scanners (SecretsScanner from `@pocolente/scanner-security`)
6. Run scanners via `runScanners()`
7. Process: dedup, filter, compute status
8. Render comment via `renderComment()`, post via GitHub client, set commit status
9. Set outputs (`status`, `finding-count`), call `core.setFailed()` if status is "block"

- [ ] **Step 2: Create `action.yml`**

Inputs: github-token (required, default `${{ github.token }}`), config-path (optional, default `.pocolente.yml`).
Outputs: status, finding-count.
Runs: using node20, main dist/index.js.
Branding: icon "eye", color "green".

- [ ] **Step 3: Build the action**

Run: `pnpm --filter @pocolente/github-action build`
Expected: dist/index.js created

- [ ] **Step 5: Commit**

```bash
git add packages/github-action/
git commit -m "feat(action): implement GitHub Action entry point with full scan pipeline"
```

---

## Task 13: CLI — Formatter with Tests

**Files:**
- Create: `packages/cli/src/formatter.ts`
- Create: `packages/cli/tests/formatter.test.ts`
- Create: `packages/cli/vitest.config.ts`

- [ ] **Step 1: Create `packages/cli/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
```

- [ ] **Step 2: Write failing test for formatter**

Create `packages/cli/tests/formatter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatFindings } from "../src/formatter.js";
import type { Finding, ScanStatus } from "@pocolente/core";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    layer: "security", scanner: "test", severity: "block", confidence: 1.0,
    file: "src/config.ts", line: "12", title: "Test finding",
    explanation: "Test explanation", suggestion: "Test suggestion",
    cwe: null, owasp: null, estimatedEnergyImpact: null, rcsDelta: null,
    ...overrides,
  };
}

describe("formatFindings", () => {
  it("shows BLOCKED for block status", () => {
    const output = formatFindings([makeFinding()], "block", 1000);
    expect(output).toContain("BLOCKED");
  });

  it("shows PASS for pass status", () => {
    const output = formatFindings([], "pass", 500);
    expect(output).toContain("PASS");
  });

  it("shows finding title and file location", () => {
    const output = formatFindings([makeFinding({ title: "AWS key found" })], "block", 1000);
    expect(output).toContain("AWS key found");
    expect(output).toContain("src/config.ts:12");
  });

  it("shows duration in seconds", () => {
    const output = formatFindings([], "pass", 5432);
    expect(output).toContain("5.4s");
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `pnpm --filter @pocolente/cli test`
Expected: FAIL — formatter does not exist

- [ ] **Step 4: Implement terminal formatter**

`formatFindings(findings, status, durationMs)`: outputs colored terminal text.
Uses ANSI escape codes: red for block, yellow for warn, dim for info, green for pass.
Shows each finding as: `[BLOCK] Title` / `file:line` / `explanation`.
Footer: status (PASS/BLOCKED), finding count, duration.

- [ ] **Step 5: Run tests — expect PASS**

Run: `pnpm --filter @pocolente/cli test`
Expected: all 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): add terminal formatter with tests"
```

---

## Task 14: CLI — Entry Point

**Files:**
- Create: `packages/cli/src/main.ts`

- [ ] **Step 1: Implement CLI entry point**

Parse args: `pocolente scan [path] [--diff branch] [--layer name] [--format json|text]`
Load config from `.pocolente.yml` in target path.
Compute diff via simple-git (diff against specified branch or working tree fallback).
Parse diff via `parseDiff()` from `@pocolente/core`.
Register scanners, run, process, format output.
Exit code: 0 for pass, 1 for block.

- [ ] **Step 2: Build CLI**

Run: `pnpm --filter @pocolente/cli build`
Expected: dist/main.js created with shebang

- [ ] **Step 3: Test CLI locally**

Run: `node packages/cli/dist/main.js scan --format json`
Expected: JSON output with status "pass" and 0 findings

- [ ] **Step 4: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): implement CLI entry point"
```

---

## Task 15: Dogfooding Config and CI Workflow

**Files:**
- Create: `.pocolente.yml`
- Create: `.github/workflows/pocolente.yml`

- [ ] **Step 1: Create `.pocolente.yml`**

```yaml
version: 1
severity_threshold: warn
block_pr_on: block
scan_paths:
  include: ["packages/**"]
  exclude: ["**/*.test.*", "**/fixtures/**", "**/dist/**"]
security:
  secrets:
    severity: block
```

- [ ] **Step 2: Create GitHub Actions workflow**

`.github/workflows/pocolente.yml`:
- Triggers on: pull_request to main
- Permissions: contents read, pull-requests write, statuses write
- Steps: checkout (fetch-depth 0), setup pnpm, setup node 20, pnpm install, pnpm build, run ./packages/github-action

- [ ] **Step 3: Commit**

```bash
git add .pocolente.yml .github/
git commit -m "ci: add Pocolente QA self-scan workflow (dogfooding)"
```

---

## Task 16: Full Build Verification

- [ ] **Step 1: Clean build**

Run: `pnpm -r build`
Expected: all packages build successfully

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: all tests pass

- [ ] **Step 3: Test CLI end-to-end**

Run: `node packages/cli/dist/main.js scan --format json`
Expected: JSON with "status": "pass" and empty findings

- [ ] **Step 4: Verify Action bundle exists**

Run: `ls -la packages/github-action/dist/index.js`
Expected: bundled JS file exists

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: Stage 0 complete — foundation with secrets scanner end-to-end"
```

---

## Done Criteria

Stage 0 is complete when:
1. `pnpm test` passes with all unit tests green
2. `pnpm -r build` succeeds for all packages
3. `node packages/cli/dist/main.js scan` runs successfully
4. `packages/github-action/dist/index.js` exists and is bundled
5. `.github/workflows/pocolente.yml` is committed for dogfooding
6. `.pocolente.yml` is committed for self-scanning
