# Pocolente QA Harness — Stage 3: GreenOps Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the GreenOps differentiator — the scan layer that no competitor has. Detect algorithmic complexity regressions, wasteful resource patterns, infrastructure bloat, and track a Relative Complexity Score (RCS) per PR.

**Architecture:** Creates `@pocolente/scanner-greenops` package with 3 scanners (Algorithmic Complexity, Resource Allocation, Infrastructure Bloat) plus an RCS calculator in `@pocolente/core`. All scanners use regex-based pattern matching on TS/JS source lines and infrastructure files (Dockerfile, K8s YAML, docker-compose). The RCS aggregates weighted findings into a single score delta per PR with a green/yellow/red badge in the PR comment.

**Tech Stack:** TypeScript, Vitest (existing). No new dependencies.

---

## File Map

### `packages/scanner-greenops/` (new package)

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` | Package config |
| `src/index.ts` | Re-exports |
| `src/complexity-scanner.ts` | Nested loops, N+1 queries, quadratic string concat, unmemoized recursion |
| `src/resource-scanner.ts` | Missing cleanup, unbounded growth, sync blocking in async |
| `src/infra-bloat-scanner.ts` | Dockerfile image size, K8s resources, docker-compose limits |
| `tests/complexity-scanner.test.ts` | Complexity tests |
| `tests/resource-scanner.test.ts` | Resource tests |
| `tests/infra-bloat-scanner.test.ts` | Infra bloat tests |

### `packages/core/` (new/modified)

| File | Responsibility |
|---|---|
| `src/rcs.ts` | Relative Complexity Score calculator |
| `tests/rcs.test.ts` | RCS tests |
| `src/renderer.ts` | Modified: add RCS badge to PR comment footer |

---

## Task 1: Scanner-GreenOps Package Scaffolding

**Files:** Create package following scanner-security/scanner-correctness pattern.

- [ ] **Step 1:** Create `packages/scanner-greenops/` with package.json (dep: @pocolente/core), tsconfig, tsup, vitest config, empty src/index.ts
- [ ] **Step 2:** `pnpm install && pnpm --filter @pocolente/scanner-greenops build`
- [ ] **Step 3:** Commit: `feat: scaffold scanner-greenops package`

---

## Task 2: Algorithmic Complexity Scanner (TDD)

**Files:**
- Create: `packages/scanner-greenops/src/complexity-scanner.ts`
- Create: `packages/scanner-greenops/tests/complexity-scanner.test.ts`

Tests for `ComplexityScanner`:
1. Detects nested loop: `.forEach` inside `.forEach` or `for` inside `for`
2. Detects N+1 query: `.query(`, `.findOne(`, `.findUnique(` inside a `for`/`.forEach`/`.map` loop
3. Detects quadratic string concatenation: `string +=` inside a loop
4. Does NOT flag single-level loops
5. Does NOT flag batch query patterns (`.findMany`, `.where().in()`)
6. Only scans TS/JS files
7. Respects `greenops.complexity.enabled` config

Implementation patterns:
- **Nested loops:** Track loop depth via regex. When seeing `for (`, `.forEach(`, `.map(`, `.reduce(`, `while (` — increment depth. When seeing `})` at matching indent — decrement. Flag if depth >= 2 with collection iteration.
- **N+1 queries:** Inside a loop context (tracked above), detect DB call patterns: `.query(`, `.findOne(`, `.findUnique(`, `.findFirst(`, `await.*\.get(`, `.execute(`
- **Quadratic string concat:** Inside loop context, detect `+= ` or `= .* + ` with a string variable on left side

Each finding includes `estimatedEnergyImpact: "high"` and `rcsDelta` weight.

Commit: `feat(greenops): add Algorithmic Complexity Scanner`

---

## Task 3: Resource Allocation Scanner (TDD)

**Files:**
- Create: `packages/scanner-greenops/src/resource-scanner.ts`
- Create: `packages/scanner-greenops/tests/resource-scanner.test.ts`

Tests for `ResourceScanner`:
1. Detects `readFileSync` in async function
2. Detects `writeFileSync` in async context
3. Detects `fs.createReadStream` without `.on('close')` or `.close()` in nearby lines
4. Detects `.push()` inside `while(true)` (unbounded growth)
5. Does NOT flag sync file reads in non-async context
6. Does NOT flag `.push()` inside bounded loops (with break/length check)
7. Only scans TS/JS files
8. Respects `greenops.resources.enabled` config

Implementation:
- **Sync in async:** Detect `readFileSync`, `writeFileSync`, `execSync` on lines within a file that also contains `async function` or `await `
- **Missing cleanup:** Track `createReadStream`, `createWriteStream`, `fs.open`, `.connect(` calls — flag if no `.close()`, `.destroy()`, `.end()`, or `finally` appears within 20 lines
- **Unbounded growth:** Detect `.push(` inside `while (true)` or `while (1)` or `for (;;)` without a break condition

Commit: `feat(greenops): add Resource Allocation Scanner`

---

## Task 4: Infrastructure Bloat Scanner (TDD)

**Files:**
- Create: `packages/scanner-greenops/src/infra-bloat-scanner.ts`
- Create: `packages/scanner-greenops/tests/infra-bloat-scanner.test.ts`

Tests for `InfraBloatScanner`:
1. Detects bloated Docker base image: `FROM node:20` (~900MB) when `node:20-alpine` exists
2. Detects `FROM node:latest` (unversioned = unpredictable + large)
3. Detects missing resource limits in docker-compose
4. Detects K8s containers without resource limits
5. Does NOT flag `FROM node:20-alpine` or `FROM node:20-slim`
6. Does NOT flag docker-compose services with `deploy.resources.limits`
7. Only processes Dockerfile*, docker-compose*, and K8s YAML files

Implementation:
- **Docker base images:** Curated map of common images with sizes and lean alternatives. Flag when `FROM image:tag` exceeds `config.greenops.infrastructure.maxBaseImageMb` (default 200MB).
- **Docker-compose:** Detect `services:` blocks without `deploy:` / `resources:` / `limits:` subsection
- **K8s:** Detect `containers:` blocks without `resources:` / `limits:` subsection

Image size database (subset):
```
node:20 → 900MB, suggest node:20-alpine (120MB)
node:latest → 900MB, suggest node:20-alpine
python:3.12 → 900MB, suggest python:3.12-slim (150MB)
ubuntu:latest → 77MB (OK)
alpine:latest → 7MB (OK)
```

Commit: `feat(greenops): add Infrastructure Bloat Scanner`

---

## Task 5: Relative Complexity Score (TDD)

**Files:**
- Create: `packages/core/src/rcs.ts`
- Create: `packages/core/tests/rcs.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/renderer.ts`

Tests for `computeRcs(findings)`:
1. Returns 0 for empty findings
2. Returns weighted sum: N+1 query finding → +10, nested loop → +5, sync blocking → +3, bloated image → +2
3. Only counts GreenOps layer findings
4. Ignores security/correctness findings

Tests for `rcsBadge(delta, threshold)`:
1. Returns "green" for delta <= 0
2. Returns "yellow" for 0 < delta <= threshold
3. Returns "red" for delta > threshold

Test that renderer includes RCS badge in footer when greenops findings present.

Implementation:
```ts
const RCS_WEIGHTS: Record<string, number> = {
  "complexity-scanner": 5,  // base weight, modified by finding type
  "resource-scanner": 3,
  "infra-bloat-scanner": 2,
};
// N+1 query findings get weight 10 (double the base complexity weight)
```

Modify `renderer.ts`: after the scan duration in the footer, add:
`RCS: [badge] ([+/-delta]) · ` before the scan duration text.

Commit: `feat(core): add Relative Complexity Score calculator with PR comment badge`

---

## Task 6: Wire GreenOps Scanners + Full Verification

**Files:**
- Modify: `packages/github-action/package.json` (add scanner-greenops dep)
- Modify: `packages/cli/package.json` (add scanner-greenops dep)
- Modify: `packages/github-action/src/main.ts`
- Modify: `packages/cli/src/main.ts`

- [ ] **Step 1:** Add `@pocolente/scanner-greenops: workspace:*` to both packages, `pnpm install`
- [ ] **Step 2:** Import and register `ComplexityScanner`, `ResourceScanner`, `InfraBloatScanner`
- [ ] **Step 3:** In the results processing, compute RCS: `const rcs = computeRcs(allFindings)` and pass to renderer
- [ ] **Step 4:** `pnpm -r build`
- [ ] **Step 5:** Run `pnpm test` — report exact count
- [ ] **Step 6:** `node packages/cli/dist/main.js scan --format json`
- [ ] **Step 7:** `git log --oneline -20`
- [ ] **Step 8:** Commit: `feat: wire GreenOps scanners into Action and CLI`
- [ ] **Step 9:** Final verification commit if needed

---

## Done Criteria

Stage 3 is complete when:
1. `pnpm test` passes all tests
2. Complexity Scanner detects nested loops, N+1 queries, quadratic string concat
3. Resource Scanner detects sync-in-async and missing cleanup
4. Infrastructure Bloat Scanner flags oversized Docker images and missing resource limits
5. RCS score appears in PR comment footer with green/yellow/red badge
6. All scanners wired into Action and CLI
