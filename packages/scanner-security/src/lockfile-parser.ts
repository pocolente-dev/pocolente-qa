import type { DiffFile } from "@pocolente/core";

export interface AddedDependency {
  name: string;
  version: string;
}

// Matches: `    "package-name": {`
const NPM_NAME_RE = /^\s+"([^"]+)":\s*\{/;
// Matches: `      "version": "x.y.z",`
const NPM_VERSION_RE = /^\s+"version":\s+"([^"]+)"/;

// Matches: `package-name@^semver:` or `@scope/package-name@semver:`
const YARN_NAME_RE = /^((?:@[^@/]+\/)?[^@\s,]+)@/;
// Matches: `  version "x.y.z"`
const YARN_VERSION_RE = /^\s+version "([^"]+)"/;

function parseNpmLock(added: string[]): AddedDependency[] {
  const results: AddedDependency[] = [];
  let pendingName: string | null = null;

  for (const line of added) {
    if (pendingName === null) {
      const nameMatch = NPM_NAME_RE.exec(line);
      if (nameMatch) {
        pendingName = nameMatch[1];
      }
    } else {
      const versionMatch = NPM_VERSION_RE.exec(line);
      if (versionMatch) {
        results.push({ name: pendingName, version: versionMatch[1] });
        pendingName = null;
      } else if (NPM_NAME_RE.test(line)) {
        // New package entry encountered before finding version — reset
        const nameMatch = NPM_NAME_RE.exec(line);
        pendingName = nameMatch ? nameMatch[1] : null;
      }
    }
  }

  return results;
}

function parseYarnLock(added: string[]): AddedDependency[] {
  const results: AddedDependency[] = [];
  let pendingName: string | null = null;

  for (const line of added) {
    if (pendingName === null) {
      const nameMatch = YARN_NAME_RE.exec(line);
      // Yarn package headers end with ':'
      if (nameMatch && line.trimEnd().endsWith(":")) {
        pendingName = nameMatch[1];
      }
    } else {
      const versionMatch = YARN_VERSION_RE.exec(line);
      if (versionMatch) {
        results.push({ name: pendingName, version: versionMatch[1] });
        pendingName = null;
      } else if (YARN_NAME_RE.test(line) && line.trimEnd().endsWith(":")) {
        // New package block before version found
        const nameMatch = YARN_NAME_RE.exec(line);
        pendingName = nameMatch ? nameMatch[1] : null;
      }
    }
  }

  return results;
}

export function parseAddedDependencies(diff: DiffFile): AddedDependency[] {
  const filename = diff.path.split("/").pop() ?? diff.path;

  if (filename === "package-lock.json") {
    return parseNpmLock(diff.added);
  }

  if (filename === "yarn.lock") {
    return parseYarnLock(diff.added);
  }

  return [];
}
