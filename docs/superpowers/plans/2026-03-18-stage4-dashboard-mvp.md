# Pocolente QA Harness — Stage 4: Dashboard MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web dashboard that visualizes scan history, RCS trends, and finding details — unlocking the premium tier and CSRD-compliant export. The GitHub Action posts scan results to the dashboard API, and developers view trends via a web UI.

**Architecture:** New `packages/dashboard/` package with a Hono API server + static frontend served from the same process. SQLite (via better-sqlite3) for storage — zero-setup, file-based, perfect for MVP (migrate to PostgreSQL when scaling). API key auth for Action→Dashboard communication. GitHub OAuth deferred to post-MVP (API key is sufficient for Stage 4). Frontend is a Vite-built React SPA with Tailwind, served as static files by Hono.

**Tech Stack:** Hono (API), better-sqlite3 (storage), React + Vite + Tailwind (frontend), Chart.js (RCS trend charts)

**Pragmatic scope:** The spec calls for Next.js + PostgreSQL + GitHub OAuth + GitHub App upgrade. This plan uses lighter alternatives for MVP speed: Hono + SQLite + API key auth + Vite React SPA. The architecture supports upgrading each component independently later.

---

## File Map

### `packages/dashboard/` (new package)

| File | Responsibility |
|---|---|
| `package.json` | Package manifest |
| `tsconfig.json` | TypeScript config |
| `src/server.ts` | Hono app: routes, middleware, static file serving |
| `src/db.ts` | SQLite schema, migrations, query helpers |
| `src/routes/scans.ts` | POST /api/v1/scans, GET /api/v1/repos/:id/trends |
| `src/routes/rcs.ts` | GET /api/v1/repos/:id/rcs |
| `src/routes/export.ts` | GET /api/v1/repos/:id/export/csrd (CSV) |
| `src/auth.ts` | API key validation middleware |
| `tests/db.test.ts` | Database tests |
| `tests/routes.test.ts` | API route tests |
| `web/index.html` | SPA entry point |
| `web/src/App.tsx` | React app: router, layout |
| `web/src/pages/RepoOverview.tsx` | Scan history table + RCS trend chart |
| `web/src/pages/FindingDetail.tsx` | Individual finding lens view |
| `web/src/components/RcsChart.tsx` | RCS trend line chart (Chart.js) |
| `web/vite.config.ts` | Vite build config |

### `packages/github-action/` (modified)

| File | Responsibility |
|---|---|
| `src/main.ts` | Modified: POST scan results to dashboard API if configured |

---

## Task 1: Dashboard Package Scaffolding + Database

**Files:**
- Create: `packages/dashboard/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
- Create: `packages/dashboard/src/db.ts`
- Create: `packages/dashboard/tests/db.test.ts`

Package deps: `hono`, `better-sqlite3`, `@types/better-sqlite3`

Database schema (SQLite):
```sql
CREATE TABLE scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo TEXT NOT NULL,
  pr_number INTEGER,
  branch TEXT,
  commit_sha TEXT,
  status TEXT NOT NULL,        -- 'pass' | 'block'
  finding_count INTEGER NOT NULL,
  rcs_delta INTEGER NOT NULL DEFAULT 0,
  rcs_badge TEXT NOT NULL DEFAULT 'green',
  duration_ms REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER NOT NULL REFERENCES scans(id),
  layer TEXT NOT NULL,
  scanner TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL,
  file TEXT,
  line TEXT,
  title TEXT NOT NULL,
  explanation TEXT,
  suggestion TEXT,
  cwe TEXT,
  owasp TEXT,
  energy_impact TEXT,
  rcs_delta TEXT
);

CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL UNIQUE,
  repo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_scans_repo ON scans(repo);
CREATE INDEX idx_scans_created ON scans(created_at);
CREATE INDEX idx_findings_scan ON findings(scan_id);
```

TDD: test that db initializes, inserts a scan with findings, queries trends.

Commit: `feat(dashboard): scaffold package with SQLite database schema`

---

## Task 2: API Routes — Scan Ingestion (TDD)

**Files:**
- Create: `packages/dashboard/src/server.ts`
- Create: `packages/dashboard/src/auth.ts`
- Create: `packages/dashboard/src/routes/scans.ts`
- Create: `packages/dashboard/tests/routes.test.ts`

### POST /api/v1/scans

Accepts JSON body:
```json
{
  "repo": "owner/repo",
  "prNumber": 42,
  "branch": "feature-x",
  "commitSha": "abc123",
  "status": "pass",
  "findings": [...],
  "rcsDelta": 0,
  "rcsBadge": "green",
  "durationMs": 1234
}
```

Validates API key via `X-Pocolente-Key` header. Inserts scan + findings into SQLite. Returns `{ scanId }`.

### API Key Auth Middleware

Simple middleware: check `X-Pocolente-Key` header, hash it, look up in `api_keys` table. Return 401 if not found.

For MVP: also accept a `POCOLENTE_DASHBOARD_MASTER_KEY` env var that bypasses the DB lookup (for initial setup before any keys exist).

TDD: test scan ingestion, auth rejection, validation errors.

Commit: `feat(dashboard): add scan ingestion API with auth`

---

## Task 3: API Routes — Trends + RCS (TDD)

**Files:**
- Create: `packages/dashboard/src/routes/rcs.ts`
- Modify: `packages/dashboard/src/routes/scans.ts` (add GET trends)

### GET /api/v1/repos/:repo/trends

Returns last N scans for a repo with finding counts per layer:
```json
{
  "scans": [
    { "id": 1, "createdAt": "...", "status": "pass", "findingCount": 3, "rcsDelta": 5, "rcsBadge": "yellow" },
    ...
  ]
}
```

### GET /api/v1/repos/:repo/rcs

Returns RCS trend data for charting:
```json
{
  "trend": [
    { "date": "2026-03-18", "rcsDelta": 5, "badge": "yellow" },
    { "date": "2026-03-17", "rcsDelta": 0, "badge": "green" },
    ...
  ]
}
```

TDD: insert multiple scans, query trends, verify ordering and limits.

Commit: `feat(dashboard): add trends and RCS endpoints`

---

## Task 4: CSRD Export (TDD)

**Files:**
- Create: `packages/dashboard/src/routes/export.ts`

### GET /api/v1/repos/:repo/export/csrd

Returns CSV with GreenOps metrics suitable for CSRD sustainability reporting:
```csv
Date,PR,Status,RCS Delta,RCS Badge,GreenOps Findings,Total Findings
2026-03-18,#42,pass,5,yellow,2,8
2026-03-17,#41,pass,0,green,0,3
```

Headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename=pocolente-csrd-export.csv`

TDD: insert scans, export CSV, verify format.

Commit: `feat(dashboard): add CSRD-compliant CSV export endpoint`

---

## Task 5: Frontend — React SPA with Vite

**Files:**
- Create: `packages/dashboard/web/` directory with Vite React setup
- Create: `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`
- Create: `web/src/pages/RepoOverview.tsx` — scan history table + RCS chart
- Create: `web/src/components/RcsChart.tsx` — Chart.js line chart
- Create: `web/vite.config.ts`

Frontend deps: `react`, `react-dom`, `chart.js`, `react-chartjs-2`, `tailwindcss`

### RepoOverview page
- Fetches `/api/v1/repos/:repo/trends` and `/api/v1/repos/:repo/rcs`
- Renders scan history table (date, PR, status, findings, RCS badge)
- Renders RCS trend line chart
- "Export CSRD" button that downloads CSV

### Hono serves built frontend
The Hono server serves the Vite-built static files from `web/dist/` for any non-API route.

Commit: `feat(dashboard): add React SPA with scan history and RCS trend chart`

---

## Task 6: GitHub Action — Post Results to Dashboard

**Files:**
- Modify: `packages/github-action/src/main.ts`

After posting the PR comment and setting commit status, if `config.reporting.dashboardUrl` is configured:
- POST scan results to `${dashboardUrl}/api/v1/scans`
- Include `X-Pocolente-Key: ${config.reporting.dashboardApiKey}` header
- Graceful failure: if POST fails, log a warning but don't fail the Action

Commit: `feat(action): post scan results to dashboard API when configured`

---

## Task 7: Full Build Verification

- [ ] Run `pnpm test` — report count
- [ ] Run `pnpm -r build`
- [ ] Start dashboard: `node packages/dashboard/dist/server.js`
- [ ] Test API: POST a scan, GET trends, GET RCS, GET CSRD export
- [ ] Verify frontend loads in browser
- [ ] Final commit

---

## Done Criteria

Stage 4 is complete when:
1. Dashboard API accepts scan results via POST with API key auth
2. Trends and RCS endpoints return historical data
3. CSRD CSV export works
4. React frontend shows scan history table and RCS trend chart
5. GitHub Action posts results to dashboard when configured
6. All tests pass
