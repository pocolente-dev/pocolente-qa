# Pocolente QA

**The calm, deliberate pause between code written and code deployed.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 20](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)
[![Tests: 245 passing](https://img.shields.io/badge/Tests-245%20passing-brightgreen.svg)](#)

<!-- HERO IMAGE
Generate with nanobanana:
"A minimal, elegant banner illustration for an open-source developer tool called Pocolente QA. The concept is 'festina lente' (make haste slowly). Show a stylized magnifying glass or lens examining code, with three subtle colored layers representing security (red/coral), correctness (blue), and energy efficiency (green). Clean white background, modern flat design, no text in the image, wide aspect ratio suitable for a GitHub README hero banner (1280x400)."
-->
<!-- ![Pocolente QA Hero Banner](docs/images/hero-banner.png) -->

---

## What is this?

Pocolente QA is an open-source CI/CD quality gate that scans pull requests for **correctness**, **security**, and **energy efficiency**. It runs as a GitHub Action or standalone CLI and blocks merge until your standards are met.

The name comes from *festina lente* — make haste slowly. Pocolente is the deliberate pause that catches what speed missed, without slowing you down.

## Key Features

### Security

- **Secrets Scanner** — AWS keys, GitHub tokens, PEM files, JWTs, database URLs, high-entropy strings
- **OWASP Pattern Scanner** — SQL injection, XSS, path traversal, SSRF, insecure deserialization (CWE-mapped)
- **Supply Chain Scanner** — typosquatting detection, OSV vulnerability database, lockfile analysis
- **Permissions Scanner** — Kubernetes RBAC wildcards, Docker root containers, missing USER directives

### Correctness

- **Generation Quality Scanner** — empty catch blocks, console statements in production, unlinked TODOs
- **Dead Code Scanner** — unused imports, unreachable code after return/throw
- **Behavioral Drift Scanner** — removed exports, changed function signatures, breaking API changes
- **Coverage Delta Scanner** — test coverage decrease detection with configurable thresholds

### GreenOps

- **Complexity Scanner** — nested loops (O(n²)), N+1 database queries, quadratic string concatenation
- **Resource Scanner** — sync I/O in async contexts, unbounded array growth in infinite loops
- **Infrastructure Bloat Scanner** — fat Docker images, missing K8s resource limits, `:latest` tags
- **Runtime Profiler** — CPU time, peak memory, wall-clock measurement, SCI score estimation

## Quick Start

### CLI

```bash
# Install
npm install -g @pocolente/cli

# Initialize config
pocolente init

# Scan your project
pocolente scan
```

Or run without installing:

```bash
npx @pocolente/cli scan
```

### GitHub Action

Add this to `.github/workflows/pocolente.yml`:

```yaml
name: Pocolente QA
on:
  pull_request:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pocolente-dev/pocolente-qa@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

The action posts a structured PR comment with findings grouped by severity, sets commit status (pass/block), and provides copy-paste fix suggestions.

<!-- PR COMMENT SCREENSHOT
Generate with nanobanana:
"A realistic screenshot mockup of a GitHub pull request comment from a bot called Pocolente QA. The comment shows a summary table with three rows: Security (green checkmark, 0 findings), Correctness (yellow warning, 2 findings), GreenOps (red X, 1 finding). Below is a collapsible finding detail showing an N+1 query detected in src/services/recommendation.ts with a code diff suggestion. Dark theme GitHub UI, clean typography, realistic PR comment styling (1200x700)."
-->
<!-- ![PR Comment Example](docs/images/pr-comment-example.png) -->

## Configuration

Create `.pocolente.yml` in your repo root. Zero-config works out of the box with sensible defaults.

```yaml
version: 1

# Block PRs only on block-level findings
severity_threshold: warn
block_pr_on: block

# What to scan
scan_paths:
  include: ["src/**", "lib/**", "packages/**"]
  exclude: ["**/*.test.*", "**/*.spec.*", "vendor/**"]

# Security layer
security:
  secrets:
    severity: block         # Always block on exposed secrets
  owasp:
    severity: block
  supply_chain:
    severity: warn

# Correctness layer
correctness:
  dead_code:
    severity: warn
  behavioral_drift:
    severity: block         # Breaking API changes block

# GreenOps layer
greenops:
  complexity:
    severity: warn
    n_plus_one_severity: warn
  sci_score:
    severity: info
    functional_unit: "per request"

# Runtime profiling (opt-in)
runtime_profiling:
  enabled: false
  test_command: "npm test"
  warn_on_cpu_increase_percent: 20
  warn_on_energy_increase_percent: 15
```

See the full configuration reference in the [design specification](docs/superpowers/specs/2026-03-17-pocolente-qa-harness-design.md#configuration-format).

## Scanner Reference

| Scanner | Layer | Detects | CWE |
|---|---|---|---|
| Secrets | Security | Hardcoded credentials, API keys, tokens | CWE-798 |
| OWASP Patterns | Security | SQL injection, XSS, path traversal, SSRF | CWE-89, 79, 22, 918, 502 |
| Supply Chain | Security | Typosquatting, vulnerable dependencies | CWE-829 |
| Permissions | Security | Over-permissioned K8s/Docker configs | CWE-250 |
| Generation Quality | Correctness | Empty catches, console in prod, bare TODOs | CWE-390 |
| Dead Code | Correctness | Unused imports, unreachable code | — |
| Behavioral Drift | Correctness | Removed exports, changed signatures | — |
| Coverage Delta | Correctness | Test coverage decrease | — |
| Complexity | GreenOps | O(n²) loops, N+1 queries, quadratic concat | — |
| Resource | GreenOps | Sync I/O in async, unbounded growth | — |
| Infrastructure Bloat | GreenOps | Fat images, missing limits, `:latest` tags | — |
| Runtime Profiler | GreenOps | CPU/memory/energy regression | — |

## RCS & SCI Scoring

Each scan produces a **Repo Confidence Score (RCS)** — a weighted aggregate across all three layers indicating overall PR quality.

The GreenOps layer calculates a **Software Carbon Intensity (SCI)** delta per PR using the Green Software Foundation formula:

```
SCI = ((E × I) + M) per R
```

Where **E** = energy consumed (estimated from complexity proxies or measured via runtime profiling), **I** = carbon intensity of the grid, **M** = embodied carbon of hardware, and **R** = your functional unit (e.g., per request). The SCI delta shows whether a PR makes your software more or less energy efficient.

<!-- CLI OUTPUT SCREENSHOT
Generate with nanobanana:
"A terminal screenshot showing the output of a CLI tool called 'pocolente scan'. Dark terminal background (e.g. Dracula or One Dark theme). The output shows colored scan results: a green 'Security: PASS' line, a yellow 'Correctness: 2 warnings' line with indented findings, and a red 'GreenOps: 1 block' line with an N+1 query finding. At the bottom, a summary line showing 'SCI delta: +0.08 per request' with a small bar chart. Clean monospace font, realistic terminal styling (1000x600)."
-->
<!-- ![CLI Output](docs/images/cli-output.png) -->

## Architecture

```
pocolente/
├── packages/
│   ├── core/                  # Types, config parser, severity engine, PR renderer
│   ├── scanner-security/      # Secrets, OWASP, Supply Chain, Permissions
│   ├── scanner-correctness/   # Generation Quality, Dead Code, Drift, Coverage
│   ├── scanner-greenops/      # Complexity, Resource, Infra Bloat, Runtime Profiler
│   ├── github-action/         # GitHub Action entry point
│   ├── cli/                   # Standalone CLI (pocolente scan)
│   └── dashboard/             # Web dashboard (Phase 3+)
├── fixtures/                  # Test fixtures per scanner
├── docs/                      # Specs, plans, roadmap
└── .pocolente.yml             # Dogfooding: Pocolente scans itself
```

Built with TypeScript, pnpm workspaces, Zod, tree-sitter, Octokit, and Vitest.

<!-- ARCHITECTURE DIAGRAM
Generate with nanobanana:
"A clean architecture diagram for a monorepo called Pocolente QA. Show 7 package boxes arranged in layers: at the top, 'github-action' and 'cli' side by side as entry points. In the middle layer, three scanner packages side by side: 'scanner-security' (coral), 'scanner-correctness' (blue), 'scanner-greenops' (green). At the bottom, 'core' as the foundation that all packages depend on. A 'dashboard' package sits to the side connected to core. Arrows flow downward showing dependencies. Minimal flat design, white background, subtle drop shadows, modern developer documentation style (1000x600)."
-->
<!-- ![Architecture Diagram](docs/images/architecture-diagram.png) -->

## Contributing

Contributions are welcome. To get started:

```bash
git clone https://github.com/pocolente-dev/pocolente-qa.git
cd pocolente-qa
pnpm install
pnpm test
```

The test suite covers all 12 scanners with real-world fixture files. When adding a new scanner or rule, include fixture files that demonstrate the pattern being detected.

For larger changes, open an issue first to discuss the approach. See the [expansion roadmap](docs/EXPANSION-ROADMAP.md) for ideas on where to contribute.

## License

[MIT](LICENSE) — Mohammad Asjad

## Links

- [Design Specification](docs/superpowers/specs/2026-03-17-pocolente-qa-harness-design.md)
- [Expansion Roadmap](docs/EXPANSION-ROADMAP.md)
- [Brand Philosophy](docs/Pocolente%20and%20Pocolentes_%20Linguistic%20Etymology%2C%20Psychological%20Resonance%2C%20and%20Digital%20Product%20Strategy.md)
