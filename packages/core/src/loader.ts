import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { parseConfig } from "./config.js";
import type { PocolenteConfig } from "./config.js";

export async function loadConfig(filePath: string): Promise<PocolenteConfig> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return parseConfig(undefined);
    }
    throw err;
  }
  const raw = parse(content);
  return parseConfig(raw);
}
