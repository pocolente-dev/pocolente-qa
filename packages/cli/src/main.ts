import { resolve } from "node:path";
import { simpleGit } from "simple-git";
import {
  loadConfig, runScanners, filterFindings, deduplicateFindings, computeStatus, parseDiff,
} from "@pocolente/core";
import { SecretsScanner } from "@pocolente/scanner-security";
import { formatFindings } from "./formatter.js";

interface CliArgs {
  path: string;
  diff?: string;
  layer?: string;
  format: "text" | "json";
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const result: CliArgs = { path: ".", format: "text" };
  let i = 0;
  while (i < args.length) {
    if (args[i] === "--diff" && args[i + 1]) { result.diff = args[i + 1]; i += 2; }
    else if (args[i] === "--layer" && args[i + 1]) { result.layer = args[i + 1]; i += 2; }
    else if (args[i] === "--format" && args[i + 1]) { result.format = args[i + 1] as "text" | "json"; i += 2; }
    else if (args[i] === "scan") { i += 1; }
    else if (!args[i].startsWith("--")) { result.path = args[i]; i += 1; }
    else { i += 1; }
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const repoRoot = resolve(args.path);
  const configPath = resolve(repoRoot, ".pocolente.yml");

  const config = await loadConfig(configPath);
  for (const warning of config.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  const git = simpleGit(repoRoot);
  const baseBranch = args.diff ?? "main";
  let diffOutput: string;
  try {
    diffOutput = await git.diff(["--unified=0", `${baseBranch}...HEAD`]);
  } catch {
    diffOutput = await git.diff(["--unified=0"]);
  }

  const diff = parseDiff(diffOutput);
  const context = { diff, config, repoRoot, baseBranch, prBranch: "HEAD" };

  const scanners = [new SecretsScanner()];

  const startTime = performance.now();
  const results = await runScanners(scanners, context);
  const durationMs = performance.now() - startTime;

  let allFindings = results.flatMap((r) => r.findings);
  allFindings = deduplicateFindings(allFindings);
  allFindings = filterFindings(allFindings, config.severityThreshold);

  const status = computeStatus(allFindings, config.blockPrOn);

  if (args.format === "json") {
    console.log(JSON.stringify({ status, findings: allFindings, durationMs }, null, 2));
  } else {
    console.log(formatFindings(allFindings, status, durationMs));
  }

  process.exit(status === "block" ? 1 : 0);
}

main().catch((err) => {
  console.error(`Pocolente error: ${err.message}`);
  process.exit(2);
});
