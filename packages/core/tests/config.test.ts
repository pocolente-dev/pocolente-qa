import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  it("returns defaults for empty input", () => {
    const config = parseConfig({});
    expect(config.version).toBe(1);
    expect(config.severityThreshold).toBe("warn");
    expect(config.blockPrOn).toBe("block");
    expect(config.correctness.enabled).toBe(true);
    expect(config.security.enabled).toBe(true);
    expect(config.greenops.enabled).toBe(true);
  });

  it("returns defaults for undefined input", () => {
    const config = parseConfig(undefined);
    expect(config.version).toBe(1);
  });

  it("overrides defaults with provided values", () => {
    const config = parseConfig({
      severity_threshold: "info",
      block_pr_on: "warn",
      security: { enabled: false },
    });
    expect(config.severityThreshold).toBe("info");
    expect(config.blockPrOn).toBe("warn");
    expect(config.security.enabled).toBe(false);
    expect(config.correctness.enabled).toBe(true);
  });

  it("parses scan_paths with defaults", () => {
    const config = parseConfig({});
    expect(config.scanPaths.include).toEqual(["src/**", "lib/**", "packages/**"]);
    expect(config.scanPaths.exclude).toEqual(["**/*.test.*", "**/*.spec.*", "vendor/**"]);
  });

  it("handles invalid severity gracefully", () => {
    expect(() => parseConfig({ severity_threshold: "invalid" })).toThrow();
  });

  it("enables runtime_profiling when set to true", () => {
    const config = parseConfig({ runtime_profiling: { enabled: true } });
    expect(config.runtimeProfiling.enabled).toBe(true);
    expect(config.warnings).not.toContain(
      "Runtime profiling is not yet available. This setting will be ignored."
    );
  });
});
