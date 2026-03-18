import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApp } from "../src/server.js";
import { createDatabase } from "../src/db.js";
import type Database from "better-sqlite3";

let db: Database.Database;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = createDatabase(":memory:");
  app = createApp(db, { masterKey: "test-master-key" });
});

afterEach(() => {
  db.close();
});

describe("POST /api/v1/scans", () => {
  const validBody = {
    repo: "owner/repo",
    prNumber: 42,
    branch: "feature-x",
    commitSha: "abc123",
    status: "pass",
    findingCount: 1,
    rcsDelta: 5,
    rcsBadge: "yellow",
    durationMs: 1234,
    findings: [{
      layer: "security", scanner: "secrets-scanner", severity: "block",
      confidence: 0.97, file: "src/config.ts", line: "12",
      title: "AWS key", explanation: "Found key", suggestion: "Remove it",
      cwe: "CWE-798", owasp: null, energyImpact: null, rcsDelta: null,
    }],
  };

  it("accepts valid scan with master key", async () => {
    const res = await app.request("/api/v1/scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pocolente-Key": "test-master-key",
      },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.scanId).toBeGreaterThan(0);
  });

  it("rejects request without API key", async () => {
    const res = await app.request("/api/v1/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(401);
  });

  it("rejects request with wrong API key", async () => {
    const res = await app.request("/api/v1/scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pocolente-Key": "wrong-key",
      },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/repos/:repo/trends", () => {
  it("returns scan trends for a repo", async () => {
    // Insert a scan first
    await app.request("/api/v1/scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pocolente-Key": "test-master-key",
      },
      body: JSON.stringify({
        repo: "owner/repo", status: "pass", findingCount: 0,
        rcsDelta: 0, rcsBadge: "green", durationMs: 100, findings: [],
      }),
    });

    const res = await app.request("/api/v1/repos/owner%2Frepo/trends");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scans).toHaveLength(1);
  });

  it("returns empty array for unknown repo", async () => {
    const res = await app.request("/api/v1/repos/unknown%2Frepo/trends");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scans).toHaveLength(0);
  });
});

describe("GET /api/v1/repos/:repo/rcs", () => {
  it("returns RCS trend data", async () => {
    await app.request("/api/v1/scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pocolente-Key": "test-master-key",
      },
      body: JSON.stringify({
        repo: "owner/repo", status: "pass", findingCount: 2,
        rcsDelta: 8, rcsBadge: "red", durationMs: 200, findings: [],
      }),
    });

    const res = await app.request("/api/v1/repos/owner%2Frepo/rcs");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.trend).toHaveLength(1);
    expect(json.trend[0].rcsDelta).toBe(8);
  });
});

describe("GET /api/v1/repos/:repo/export/csrd", () => {
  it("returns CSV with scan data", async () => {
    await app.request("/api/v1/scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pocolente-Key": "test-master-key",
      },
      body: JSON.stringify({
        repo: "owner/repo", prNumber: 42, status: "pass", findingCount: 2,
        rcsDelta: 5, rcsBadge: "yellow", durationMs: 1234, findings: [],
      }),
    });

    const res = await app.request("/api/v1/repos/owner%2Frepo/export/csrd");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv).toContain("Date,PR,Status,RCS Delta,RCS Badge,Finding Count");
    expect(csv).toContain("42");
    expect(csv).toContain("pass");
  });

  it("returns empty CSV for unknown repo", async () => {
    const res = await app.request("/api/v1/repos/unknown%2Frepo/export/csrd");
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain("Date,PR,Status"); // Header still present
  });
});
