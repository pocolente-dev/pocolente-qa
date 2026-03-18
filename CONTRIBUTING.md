# Contributing to Pocolente QA

Thank you for your interest in contributing! Pocolente QA is an open-source CI/CD quality gate, and contributions of all kinds are welcome.

## Development Setup

```bash
git clone https://github.com/pocolente/pocolente-qa.git
cd pocolente-qa
pnpm install
pnpm build
pnpm test
```

**Requirements:** Node.js 20+, pnpm 9+

## Project Structure

This is a pnpm monorepo with packages in `packages/`:

| Package | Description |
|---|---|
| `core` | Types, config parser, severity engine, PR renderer |
| `scanner-security` | Secrets, OWASP, Supply Chain, Permissions scanners |
| `scanner-correctness` | Generation Quality, Dead Code, Drift, Coverage scanners |
| `scanner-greenops` | Complexity, Resource, Infra Bloat, Runtime Profiler scanners |
| `github-action` | GitHub Action entry point |
| `cli` | Standalone CLI (`pocolente scan`) |
| `dashboard` | Web dashboard for scan results |

## Adding a New Scanner

1. Choose the appropriate scanner package (`scanner-security`, `scanner-correctness`, or `scanner-greenops`)
2. Create a new scanner file in `src/scanners/` following the existing pattern
3. Implement the `Scanner` interface from `@pocolente/core`
4. Register the scanner in the package's `src/index.ts`
5. Add fixture files in `fixtures/` that demonstrate the patterns being detected
6. Write tests covering both detection and false-positive avoidance

## Making Changes

1. **Fork and branch** — create a feature branch from `main`
2. **Write tests** — the test suite covers all 12 scanners with real-world fixtures. New code should include tests.
3. **Run checks** — `pnpm build && pnpm test && pnpm lint` must all pass
4. **Keep commits focused** — one logical change per commit

## Pull Request Conventions

- Keep PRs focused on a single concern
- Include a description of what changed and why
- Reference any related issues
- Ensure CI passes before requesting review

## Reporting Issues

- **Bugs:** Use the [bug report template](https://github.com/pocolente/pocolente-qa/issues/new?template=bug_report.md)
- **Features:** Use the [feature request template](https://github.com/pocolente/pocolente-qa/issues/new?template=feature_request.md)

## Code of Conduct

Be respectful and constructive. We're all here to build better software together.

## Ideas for Contributions

See the [Expansion Roadmap](docs/EXPANSION-ROADMAP.md) for planned features and areas where help is welcome.
