import { describe, it, expect } from "vitest";
import { PermissionsScanner } from "../src/permissions-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";

function makeContext(diffs: DiffFile[]): ScanContext {
  return { diff: diffs, config: parseConfig(undefined), repoRoot: "/tmp", baseBranch: "main", prBranch: "feature" };
}

const scanner = new PermissionsScanner();

describe("PermissionsScanner", () => {
  it("has correct metadata", () => {
    expect(scanner.id).toBe("permissions-scanner");
    expect(scanner.layer).toBe("security");
  });

  it("detects wildcard permissions in K8s YAML", async () => {
    const ctx = makeContext([{
      path: "k8s/role.yaml",
      added: [
        'apiVersion: rbac.authorization.k8s.io/v1',
        'kind: Role',
        'rules:',
        '- apiGroups: ["*"]',
        '  resources: ["*"]',
        '  verbs: ["*"]',
      ],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("wildcard"))).toBe(true);
  });

  it("detects container running as root in K8s", async () => {
    const ctx = makeContext([{
      path: "k8s/deployment.yaml",
      added: [
        'kind: Deployment',
        'spec:',
        '  containers:',
        '  - name: app',
        '    securityContext:',
        '      runAsUser: 0',
      ],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("root"))).toBe(true);
  });

  it("detects USER root in Dockerfile", async () => {
    const ctx = makeContext([{
      path: "Dockerfile",
      added: [
        'FROM node:20',
        'USER root',
        'RUN apt-get update',
        'COPY . .',
      ],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.toLowerCase().includes("root"))).toBe(true);
  });

  it("does NOT flag Dockerfile with non-root USER", async () => {
    const ctx = makeContext([{
      path: "Dockerfile",
      added: [
        'FROM node:20',
        'USER root',
        'RUN apt-get update',
        'USER node',
        'COPY . .',
      ],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    // Last USER is "node", so it's fine
    expect(findings.filter(f => f.title.toLowerCase().includes("root"))).toHaveLength(0);
  });

  it("only processes YAML and Dockerfile files", async () => {
    const ctx = makeContext([{
      path: "src/app.ts",
      added: ['runAsUser: 0'],
      removed: [], patch: "",
    }]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
