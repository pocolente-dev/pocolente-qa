import Database from "better-sqlite3";

export function createDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo TEXT NOT NULL,
      pr_number INTEGER,
      branch TEXT,
      commit_sha TEXT,
      status TEXT NOT NULL,
      finding_count INTEGER NOT NULL,
      rcs_delta INTEGER NOT NULL DEFAULT 0,
      rcs_badge TEXT NOT NULL DEFAULT 'green',
      duration_ms REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS findings (
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

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL UNIQUE,
      repo TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_scans_repo ON scans(repo);
    CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at);
    CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
  `);

  return db;
}

export interface ScanInput {
  repo: string;
  prNumber?: number;
  branch?: string;
  commitSha?: string;
  status: string;
  findingCount: number;
  rcsDelta: number;
  rcsBadge: string;
  durationMs: number;
  findings: FindingInput[];
}

export interface FindingInput {
  layer: string;
  scanner: string;
  severity: string;
  confidence: number;
  file: string;
  line: string;
  title: string;
  explanation: string;
  suggestion: string;
  cwe: string | null;
  owasp: string | null;
  energyImpact: string | null;
  rcsDelta: string | null;
}

export function insertScan(db: Database.Database, input: ScanInput): number {
  const insertScanStmt = db.prepare(`
    INSERT INTO scans (repo, pr_number, branch, commit_sha, status, finding_count, rcs_delta, rcs_badge, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertFindingStmt = db.prepare(`
    INSERT INTO findings (scan_id, layer, scanner, severity, confidence, file, line, title, explanation, suggestion, cwe, owasp, energy_impact, rcs_delta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = db.transaction(() => {
    const { lastInsertRowid } = insertScanStmt.run(
      input.repo, input.prNumber ?? null, input.branch ?? null, input.commitSha ?? null,
      input.status, input.findingCount, input.rcsDelta, input.rcsBadge, input.durationMs
    );
    const scanId = Number(lastInsertRowid);

    for (const f of input.findings) {
      insertFindingStmt.run(
        scanId, f.layer, f.scanner, f.severity, f.confidence,
        f.file, f.line, f.title, f.explanation, f.suggestion,
        f.cwe, f.owasp, f.energyImpact, f.rcsDelta
      );
    }

    return scanId;
  })();

  return result;
}

export interface ScanTrend {
  id: number;
  createdAt: string;
  status: string;
  findingCount: number;
  rcsDelta: number;
  rcsBadge: string;
  prNumber: number | null;
  branch: string | null;
}

export function getScanTrends(db: Database.Database, repo: string, limit: number): ScanTrend[] {
  return db.prepare(`
    SELECT id, created_at as createdAt, status, finding_count as findingCount,
           rcs_delta as rcsDelta, rcs_badge as rcsBadge, pr_number as prNumber, branch
    FROM scans WHERE repo = ? ORDER BY created_at DESC, id DESC LIMIT ?
  `).all(repo, limit) as ScanTrend[];
}

export interface RcsDataPoint {
  date: string;
  rcsDelta: number;
  badge: string;
}

export function getRcsTrend(db: Database.Database, repo: string, limit: number): RcsDataPoint[] {
  return db.prepare(`
    SELECT created_at as date, rcs_delta as rcsDelta, rcs_badge as badge
    FROM scans WHERE repo = ? ORDER BY created_at DESC, id DESC LIMIT ?
  `).all(repo, limit) as RcsDataPoint[];
}
