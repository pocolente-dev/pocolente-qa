import { describe, it, expect } from "vitest";
import { parseDiff } from "../src/diff.js";

const SAMPLE_DIFF = `diff --git a/src/config.ts b/src/config.ts
index abc1234..def5678 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,3 +1,4 @@
+const secret = "AKIAIOSFODNN7EXAMPLE";
 const name = "app";
-const old = true;
+const updated = true;
diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -5,0 +6,2 @@
+function newHelper() {}
+export { newHelper };
`;

describe("parseDiff", () => {
  it("parses multiple files and returns correct paths", () => {
    const files = parseDiff(SAMPLE_DIFF);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("src/config.ts");
    expect(files[1].path).toBe("src/app.ts");
  });

  it("separates added and removed lines with prefix stripped", () => {
    const files = parseDiff(SAMPLE_DIFF);
    const config = files[0];

    // Added lines should have the '+' prefix stripped
    expect(config.added).toContain('const secret = "AKIAIOSFODNN7EXAMPLE";');
    expect(config.added).toContain("const updated = true;");

    // Removed lines should have the '-' prefix stripped
    expect(config.removed).toContain("const old = true;");

    // Should not contain diff markers
    expect(config.added.every((l) => !l.startsWith("+"))).toBe(true);
    expect(config.removed.every((l) => !l.startsWith("-"))).toBe(true);

    const app = files[1];
    expect(app.added).toContain("function newHelper() {}");
    expect(app.added).toContain("export { newHelper };");
    expect(app.removed).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(parseDiff("")).toEqual([]);
    expect(parseDiff("   ")).toEqual([]);
    expect(parseDiff("\n\n")).toEqual([]);
  });
});
