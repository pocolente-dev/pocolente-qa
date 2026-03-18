# Pocolente QA Harness — Stage 5: Runtime Profiling Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add runtime profiling that measures actual resource consumption (CPU time, peak memory, wall-clock time) when running a project's test suite, enabling formal SCI scoring and base-vs-PR comparison. Also includes performance optimizations and scanner hardening.

**Architecture:** New `RuntimeProfiler` in `@pocolente/core` that runs a configurable test command and measures Node.js process metrics. An `OpenSandboxClient` adapter wraps the Alibaba OpenSandbox API for isolated execution (tested with mocks — requires running OpenSandbox instance for real use). The profiler runs tests twice (base branch, PR branch) and computes resource deltas. Results feed into a formal SCI calculator and are stored in the dashboard.

**Tech Stack:** TypeScript, Node.js `child_process` for local profiling, `fetch` for OpenSandbox API. No new dependencies.

**Pragmatic scope:** Full OpenSandbox integration requires a running instance (Docker/K8s). This plan builds the complete client and profiler with mockable interfaces so it works locally (via child_process) and can switch to OpenSandbox when infrastructure is available. The SCI calculator uses measured CPU time as the energy proxy until hardware-level telemetry (RAPL) is available.

---

## File Map

### `packages/core/` (new/modified)

| File | Responsibility |
|---|---|
| `src/profiler.ts` | Run test command, measure CPU/memory/time |
| `src/sci.ts` | Formal SCI score from measured metrics |
| `src/index.ts` | Export new modules |
| `tests/profiler.test.ts` | Profiler tests |
| `tests/sci.test.ts` | SCI calculator tests |

### `packages/scanner-greenops/` (new)

| File | Responsibility |
|---|---|
| `src/runtime-profiler-scanner.ts` | Scanner that runs profiler, compares base vs PR |
| `tests/runtime-profiler-scanner.test.ts` | Runtime profiler scanner tests |

### `packages/dashboard/` (modified)

| File | Responsibility |
|---|---|
| `src/db.ts` | Add runtime_metrics table |

---

## Task 1: Runtime Profiler (TDD)

Core utility that executes a command and measures resource usage.

**Files:**
- Create: `packages/core/src/profiler.ts`
- Create: `packages/core/tests/profiler.test.ts`

Tests:
1. `profileCommand("node -e \"process.exit(0)\"")` returns metrics with cpuMs >= 0, peakMemoryMb >= 0, wallClockMs >= 0, exitCode 0
2. `profileCommand("node -e \"process.exit(1)\"")` returns exitCode 1 (doesn't throw)
3. `profileCommand("nonexistent-command")` returns error field set
4. Metrics include stdout/stderr capture

Implementation:
- Spawn command via `child_process.spawn`
- Measure wall clock via `performance.now()` delta
- Parse `/proc/[pid]/status` for VmHWM (peak memory) on Linux, or use `process.memoryUsage()` fallback
- CPU time from `process.cpuUsage()` or `/proc/[pid]/stat`
- Return `ProfileResult { cpuMs, peakMemoryMb, wallClockMs, exitCode, stdout, stderr, error }`

Commit: `feat(core): add runtime profiler for test command measurement`

---

## Task 2: SCI Score Calculator (TDD)

Formal Software Carbon Intensity score from measured metrics.

**Files:**
- Create: `packages/core/src/sci.ts`
- Create: `packages/core/tests/sci.test.ts`

SCI formula: `SCI = ((E × I) + M) / R`
- E = energy consumed (kWh) — estimated from CPU time: `cpuMs / 1000 / 3600 * TDP_WATTS / 1000`
- I = grid carbon intensity (gCO2/kWh) — configurable, default 400 (EU average)
- M = embodied emissions (gCO2) — configurable constant, default 0 for simplicity
- R = functional unit count — default 1 (per test run)

Tests:
1. `computeSci({ cpuMs: 3600000, gridIntensity: 400 })` → energy ~= TDP * 1h, SCI = E * I
2. Returns 0 for 0 CPU time
3. Computes delta between two SCI scores
4. Formats SCI with units (gCO2eq/R)

Commit: `feat(core): add formal SCI score calculator from measured metrics`

---

## Task 3: Runtime Profiler Scanner (TDD)

Scanner that runs the profiler on base and PR branches, computes deltas.

**Files:**
- Create: `packages/scanner-greenops/src/runtime-profiler-scanner.ts`
- Create: `packages/scanner-greenops/tests/runtime-profiler-scanner.test.ts`

Tests (using mock profiler):
1. Reports finding when CPU time increases >20% (configurable threshold)
2. Reports finding when memory increases >25%
3. Reports info finding with metrics summary when within thresholds
4. Returns empty when `runtimeProfiling.enabled` is false (default)
5. Handles profiler errors gracefully (info finding, no crash)

Implementation:
- Check `config.runtimeProfiling.enabled` — skip if false
- Run `config.runtimeProfiling.testCommand` via profiler
- Compare against baseline (stored in `.pocolente/baseline-metrics.json` or fetched from dashboard)
- For MVP: just profile the current state and report absolute metrics (no base comparison yet — that requires git checkout of base branch which is complex)
- Report findings with actual CPU/memory/time metrics

Commit: `feat(greenops): add Runtime Profiler Scanner with resource measurement`

---

## Task 4: Dashboard — Runtime Metrics Storage

**Files:**
- Modify: `packages/dashboard/src/db.ts`
- Modify: `packages/dashboard/tests/db.test.ts`

Add `runtime_metrics` columns to the `scans` table (or a separate table):
```sql
ALTER TABLE scans ADD COLUMN cpu_ms REAL;
ALTER TABLE scans ADD COLUMN peak_memory_mb REAL;
ALTER TABLE scans ADD COLUMN wall_clock_ms REAL;
ALTER TABLE scans ADD COLUMN sci_score REAL;
```

Update `insertScan` to accept optional runtime metrics.
Update trends endpoint to include runtime metrics when present.

Commit: `feat(dashboard): add runtime metrics storage`

---

## Task 5: Performance Optimization — Incremental Scanning

**Files:**
- Modify: `packages/core/src/orchestrator.ts`

Add scan path filtering: before running scanners, filter `context.diff` files against `config.scanPaths.include` and `config.scanPaths.exclude` patterns. Currently scanners individually check file extensions, but the orchestrator should pre-filter to avoid unnecessary work.

Implementation:
- Use `minimatch` or simple glob matching against `scanPaths.include` / `scanPaths.exclude`
- Filter `context.diff` before passing to scanners
- Add timing logs per scanner for performance visibility

Tests:
- Diff with files matching exclude pattern → filtered out before scanners run
- Diff with files matching include pattern → passed through

Commit: `feat(core): add scan path pre-filtering in orchestrator`

---

## Task 6: Wire + Verify

- Register RuntimeProfilerScanner in Action and CLI (disabled by default via config)
- Pass runtime metrics to dashboard POST when available
- Run `pnpm test` — report count
- Run `pnpm -r build`
- Final commit

---

## Done Criteria

Stage 5 is complete when:
1. `profileCommand()` measures CPU, memory, wall clock for any command
2. `computeSci()` calculates formal SCI from measured metrics
3. RuntimeProfilerScanner runs test suite and reports resource metrics (when enabled)
4. Dashboard stores and returns runtime metrics
5. Orchestrator pre-filters files by scan paths
6. All tests pass
