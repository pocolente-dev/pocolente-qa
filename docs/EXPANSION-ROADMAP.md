# Pocolente QA — Expansion Roadmap

Stage 6+ directions for the project. Items are organized by category with complexity estimates (S = days, M = 1-2 weeks, L = 3-4 weeks, XL = 1+ months). Check items off as they ship.

---

## Platform Expansion

Bring Pocolente QA beyond GitHub Actions.

- [ ] **GitLab CI integration** — `.gitlab-ci.yml` template + MR comment renderer (L)
- [ ] **Bitbucket Pipelines integration** — `bitbucket-pipelines.yml` template + PR comment renderer (L)
- [ ] **Azure DevOps Pipelines** — YAML task + PR thread comments via Azure DevOps REST API (L)
- [ ] **Jenkins plugin** — Jenkinsfile step with findings output to Jenkins UI (XL)
- [ ] **Gitea / Forgejo support** — lightweight CI hook for self-hosted Git (M)
- [ ] **Pre-commit hook mode** — run scanners locally before push, no CI required (M)

## Notifications & Integrations

Keep teams informed beyond PR comments.

- [ ] **Slack notifications** — post scan summaries to channels, thread on block (M)
- [ ] **Microsoft Teams webhook** — Adaptive Card with scan results (M)
- [ ] **Discord webhook** — embed with pass/block status and finding counts (S)
- [ ] **Email digest** — daily/weekly summary of scan results across repos (L)
- [ ] **PagerDuty / Opsgenie** — alert on critical security findings (M)
- [ ] **Jira integration** — auto-create tickets from block-level findings (M)
- [ ] **Linear integration** — create issues from findings with scanner metadata (M)
- [ ] **GitHub Discussions bot** — post weekly GreenOps trends to repo Discussions (S)

## Developer Experience

Shift scanning left into the editor.

- [ ] **VS Code extension** — real-time lens view, inline findings, SCI badge in status bar (XL)
- [ ] **JetBrains plugin** — IntelliJ/WebStorm integration with inspection results (XL)
- [ ] **Neovim integration** — LSP diagnostics from Pocolente scanners (L)
- [ ] **GitHub Codespaces devcontainer** — pre-configured `.devcontainer.json` with CLI (S)
- [ ] **Interactive `pocolente fix`** — CLI command that walks through findings and applies suggestions (L)
- [ ] **Watch mode** — `pocolente scan --watch` re-scans on file change during development (M)
- [ ] **SARIF viewer integration** — enhanced GitHub Security tab experience (S)

## Policy & Governance

Enterprise-grade controls for organizations.

- [ ] **Org-wide policy engine** — central `.pocolente-policy.yml` that overrides per-repo config (L)
- [ ] **Role-based configuration** — different severity thresholds for different teams/repos (M)
- [ ] **Audit trail** — immutable log of all scan results, config changes, and overrides (L)
- [ ] **Policy-as-code** — define custom rules in a declarative DSL (XL)
- [ ] **Compliance templates** — pre-built policy sets for SOC 2, ISO 27001, GDPR, CSRD (L)
- [ ] **Allowlist management UI** — dashboard for managing false-positive suppressions (M)
- [ ] **Finding SLA tracking** — track time-to-fix per severity with escalation rules (M)

## Agentic Features

Toward the Pocolente QA Agentic Edition.

- [ ] **Auto-fix PRs** — generate fix branches for block-level findings using LLM (XL)
- [ ] **Jira agent loop** — findings create tickets, agent picks up tickets, generates fixes, submits PRs (XL)
- [ ] **OpenSandbox agent loop** — agent writes code, sandbox executes, Harness verifies, human reviews (XL)
- [ ] **Self-healing CI** — automatically retry with fixes when scan blocks a PR (L)
- [ ] **Fix suggestion ranking** — ML model to rank fix suggestions by likelihood of acceptance (L)
- [ ] **Natural language config** — "block PRs that add N+1 queries" parsed to `.pocolente.yml` (M)
- [ ] **PR review assistant** — LLM-powered summary of findings with contextual explanations (L)

## Language Expansion

Extend scanner rules to more languages.

- [ ] **Python scanner rules** — AST rules via tree-sitter-python for all three layers (L)
- [ ] **Java scanner rules** — tree-sitter-java for OWASP, complexity, resource patterns (L)
- [ ] **Go scanner rules** — tree-sitter-go for goroutine leaks, SQL injection, complexity (L)
- [ ] **Rust scanner rules** — tree-sitter-rust for unsafe blocks, complexity, resource patterns (L)
- [ ] **C# scanner rules** — tree-sitter-c-sharp for .NET security and correctness patterns (L)
- [ ] **Ruby scanner rules** — tree-sitter-ruby for Rails security patterns (M)
- [ ] **PHP scanner rules** — tree-sitter-php for WordPress/Laravel security patterns (M)
- [ ] **Kotlin scanner rules** — tree-sitter-kotlin for Android and server-side patterns (M)
- [ ] **Swift scanner rules** — tree-sitter-swift for iOS security and resource patterns (M)

## Advanced GreenOps

Deepen the energy efficiency story.

- [ ] **Electricity Maps API integration** — real-time grid carbon intensity for scheduling hints (M)
- [ ] **Carbon-aware CI scheduling** — delay non-urgent jobs until grid is cleaner (L)
- [ ] **Formal CSRD reports** — generate EU-compliant sustainability reports from scan data (XL)
- [ ] **SCI benchmarking** — compare SCI scores across similar projects and industry averages (L)
- [ ] **Energy budget per PR** — set a max SCI delta that blocks PRs exceeding budget (M)
- [ ] **Runtime profiling improvements** — RAPL integration, Scaphandre/Kepler support (L)
- [ ] **GreenOps leaderboard** — team/repo ranking by energy efficiency improvements (M)
- [ ] **Dependency energy scoring** — estimate energy cost of npm/PyPI packages (L)
- [ ] **Cloud region carbon comparison** — suggest lower-carbon deployment regions (M)

## Enterprise

Features for large-scale adoption.

- [ ] **GitHub App upgrade** — replace token-based auth with GitHub App installation (L)
- [ ] **SSO / SAML support** — enterprise identity provider integration for dashboard (XL)
- [ ] **On-premise deployment** — Helm chart for self-hosted dashboard + scanner engine (XL)
- [ ] **SOC 2 certification** — audit readiness for the SaaS dashboard (XL)
- [ ] **Air-gapped mode** — run all scanners offline without external API calls (L)
- [ ] **Multi-tenant dashboard** — org isolation, per-team billing, usage analytics (XL)
- [ ] **Custom scanner SDK** — documented API for third-party scanner plugins (L)
- [ ] **Webhook API** — POST scan results to arbitrary endpoints for custom integrations (S)
- [ ] **Bulk repo onboarding** — CLI/API to enable Pocolente across all org repos at once (M)

---

*This roadmap is a living document. Priorities shift based on user demand, contributor interest, and regulatory deadlines. Open an issue or discussion to vote on what matters to you.*
