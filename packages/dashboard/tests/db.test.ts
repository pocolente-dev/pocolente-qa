import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDatabase, insertScan, getScanTrends, getRcsTrend } from "../src/db.js";
import type Database from "better-sqlite3";

let db: Database.Database;

beforeEach(() => {
  db = createDatabase(":memory:");
});

afterEach(() => {
  db.close();
});

describe("createDatabase", () => {
  it("creates tables without error", () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain("scans");
    expect(names).toContain("findings");
    expect(names).toContain("api_keys");
  });
});

describe("insertScan", () => {
  it("inserts a scan with findings", () => {
    const scanId = insertScan(db, {
      repo: "owner/repo",
      prNumber: 42,
      branch: "feature-x",
      commitSha: "abc123",
      status: "pass",
      findingCount: 2,
      rcsDelta: 5,
      rcsBadge: "yellow",
      durationMs: 1234,
      findings: [
        {
          layer: "security", scanner: "secrets-scanner", severity: "block",
          confidence: 0.97, file: "src/config.ts", line: "12",
          title: "AWS key", explanation: "Found key", suggestion: "Remove it",
          cwe: "CWE-798", owasp: null, energyImpact: null, rcsDelta: null,
        },
        {
          layer: "greenops", scanner: "complexity-scanner", severity: "warn",
          confidence: 0.9, file: "src/app.ts", line: "45",
          title: "Nested loop", explanation: "O(n^2)", suggestion: "Refactor",
          cwe: null, owasp: null, energyImpact: "high", rcsDelta: "+5",
        },
      ],
    });

    expect(scanId).toBeGreaterThan(0);

    const scan = db.prepare("SELECT * FROM scans WHERE id = ?").get(scanId) as any;
    expect(scan.repo).toBe("owner/repo");
    expect(scan.status).toBe("pass");

    const findings = db.prepare("SELECT * FROM findings WHERE scan_id = ?").all(scanId);
    expect(findings).toHaveLength(2);
  });
});

describe("getScanTrends", () => {
  it("returns scans for a repo ordered by date desc", () => {
    insertScan(db, { repo: "owner/repo", status: "pass", findingCount: 0, rcsDelta: 0, rcsBadge: "green", durationMs: 100, findings: [] });
    insertScan(db, { repo: "owner/repo", status: "block", findingCount: 3, rcsDelta: 5, rcsBadge: "yellow", durationMs: 200, findings: [] });
    insertScan(db, { repo: "other/repo", status: "pass", findingCount: 0, rcsDelta: 0, rcsBadge: "green", durationMs: 50, findings: [] });

    const trends = getScanTrends(db, "owner/repo", 10);
    expect(trends).toHaveLength(2);
    expect(trends[0].status).toBe("block"); // most recent first
  });
});

describe("runtime metrics", () => {
  it("stores and retrieves runtime metrics", () => {
    const scanId = insertScan(db, {
      repo: "owner/repo", status: "pass", findingCount: 0,
      rcsDelta: 0, rcsBadge: "green", durationMs: 100,
      cpuMs: 5000, peakMemoryMb: 256, sciScore: 0.042,
      findings: [],
    });
    const trends = getScanTrends(db, "owner/repo", 10);
    expect(trends[0].cpuMs).toBe(5000);
    expect(trends[0].peakMemoryMb).toBe(256);
    expect(trends[0].sciScore).toBe(0.042);
  });
});

describe("getRcsTrend", () => {
  it("returns RCS data points for a repo", () => {
    insertScan(db, { repo: "owner/repo", status: "pass", findingCount: 0, rcsDelta: 0, rcsBadge: "green", durationMs: 100, findings: [] });
    insertScan(db, { repo: "owner/repo", status: "pass", findingCount: 2, rcsDelta: 8, rcsBadge: "red", durationMs: 200, findings: [] });

    const trend = getRcsTrend(db, "owner/repo", 10);
    expect(trend).toHaveLength(2);
    expect(trend[0].rcsDelta).toBe(8); // most recent first
    expect(trend[0].badge).toBe("red");
  });
});
