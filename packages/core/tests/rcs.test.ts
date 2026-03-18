import { describe, it, expect } from "vitest";
import { computeRcs, rcsBadge } from "../src/rcs.js";
import type { Finding } from "../src/types.js";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    layer: "greenops", scanner: "complexity-scanner", severity: "warn",
    confidence: 0.9, file: "src/app.ts", line: "1",
    title: "Nested loop", explanation: "test", suggestion: "test",
    cwe: null, owasp: null, estimatedEnergyImpact: "high", rcsDelta: "+5",
    ...overrides,
  };
}

describe("computeRcs", () => {
  it("returns 0 for empty findings", () => {
    expect(computeRcs([])).toBe(0);
  });

  it("sums rcsDelta values from greenops findings", () => {
    const findings = [
      makeFinding({ rcsDelta: "+5" }),
      makeFinding({ rcsDelta: "+10", scanner: "complexity-scanner" }),
      makeFinding({ rcsDelta: "+3", scanner: "resource-scanner" }),
    ];
    expect(computeRcs(findings)).toBe(18);
  });

  it("ignores non-greenops findings", () => {
    const findings = [
      makeFinding({ layer: "security", rcsDelta: "+99" }),
      makeFinding({ layer: "greenops", rcsDelta: "+5" }),
    ];
    expect(computeRcs(findings)).toBe(5);
  });

  it("handles findings without rcsDelta", () => {
    const findings = [
      makeFinding({ rcsDelta: null }),
      makeFinding({ rcsDelta: "+5" }),
    ];
    expect(computeRcs(findings)).toBe(5);
  });
});

describe("rcsBadge", () => {
  it("returns green for delta <= 0", () => {
    expect(rcsBadge(0, 5)).toBe("green");
    expect(rcsBadge(-3, 5)).toBe("green");
  });

  it("returns yellow for 0 < delta <= threshold", () => {
    expect(rcsBadge(3, 5)).toBe("yellow");
    expect(rcsBadge(5, 5)).toBe("yellow");
  });

  it("returns red for delta > threshold", () => {
    expect(rcsBadge(6, 5)).toBe("red");
    expect(rcsBadge(15, 5)).toBe("red");
  });
});
