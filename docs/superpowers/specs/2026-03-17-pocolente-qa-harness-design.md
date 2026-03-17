# Pocolente QA — The Harness: Design Specification

## Product Identity

Pocolente QA is an open-source CI/CD quality gate (GitHub Action + CLI) that automatically verifies pull requests against three pillars: **correctness**, **security**, and **energy efficiency (GreenOps)**. It blocks merge until standards are met.

The product embodies the *festina lente* philosophy — it is the calm, deliberate pause between "code written" and "code deployed." It does not slow developers down; it catches what speed missed.

The GreenOps layer is the core differentiator. No competitor offers energy efficiency scanning in CI. This is backed by EU regulatory pressure: CSRD (mandatory sustainability reporting for ~50,000 companies), EU AI Act (energy disclosure), and EED (data center energy reporting).

## Target Audience

- Primary: developers and engineers frustrated with noisy, bloated tooling
- Secondary: DevOps leads and engineering managers who want quality gates without enterprise overhead
- Tertiary (Phase 3+): CTOs and sustainability officers in EU companies needing CSRD-compliant reporting
- Beachhead market: Dutch and broader European tech ecosystem

## Core Loop

```
PR opened/updated
    -> Pocolente Harness triggers
    -> Runs 3 scan layers in parallel (correctness, security, GreenOps)
    -> Posts structured PR comment ("lens view")
    -> Sets commit status: pass / warn / block
    -> If blocked: developer sees exactly what to fix
```

## Architecture

### Monorepo Structure

```
pocolente/
├── packages/
│   ├── core/                  # Shared types, config parser, finding schema, severity engine
│   ├── scanner-correctness/   # Layer 1 scanners
│   ├── scanner-security/      # Layer 2 scanners
│   ├── scanner-greenops/      # Layer 3 scanners
│   ├── github-action/         # GitHub Action entry point, PR comment renderer
│   ├── cli/                   # Standalone CLI (pocolente scan .)
│   └── dashboard/             # Web dashboard (Phase 3+)
├── fixtures/                  # Test fixtures: real-world code samples per scanner
├── docs/
├── .pocolente.yml             # Dogfooding: Pocolente scans itself
└── package.json               # Workspace root (pnpm workspaces)
```

### Tech Stack

- **Language:** TypeScript throughout
- **Runtime:** Node.js (native GitHub Action execution, no container build step)
- **AST Parsing:** node-tree-sitter + language grammars (TS/JS, Python, Java, Go, Rust)
- **GitHub Integration:** Octokit (official GitHub SDK)
- **Config Validation:** Zod
- **Git Operations:** simple-git
- **No LLM dependency in core.** Optional LLM-enhanced mode for AI Slop Detection (user provides API key). Core pipeline is deterministic, fast, and free of API cost.

### Key Dependencies

| Dependency | Purpose |
|---|---|
| `node-tree-sitter` + grammars | Multi-language AST parsing |
| `octokit` | GitHub API (PR comments, commit status, diffs) |
| `zod` | Config schema validation |
| `yaml` | YAML parser |
| `semver` | Version comparison for dependency audit |
| `simple-git` | Git diff computation |

### Performance Budget

Full scan must complete in under 60 seconds for a typical PR (<500 lines, <50 files). Per-scanner timeout: 15s default, configurable. Timeout produces `info`-level "scan incomplete," never blocks the PR.

## The Three Scan Layers

### Layer 1: Correctness

Catches bugs, logic errors, type issues, and regressions — especially patterns common in AI-generated code.

| Scanner | What it does | How it works |
|---|---|---|
| **Test Coverage Delta** | Detects if PR reduces coverage or adds untested code | Integrates with coverage tools (Istanbul, coverage.py, JaCoCo). Compares base vs PR branch. Configurable threshold (default: no >2% decrease). |
| **Dead Code Detector** | Flags unreachable code, unused imports/functions introduced by PR | tree-sitter AST parsing. Cross-references new symbols against all usage in repo. |
| **Behavioral Drift Analyzer** | Detects breaking API contract changes | Extracts public interface (exports, signatures, types) before/after. Flags removed params, changed return types. |
| **AI Slop Detector** | Identifies low-quality AI-generation patterns | Rule-based: empty catch blocks, console.log in prod, duplicate code, TODO without tracking, inconsistent naming. Optional LLM-enhanced mode. |
| **Dependency Audit** | Flags unmaintained, vulnerable, or heavy new dependencies | Parses lockfile diffs. Checks OSV database, npm/PyPI metadata, bundle size impact. |

### Layer 2: Security

Catches vulnerabilities, secrets, insecure patterns, and compliance violations.

| Scanner | What it does | How it works |
|---|---|---|
| **Secrets Scanner** | Detects committed credentials, API keys, tokens | PR diff scanning. Curated regex (AWS, GCP, GitHub, Stripe, PEM, DB URLs, JWTs, Slack). Entropy fallback for unknowns. Allowlist support. |
| **OWASP Pattern Scanner** | Flags OWASP Top 10 patterns | AST-based rules per language: SQL injection, XSS, path traversal, SSRF, insecure deserialization. Each rule has CWE mapping + fix suggestion. |
| **Permission & Scope Analyzer** | Detects over-permissioned configs | Parses Terraform, K8s manifests, Dockerfiles. Flags wildcards, root containers, broad CORS. |
| **Supply Chain Scanner** | Evaluates new deps for supply chain risk | Typosquatting (Levenshtein), install scripts, maintainer changes, provenance attestations. |
| **EU Compliance Flags** | Flags EU regulatory risks (opt-in) | GDPR: PII logging, non-EU endpoints. AI Act: missing energy logging. Accessibility: missing ARIA, alt text, contrast. Default `info` severity. |

### Layer 3: GreenOps (Energy Efficiency)

The differentiator. No other CI tool does this. Operates on static analysis (proxy metrics) with optional runtime profiling.

| Scanner | What it does | How it works |
|---|---|---|
| **Algorithmic Complexity Analyzer** | Detects complexity regressions | AST patterns: nested loops on collections, N+1 queries, quadratic string concat, unmemorized recursion. Reports complexity class change. |
| **Resource Allocation Profiler** | Flags wasteful resource patterns | Unbounded collection growth, missing cleanup (streams/connections), polling where events exist, sync blocking in async context. |
| **Infrastructure Bloat Detector** | Catches over-provisioned infra | Dockerfile: base image size, unnecessary copies. K8s: resource request/limit ratio, missing HPA. Docker-compose: missing limits. |
| **Carbon-Aware Scheduling Hints** | Suggests cleaner scheduling | Optional Electricity Maps API. Reports grid carbon intensity, suggests lower-carbon regions/times. Advisory only (`info`). |
| **SCI Score Estimator** | Calculates Software Carbon Intensity delta | GSF SCI formula: ((E x I) + M) per R. E estimated from complexity proxies. Reports SCI delta per PR + trend badge (green/yellow/red). |

#### Runtime Profiling (Phase 2, opt-in)

Runs PR test suite in metered environment. Measures CPU time, peak memory, I/O ops, wall-clock time, energy estimate (RAPL if available). Compares against base branch.

## Finding Output Format

Each finding follows a consistent schema:

```yaml
layer: greenops
scanner: algorithmic-complexity-analyzer
severity: warn          # block | warn | info
confidence: 0.88        # 0.0 - 1.0
file: src/services/recommendation.ts
line: 89-104
title: "N+1 query pattern: database call inside loop"
explanation: "getUserPreferences() executes a separate DB query for each item..."
suggestion: "Batch the user IDs and fetch all preferences in one query..."
cwe: null               # CWE ID if applicable (security layer)
owasp: null             # OWASP category if applicable
estimated_energy_impact: "high"   # GreenOps layer
sci_delta: "+0.12 per request"    # GreenOps layer
```

## Configuration Format

`.pocolente.yml` in repo root. Zero-config works out of the box with sensible defaults.

```yaml
version: 1

# Global
severity_threshold: warn
block_pr_on: block
scan_paths:
  include: ["src/**", "lib/**", "packages/**"]
  exclude: ["**/*.test.*", "**/*.spec.*", "vendor/**"]

# Layer 1: Correctness
correctness:
  enabled: true
  coverage:
    enabled: true
    max_decrease_percent: 2.0
    coverage_command: "npm run test:coverage"
    coverage_format: "lcov"
  dead_code:
    enabled: true
    severity: warn
  behavioral_drift:
    enabled: true
    severity: block
  ai_slop:
    enabled: true
    severity: warn
    llm_enhanced: false
    llm_provider: "anthropic"
  dependencies:
    enabled: true
    severity: warn
    max_age_days: 730
    block_on_critical_cve: true

# Layer 2: Security
security:
  enabled: true
  secrets:
    enabled: true
    severity: block
    custom_patterns: []
  owasp:
    enabled: true
    severity: block
    rules:
      injection: block
      xss: block
      broken_auth: warn
      ssrf: warn
      path_traversal: block
      insecure_deserialization: block
  permissions:
    enabled: true
    severity: warn
  supply_chain:
    enabled: true
    severity: warn
    block_on_install_scripts: false
  eu_compliance:
    enabled: false
    gdpr: true
    ai_act: true
    accessibility: true

# Layer 3: GreenOps
greenops:
  enabled: true
  complexity:
    enabled: true
    severity: warn
    n_plus_one_severity: warn
  resources:
    enabled: true
    severity: warn
  infrastructure:
    enabled: true
    severity: warn
    max_base_image_mb: 200
  carbon_aware:
    enabled: true
    severity: info
    electricity_maps_api_key: ""
  sci_score:
    enabled: true
    severity: info
    functional_unit: "per request"

# Runtime profiling (Phase 2)
runtime_profiling:
  enabled: false
  test_command: "npm test"
  warn_on_cpu_increase_percent: 20
  warn_on_memory_increase_percent: 25
  warn_on_energy_increase_percent: 15

# Reporting
reporting:
  dashboard_url: ""
  dashboard_api_key: ""
  sarif_output: false
  json_output: false
```

## PR Comment UX — The "Lens View"

The PR comment is the primary user interface. Design principles:

1. **Summary table first** — 5-second scan for pass/fail per layer
2. **Blocking issues at top** — highest severity first
3. **Collapsible findings** — each is a self-contained "lens" that opens independently
4. **Diff-style suggestions** — show the exact fix, copy-paste-ready
5. **Metadata is secondary** — CWE/OWASP codes and confidence scores present but not dominant
6. **No noise** — `info` findings only in collapsed "Informational" section at bottom

Structure:
- Summary table (layer / finding count / status)
- Result line (pass or blocked with reason)
- Collapsible `<details>` for each finding, ordered by severity
- Footer: SCI badge, scan duration, dashboard link

## CLI

```bash
pocolente scan              # Scan working directory
pocolente scan src/api/     # Scan specific path
pocolente scan --layer greenops  # Single layer
pocolente scan --diff main  # Scan diff against branch
pocolente scan --format json     # JSON output
pocolente init              # Generate .pocolente.yml interactively
pocolente sci --trend       # SCI score trend
```

Same scanner engine as GitHub Action. Same code path, same results. Different output formatting (terminal vs markdown).

Install: `npm install -g @pocolente/cli` or `npx @pocolente/cli scan`

## Monetization

**Phase 1-2:** Free and open-source (MIT). Goal is adoption.

**Phase 3+:** Premium SaaS dashboard.

| Feature | Free (OSS) | Premium |
|---|---|---|
| All 3 scan layers | Yes | Yes |
| PR comments + commit status | Yes | Yes |
| CLI | Yes | Yes |
| SARIF export | Yes | Yes |
| Historical trend dashboard | — | Yes |
| SCI score tracking over time | — | Yes |
| Team GreenOps leaderboard | — | Yes |
| CSRD-compliant export reports | — | Yes |
| Runtime profiling (metered sandbox) | — | Yes |
| LLM-enhanced AI Slop Detection | — | Yes |
| Org-wide policy enforcement | — | Yes |
| Slack/Teams notifications | — | Yes |

Pricing (tentative):
- Free: Unlimited public repos. 3 private repos.
- Pro: EUR 12/month per repo.
- Team: EUR 8/month per repo (min 5).
- Enterprise: Custom.

## Staged Implementation Roadmap

### Stage 0: Foundation (Week 1-2)

**Goal:** Monorepo skeleton, core types, config parser, scanner plugin interface, one scanner (Secrets) working end-to-end through GitHub Action.

**Deliverables:**
- Monorepo scaffolding (pnpm workspaces)
- `@pocolente/core`:
  - Types: `Finding`, `ScanLayer`, `Severity`, `ScannerResult`, `PocolenteConfig`
  - `.pocolente.yml` parser (Zod schema + defaults)
  - Scanner plugin interface: `Scanner { id, layer, scan(context): Promise<Finding[]> }`
  - `ScanContext`: diff, parsed ASTs, config, repo metadata
  - Finding deduplication + severity filtering
  - PR comment markdown renderer
- `@pocolente/github-action`:
  - `action.yml` manifest
  - Entry: checkout, diff, config, run scanners, post comment, set status
  - Secrets Scanner wired in (regex-based, no AST)
- `@pocolente/cli`:
  - `pocolente scan` (terminal output)
  - `pocolente init` (generate default config)
- Dogfooding: Pocolente runs on its own PRs
- Tests: config parser, finding schema, severity engine, secrets regex

**Done when:** PR to Pocolente repo triggers Action, Secrets Scanner runs, PR comment appears, commit status set. CLI produces same results locally.

### Stage 1: Security Layer (Week 3-5)

**Goal:** Credible security scanner worth installing.

**Deliverables:**
- Secrets Scanner hardened: expanded patterns (AWS AKIA, GCP AIza, GitHub ghp_/gho_/ghs_, Stripe sk_live_, PEM, DB URLs, JWTs, Slack webhooks), allowlist, entropy fallback
- OWASP Pattern Scanner: tree-sitter integration (TS/JS, Python, Java, Go), AST rules for SQL injection, XSS, path traversal, SSRF, insecure deserialization. CWE mappings + fix suggestions.
- Supply Chain Scanner: lockfile diff parser (package-lock.json, yarn.lock), OSV API, npm metadata, typosquatting detector
- SARIF output (GitHub Security tab integration)
- PR comment updated for security findings with CWE/OWASP badges

**Done when:** Test repo with intentional vulnerabilities — all caught, PR blocked, findings actionable.

### Stage 2: Correctness Layer (Week 6-8)

**Goal:** Catch bugs that AI-generated code specifically introduces.

**Deliverables:**
- Dead Code Detector: AST-based, cross-reference new symbols against usage
- Behavioral Drift Analyzer: public API surface diff (exports, signatures, types)
- AI Slop Detector: empty catches, console.log in prod, duplicate code, TODO without tracking, inconsistent naming. Optional LLM mode.
- Dependency Audit: extend to Python (Pipfile.lock, poetry.lock) and Go (go.sum). Bundle size impact for JS.
- Test Coverage Delta: parse lcov/istanbul/cobertura, compare base vs PR

**Done when:** Test repo with dead code, breaking API change, empty catches, coverage drop — all caught accurately.

### Stage 3: GreenOps Layer — Static (Week 9-12)

**Goal:** Ship the differentiator.

**Deliverables:**
- Algorithmic Complexity Analyzer: nested loops, N+1 queries, quadratic string concat, unmemoized recursion
- Resource Allocation Profiler: missing cleanup, unbounded growth, polling vs events, sync in async
- Infrastructure Bloat Detector: Dockerfile image size, K8s resource analysis, docker-compose limits
- SCI Score Estimator: GSF formula with static proxies, delta per PR, trend badge
- Carbon-Aware Scheduling Hints: Electricity Maps integration (optional), regional carbon data

**Done when:** Test repo with N+1 query, bloated Docker image, resource leak — all caught. SCI delta shown in PR comment.

### Stage 4: Dashboard MVP (Week 13-16)

**Goal:** Web dashboard for trends, team insights, premium tier.

**Deliverables:**
- Backend API (Hono/Express): scan ingestion, trend queries, SCI history, org overview. Auth: GitHub OAuth. Storage: PostgreSQL (Neon/Supabase).
- Frontend (Next.js): repo overview, finding drilldown, GreenOps dashboard, SCI trend, team view, CSRD export
- GitHub App upgrade (from Action token to App installation)

**Done when:** Developer installs Action, connects dashboard via GitHub OAuth, sees scan history and SCI trend, generates CSRD export.

### Stage 5: Runtime Profiling (Week 17-20)

**Goal:** Actual resource measurement for teams that want it.

**Deliverables:**
- Self-hosted runner support with RAPL/Scaphandre/Kepler documentation
- E2B integration for metered sandbox execution
- Resource comparison: CPU, memory, I/O, energy vs base branch
- Scanner false-positive tuning, performance optimization (AST caching, incremental scan)

### Stage 6: Expansion (Week 21+)

Choose based on user demand:
- GitLab / Bitbucket support
- Slack/Teams notifications
- Org-wide policy engine
- VS Code extension (real-time lens view)
- Agentic auto-fix (generate fix PRs)
- Jira integration (findings -> tickets -> agent fixes)

This stage is where the product begins evolving toward the full Pocolente QA Agentic Edition from the original PRD.
