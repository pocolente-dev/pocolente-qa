import { describe, it, expect } from "vitest";
import { BehavioralDriftScanner } from "../src/behavioral-drift-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";

function makeContext(diffs: DiffFile[]): ScanContext {
  return { diff: diffs, config: parseConfig(undefined), repoRoot: "/tmp", baseBranch: "main", prBranch: "feature" };
}

const scanner = new BehavioralDriftScanner();

describe("BehavioralDriftScanner", () => {
  it("has correct metadata", () => {
    expect(scanner.id).toBe("behavioral-drift-scanner");
    expect(scanner.layer).toBe("correctness");
  });

  it("detects removed export function", async () => {
    const ctx = makeContext([{
      path: "src/api.ts",
      added: [],
      removed: ['export function getData(): string {'],
      patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("block");
    expect(findings[0].title).toContain("getData");
    expect(findings[0].title.toLowerCase()).toContain("removed");
  });

  it("detects removed export class", async () => {
    const ctx = makeContext([{
      path: "src/models.ts",
      added: [],
      removed: ['export class UserModel {'],
      patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("UserModel");
  });

  it("detects parameter removal (breaking change)", async () => {
    const ctx = makeContext([{
      path: "src/api.ts",
      added: ['export function fetch(url: string): Promise<Response> {'],
      removed: ['export function fetch(url: string, timeout: number): Promise<Response> {'],
      patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("block");
  });

  it("warns on parameter addition (non-breaking)", async () => {
    const ctx = makeContext([{
      path: "src/api.ts",
      added: ['export function fetch(url: string, options?: object): Promise<Response> {'],
      removed: ['export function fetch(url: string): Promise<Response> {'],
      patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warn");
  });

  it("does NOT flag non-exported function changes", async () => {
    const ctx = makeContext([{
      path: "src/internal.ts",
      added: [],
      removed: ['function privateHelper(): void {'],
      patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag new exports", async () => {
    const ctx = makeContext([{
      path: "src/api.ts",
      added: ['export function newFeature(): void {'],
      removed: [],
      patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("only scans TS/JS files", async () => {
    const ctx = makeContext([{
      path: "config.yaml",
      added: [],
      removed: ['export function removed(): void {'],
      patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("respects behavioralDrift.enabled config", async () => {
    const config = parseConfig({ correctness: { behavioral_drift: { enabled: false } } });
    const ctx: ScanContext = {
      diff: [{ path: "src/api.ts", added: [], removed: ['export function removed() {'], patch: "" }],
      config, repoRoot: "/tmp", baseBranch: "main", prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
