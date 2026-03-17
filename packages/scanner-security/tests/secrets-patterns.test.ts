import { describe, it, expect } from "vitest";
import { matchSecretPatterns } from "../src/secrets-patterns.js";

describe("matchSecretPatterns", () => {
  it("detects AWS access key", () => {
    const matches = matchSecretPatterns('const key = "AKIAIOSFODNN7EXAMPLE";');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.patternName === "aws-access-key")).toBe(true);
  });

  it("detects GitHub token", () => {
    const matches = matchSecretPatterns(
      'token: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"'
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.patternName === "github-token")).toBe(true);
  });

  it("detects Stripe secret key", () => {
    const matches = matchSecretPatterns(
      'const stripe = new Stripe("sk_live_FAKEFAKEFAKEFAKEFAKE");'
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.patternName === "stripe-secret-key")).toBe(true);
  });

  it("detects PEM private key header", () => {
    const matches = matchSecretPatterns("-----BEGIN RSA PRIVATE KEY-----");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.patternName === "private-key")).toBe(true);
  });

  it("detects database URL", () => {
    const matches = matchSecretPatterns(
      'const db = "postgres://user:password@host:5432/dbname";'
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.patternName === "database-url")).toBe(true);
  });

  it("detects JWT", () => {
    const matches = matchSecretPatterns(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.patternName === "jwt")).toBe(true);
  });

  it("returns empty for clean lines", () => {
    const matches = matchSecretPatterns('const name = "hello world";');
    expect(matches).toEqual([]);
  });
});
