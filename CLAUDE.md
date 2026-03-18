# Pocolente QA — Project Instructions

## Git Identity

Always use the following git identity for all commits in this project:

```
git config user.name "Mohammad Asjad"
git config user.email "asjad.august@gmail.com"
```

If the local git config does not already have these values set, configure them before committing.

## Project Overview

Pocolente QA is an open-source CI/CD quality gate (GitHub Action + CLI) that scans PRs for correctness, security, and energy efficiency (GreenOps).

- **Spec:** `docs/superpowers/specs/2026-03-17-pocolente-qa-harness-design.md`
- **Stage 0 Plan:** `docs/superpowers/plans/2026-03-17-stage0-foundation.md`
- **Tech Stack:** TypeScript, Node.js 20, pnpm workspaces, Zod, Octokit, simple-git, tsup, esbuild, Vitest
- **Monorepo packages:** `core`, `scanner-security`, `scanner-correctness`, `scanner-greenops`, `github-action`, `cli`
- **Stage 5+ Sandbox:** Alibaba OpenSandbox (not E2B) — free, self-hosted, Apache 2.0. See spec Stage 5.
