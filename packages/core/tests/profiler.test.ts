import { describe, it, expect } from "vitest";
import { profileCommand } from "../src/profiler.js";

describe("profileCommand", () => {
  it("profiles a successful command", async () => {
    const result = await profileCommand('node -e "console.log(42)"');
    expect(result.exitCode).toBe(0);
    expect(result.wallClockMs).toBeGreaterThanOrEqual(0);
    expect(result.cpuMs).toBeGreaterThanOrEqual(0);
    expect(result.peakMemoryMb).toBeGreaterThanOrEqual(0);
    expect(result.stdout).toContain("42");
    expect(result.error).toBeNull();
  });

  it("profiles a failing command", async () => {
    const result = await profileCommand('node -e "process.exit(1)"');
    expect(result.exitCode).toBe(1);
    expect(result.wallClockMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeNull(); // no spawn error, just non-zero exit
  });

  it("handles nonexistent command", async () => {
    const result = await profileCommand("nonexistent_command_xyz");
    expect(result.error).not.toBeNull();
    expect(result.exitCode).not.toBe(0);
  });

  it("captures stderr", async () => {
    const result = await profileCommand('node -e "console.error(\"err\")"');
    expect(result.stderr).toContain("err");
  });

  it("respects timeout", async () => {
    const result = await profileCommand('node -e "setTimeout(() => {}, 10000)"', { timeoutMs: 500 });
    expect(result.error).toContain("timeout");
  }, 5000);
});
