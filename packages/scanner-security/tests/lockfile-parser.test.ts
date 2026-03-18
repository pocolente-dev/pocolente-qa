import { describe, it, expect } from "vitest";
import { parseAddedDependencies } from "../src/lockfile-parser.js";
import type { DiffFile } from "@pocolente/core";

describe("parseAddedDependencies", () => {
  it("extracts added packages from package-lock.json diff", () => {
    const diff: DiffFile = {
      path: "package-lock.json",
      added: [
        '    "lodash": {',
        '      "version": "4.17.21",',
        '      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",',
        '    "evil-package": {',
        '      "version": "1.0.0",',
      ],
      removed: [],
      patch: "",
    };
    const deps = parseAddedDependencies(diff);
    expect(deps).toHaveLength(2);
    expect(deps[0]).toEqual({ name: "lodash", version: "4.17.21" });
    expect(deps[1]).toEqual({ name: "evil-package", version: "1.0.0" });
  });

  it("extracts added packages from yarn.lock diff", () => {
    const diff: DiffFile = {
      path: "yarn.lock",
      added: [
        'axios@^1.6.0:',
        '  version "1.6.5"',
        '  resolved "https://registry.yarnpkg.com/axios/-/axios-1.6.5.tgz"',
      ],
      removed: [],
      patch: "",
    };
    const deps = parseAddedDependencies(diff);
    expect(deps).toHaveLength(1);
    expect(deps[0].name).toBe("axios");
    expect(deps[0].version).toBe("1.6.5");
  });

  it("returns empty for non-lockfile diffs", () => {
    const diff: DiffFile = { path: "src/app.ts", added: ["const x = 1;"], removed: [], patch: "" };
    expect(parseAddedDependencies(diff)).toHaveLength(0);
  });

  it("ignores removed packages (only processes added lines)", () => {
    const diff: DiffFile = {
      path: "package-lock.json",
      added: [],
      removed: ['    "old-package": {', '      "version": "0.1.0",'],
      patch: "",
    };
    expect(parseAddedDependencies(diff)).toHaveLength(0);
  });
});
