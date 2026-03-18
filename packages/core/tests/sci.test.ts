import { describe, it, expect } from "vitest";
import { computeSci, computeSciDelta, formatSci } from "../src/sci.js";

describe("computeSci", () => {
  it("calculates SCI from CPU time and grid intensity", () => {
    // 1 hour of CPU at 65W TDP, 400 gCO2/kWh grid intensity
    const sci = computeSci({
      cpuMs: 3_600_000,
      gridIntensityGCo2PerKwh: 400,
      tdpWatts: 65,
    });
    // Energy = 65W * 1h = 0.065 kWh
    // SCI = 0.065 * 400 = 26 gCO2eq
    expect(sci.energyKwh).toBeCloseTo(0.065, 3);
    expect(sci.sciGCo2).toBeCloseTo(26, 0);
  });

  it("returns 0 for 0 CPU time", () => {
    const sci = computeSci({ cpuMs: 0, gridIntensityGCo2PerKwh: 400, tdpWatts: 65 });
    expect(sci.sciGCo2).toBe(0);
    expect(sci.energyKwh).toBe(0);
  });

  it("uses default TDP and grid intensity", () => {
    const sci = computeSci({ cpuMs: 60_000 }); // 1 minute
    expect(sci.sciGCo2).toBeGreaterThan(0);
  });
});

describe("computeSciDelta", () => {
  it("computes delta between two SCI scores", () => {
    const base = computeSci({ cpuMs: 60_000 });
    const pr = computeSci({ cpuMs: 120_000 }); // double
    const delta = computeSciDelta(base, pr);
    expect(delta.absoluteGCo2).toBeGreaterThan(0);
    expect(delta.percentChange).toBeCloseTo(100, 0);
  });

  it("returns negative delta when PR is better", () => {
    const base = computeSci({ cpuMs: 120_000 });
    const pr = computeSci({ cpuMs: 60_000 });
    const delta = computeSciDelta(base, pr);
    expect(delta.absoluteGCo2).toBeLessThan(0);
    expect(delta.percentChange).toBeCloseTo(-50, 0);
  });

  it("returns 0 delta for identical scores", () => {
    const score = computeSci({ cpuMs: 60_000 });
    const delta = computeSciDelta(score, score);
    expect(delta.absoluteGCo2).toBe(0);
    expect(delta.percentChange).toBe(0);
  });
});

describe("formatSci", () => {
  it("formats SCI with units", () => {
    const sci = computeSci({ cpuMs: 60_000 });
    const formatted = formatSci(sci);
    expect(formatted).toContain("gCO2eq");
  });
});
