import { resolve } from "node:path";
import { simpleGit } from "simple-git";
import {
  loadConfig, runScanners, filterFindings, deduplicateFindings, computeStatus, parseDiff, toSarif,
  computeRcs, rcsBadge,
} from "@pocolente/core";
import { SecretsScanner, OwaspScanner, ALL_OWASP_RULES, SupplyChainScanner, PermissionsScanner } from "@pocolente/scanner-security";
import {
  GenerationQualityScanner,
  DeadCodeScanner,
  BehavioralDriftScanner,
  CoverageDeltaScanner,
} from "@pocolente/scanner-correctness";
import { ComplexityScanner, ResourceScanner, InfraBloatScanner } from "@pocolente/scanner-greenops";
import { formatFindings } from "./formatter.js";
import { initConfig } from "./init.js";

interface CliArgs {
  command: "scan" | "init";
  path: string;
  diff?: string;
  layer?: string;
  format: "text" | "json";
  sarif: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const result: CliArgs = { command: "scan", path: ".", format: "text", sarif: false };
  let i = 0;
  while (i < args.length) {
    if (args[i] === "init") { result.command = "init"; i += 1; }
    else if (args[i] === "--diff" && args[i + 1]) { result.diff = args[i + 1]; i += 2; }
    else if (args[i] === "--layer" && args[i + 1]) { result.layer = args[i + 1]; i += 2; }
    else if (args[i] === "--format" && args[i + 1]) { result.format = args[i + 1] as "text" | "json"; i += 2; }
    else if (args[i] === "--sarif") { result.sarif = true; i += 1; }
    else if (args[i] === "scan") { i += 1; }
    else if (!args[i].startsWith("--")) { result.path = args[i]; i += 1; }
    else { i += 1; }
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Handle init command
  if (args.command === "init") {
    const result = await initConfig(process.cwd());
    console.log(result.message);
    process.exit(result.created ? 0 : 1);
  }

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

  const scanners = [
    // Security
    new SecretsScanner(),
    new OwaspScanner(ALL_OWASP_RULES),
    new SupplyChainScanner(),
    new PermissionsScanner(),
    // Correctness
    new GenerationQualityScanner(),
    new DeadCodeScanner(),
    new BehavioralDriftScanner(),
    new CoverageDeltaScanner(),
    // GreenOps
    new ComplexityScanner(),
    new ResourceScanner(),
    new InfraBloatScanner(),
  ];

  const startTime = performance.now();
  const results = await runScanners(scanners, context);
  const durationMs = performance.now() - startTime;

  let allFindings = results.flatMap((r) => r.findings);
  allFindings = deduplicateFindings(allFindings);
  allFindings = filterFindings(allFindings, config.severityThreshold);

  const status = computeStatus(allFindings, config.blockPrOn);

  // Compute RCS
  const rcsDelta = computeRcs(allFindings);
  const badge = rcsBadge(rcsDelta, config.greenops.rcs.degradationThreshold);
  const rcs = { delta: rcsDelta, badge };

  if (args.sarif) {
    const sarif = toSarif(allFindings, "pocolente-qa", "0.0.1");
    console.log(JSON.stringify(sarif, null, 2));
    process.exit(status === "block" ? 1 : 0);
  }

  if (args.format === "json") {
    console.log(JSON.stringify({ status, findings: allFindings, durationMs, rcs }, null, 2));
  } else {
    console.log(formatFindings(allFindings, status, durationMs));
  }

  process.exit(status === "block" ? 1 : 0);
}

main().catch((err) => {
  console.error(`Pocolente error: ${err.message}`);
  process.exit(2);
});
