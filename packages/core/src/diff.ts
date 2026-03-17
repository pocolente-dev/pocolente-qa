import type { DiffFile } from "./types.js";

export function parseDiff(diffOutput: string): DiffFile[] {
  if (!diffOutput || !diffOutput.trim()) {
    return [];
  }

  // Split on "diff --git " markers, keeping the rest of each chunk
  const chunks = diffOutput.split(/^diff --git /m).filter((chunk) => chunk.trim().length > 0);

  const results: DiffFile[] = [];

  for (const chunk of chunks) {
    // Extract file path from the "b/path" part of the header line
    // The first line of each chunk looks like: "a/src/config.ts b/src/config.ts"
    const headerMatch = chunk.match(/^[^\n]*\sb\/(.+?)(?:\s|$)/m);
    if (!headerMatch) {
      continue;
    }
    const path = headerMatch[1].trim();

    const added: string[] = [];
    const removed: string[] = [];
    const patchLines: string[] = [];

    const lines = chunk.split("\n");
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        const stripped = line.slice(1);
        added.push(stripped);
        patchLines.push(line);
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        const stripped = line.slice(1);
        removed.push(stripped);
        patchLines.push(line);
      }
    }

    results.push({
      path,
      added,
      removed,
      patch: patchLines.join("\n"),
    });
  }

  return results;
}
