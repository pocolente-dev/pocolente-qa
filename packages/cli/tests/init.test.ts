import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initConfig } from "../src/init.js";

describe("initConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pocolente-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates .pocolente.yml in target directory", async () => {
    const result = await initConfig(tempDir);
    expect(result.created).toBe(true);
    const content = await readFile(join(tempDir, ".pocolente.yml"), "utf-8");
    expect(content).toContain("version: 1");
    expect(content).toContain("severity_threshold:");
  });

  it("returns created: false if file already exists", async () => {
    await initConfig(tempDir);
    const result = await initConfig(tempDir);
    expect(result.created).toBe(false);
    expect(result.message).toContain("already exists");
  });

  it("generated config is valid YAML parseable by loadConfig", async () => {
    await initConfig(tempDir);
    const { loadConfig } = await import("@pocolente/core");
    const config = await loadConfig(join(tempDir, ".pocolente.yml"));
    expect(config.version).toBe(1);
  });
});
