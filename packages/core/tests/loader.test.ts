import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadConfig } from "../src/loader.js";

const fixturesDir = resolve(import.meta.dirname, "fixtures");

describe("loadConfig", () => {
  it("loads and parses a valid YAML config", async () => {
    const config = await loadConfig(resolve(fixturesDir, "valid.yml"));
    expect(config.severityThreshold).toBe("info");
    expect(config.blockPrOn).toBe("warn");
    expect(config.security.secrets.severity).toBe("block");
    expect(config.greenops.enabled).toBe(false);
  });

  it("loads minimal config and fills defaults", async () => {
    const config = await loadConfig(resolve(fixturesDir, "minimal.yml"));
    expect(config.version).toBe(1);
    expect(config.severityThreshold).toBe("warn");
    expect(config.correctness.enabled).toBe(true);
  });

  it("returns defaults when file does not exist", async () => {
    const config = await loadConfig("/nonexistent/.pocolente.yml");
    expect(config.version).toBe(1);
    expect(config.severityThreshold).toBe("warn");
  });
});
