import { Hono } from "hono";
import { cors } from "hono/cors";
import type Database from "better-sqlite3";
import { insertScan, getScanTrends, getRcsTrend, createDatabase } from "./db.js";

interface AppConfig {
  masterKey: string;
}

export function createApp(db: Database.Database, config: AppConfig) {
  const app = new Hono();

  app.use("*", cors());

  // Auth middleware for write endpoints
  const authMiddleware = async (c: any, next: any) => {
    const key = c.req.header("X-Pocolente-Key");
    if (!key || key !== config.masterKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };

  // POST /api/v1/scans
  app.post("/api/v1/scans", authMiddleware, async (c) => {
    const body = await c.req.json();
    const scanId = insertScan(db, body);
    return c.json({ scanId }, 201);
  });

  // GET /api/v1/repos/:repo/trends
  app.get("/api/v1/repos/:repo/trends", (c) => {
    const repo = decodeURIComponent(c.req.param("repo"));
    const limit = Number(c.req.query("limit") ?? "50");
    const scans = getScanTrends(db, repo, limit);
    return c.json({ scans });
  });

  // GET /api/v1/repos/:repo/rcs
  app.get("/api/v1/repos/:repo/rcs", (c) => {
    const repo = decodeURIComponent(c.req.param("repo"));
    const limit = Number(c.req.query("limit") ?? "50");
    const trend = getRcsTrend(db, repo, limit);
    return c.json({ trend });
  });

  // GET /api/v1/repos/:repo/export/csrd
  app.get("/api/v1/repos/:repo/export/csrd", (c) => {
    const repo = decodeURIComponent(c.req.param("repo"));
    const scans = getScanTrends(db, repo, 1000);

    const header = "Date,PR,Status,RCS Delta,RCS Badge,Finding Count";
    const rows = scans.map(s =>
      `${s.createdAt},${s.prNumber ?? ""},${s.status},${s.rcsDelta},${s.rcsBadge},${s.findingCount}`
    );
    const csv = [header, ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=pocolente-csrd-export.csv",
      },
    });
  });

  return app;
}

// Standalone server entry point
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const db = createDatabase(process.env.POCOLENTE_DB_PATH ?? "./pocolente.db");
  const masterKey = process.env.POCOLENTE_DASHBOARD_MASTER_KEY ?? "changeme";
  const app = createApp(db, { masterKey });
  const port = Number(process.env.PORT ?? 3000);

  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port });
  console.log(`Pocolente Dashboard running on http://localhost:${port}`);
}
