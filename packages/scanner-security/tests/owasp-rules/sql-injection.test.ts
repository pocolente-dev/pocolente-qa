import { describe, it, expect } from "vitest";
import { sqlInjectionRule } from "../../src/owasp-rules/sql-injection.js";
import type { DiffFile } from "@pocolente/core";

const dummyFile: DiffFile = { path: "test.ts", added: [], removed: [], patch: "" };

describe("sqlInjectionRule", () => {
  it("detects template literal in .query() call", () => {
    const line = 'const result = await db.query(`SELECT * FROM users WHERE id = ${userId}`);';
    const match = sqlInjectionRule.testLine(line, 1, dummyFile);
    expect(match).not.toBeNull();
    expect(match!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects template literal in .execute() call", () => {
    const line = 'await connection.execute(`DELETE FROM sessions WHERE token = ${token}`);';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("detects string concat in query call", () => {
    const line = 'db.query("SELECT * FROM users WHERE name = \'" + name + "\'");';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("detects Prisma.$queryRaw with template literal", () => {
    const line = 'await prisma.$queryRaw(`SELECT * FROM "User" WHERE id = ${id}`);';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("detects Knex.raw with template literal", () => {
    const line = 'knex.raw(`SELECT * FROM users WHERE email = ${email}`);';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("does NOT flag parameterized queries", () => {
    const line = 'db.query("SELECT * FROM users WHERE id = $1", [userId]);';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("does NOT flag tagged template literals (sql``)", () => {
    const line = 'const result = await sql`SELECT * FROM users WHERE id = ${userId}`;';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("has correct CWE and OWASP mapping", () => {
    expect(sqlInjectionRule.cwe).toBe("CWE-89");
    expect(sqlInjectionRule.owaspCategory).toBe("A03:2021-Injection");
  });
});
