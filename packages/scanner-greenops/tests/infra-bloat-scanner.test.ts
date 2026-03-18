import { describe, it, expect } from "vitest";
import { InfraBloatScanner } from "../src/infra-bloat-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";

function makeContext(diffs: DiffFile[]): ScanContext {
  return { diff: diffs, config: parseConfig(undefined), repoRoot: "/tmp", baseBranch: "main", prBranch: "feature" };
}

const scanner = new InfraBloatScanner();

describe("InfraBloatScanner", () => {
  it("has correct metadata", () => {
    expect(scanner.id).toBe("infra-bloat-scanner");
    expect(scanner.layer).toBe("greenops");
  });

  it("detects bloated Docker base image", async () => {
    const ctx = makeContext([{
      path: "Dockerfile",
      added: ["FROM node:20", "RUN npm install", "COPY . ."],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("image") || f.title.toLowerCase().includes("bloat"))).toBe(true);
    expect(findings[0].suggestion).toContain("alpine");
  });

  it("detects FROM node:latest", async () => {
    const ctx = makeContext([{
      path: "Dockerfile",
      added: ["FROM node:latest"],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag alpine images", async () => {
    const ctx = makeContext([{
      path: "Dockerfile",
      added: ["FROM node:20-alpine"],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings.filter(f => f.title.toLowerCase().includes("image"))).toHaveLength(0);
  });

  it("does NOT flag slim images", async () => {
    const ctx = makeContext([{
      path: "Dockerfile",
      added: ["FROM python:3.12-slim"],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings.filter(f => f.title.toLowerCase().includes("image"))).toHaveLength(0);
  });

  it("detects K8s containers without resource limits", async () => {
    const ctx = makeContext([{
      path: "k8s/deployment.yaml",
      added: [
        "kind: Deployment",
        "spec:",
        "  containers:",
        "  - name: app",
        "    image: myapp:latest",
      ],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("resource") || f.title.toLowerCase().includes("limit"))).toBe(true);
  });

  it("detects docker-compose services without resource limits", async () => {
    const ctx = makeContext([{
      path: "docker-compose.yml",
      added: [
        "services:",
        "  web:",
        "    image: myapp:latest",
        "    ports:",
        '      - "3000:3000"',
      ],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("resource") || f.title.toLowerCase().includes("limit"))).toBe(true);
  });

  it("only processes infra files", async () => {
    const ctx = makeContext([{
      path: "src/app.ts",
      added: ["FROM node:20"],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
