import * as core from "@actions/core";
import { writeFileSync } from "node:fs";
import { simpleGit } from "simple-git";
import {
  loadConfig,
  runScanners,
  renderComment,
  filterFindings,
  deduplicateFindings,
  computeStatus,
  parseDiff,
  toSarif,
} from "@pocolente/core";
import { SecretsScanner, OwaspScanner, ALL_OWASP_RULES, SupplyChainScanner, PermissionsScanner } from "@pocolente/scanner-security";
import {
  GenerationQualityScanner,
  DeadCodeScanner,
  BehavioralDriftScanner,
  CoverageDeltaScanner,
} from "@pocolente/scanner-correctness";
import { ComplexityScanner, ResourceScanner, InfraBloatScanner } from "@pocolente/scanner-greenops";
import { computeRcs, rcsBadge } from "@pocolente/core";
import { createGitHubClient } from "./github.js";

async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token", { required: true });
    const configPath = core.getInput("config-path") || ".pocolente.yml";

    // Load config
    const config = await loadConfig(configPath);
    for (const warning of config.warnings) {
      core.warning(warning);
    }

    // Compute diff
    const baseBranch = process.env.GITHUB_BASE_REF ?? "main";
    const git = simpleGit();
    const diffOutput = await git.diff(["--unified=0", `origin/${baseBranch}...HEAD`]);
    const diff = parseDiff(diffOutput);

    if (diff.length === 0) {
      core.info("No file changes detected. Skipping scan.");
      return;
    }

    const context = {
      diff,
      config,
      repoRoot: process.cwd(),
      baseBranch,
      prBranch: process.env.GITHUB_HEAD_REF ?? "unknown",
    };

    // Register scanners
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

    // Run scan
    const startTime = performance.now();
    const results = await runScanners(scanners, context);
    const durationMs = performance.now() - startTime;

    // Process findings
    let allFindings = results.flatMap((r) => r.findings);
    allFindings = deduplicateFindings(allFindings);
    allFindings = filterFindings(allFindings, config.severityThreshold);

    const status = computeStatus(allFindings, config.blockPrOn);

    // Compute RCS
    const rcsDelta = computeRcs(allFindings);
    const badge = rcsBadge(rcsDelta, config.greenops.rcs.degradationThreshold);
    const rcs = { delta: rcsDelta, badge };

    // Post results
    const comment = renderComment(allFindings, status, durationMs, rcs);
    const gh = createGitHubClient(token);
    await gh.postComment(comment);
    await gh.setCommitStatus(
      status === "pass" ? "success" : "failure",
      status === "pass"
        ? "All checks passed"
        : `${allFindings.filter((f) => f.severity === "block").length} issue(s) found`,
    );

    // SARIF output
    if (config.reporting.sarifOutput) {
      const sarif = toSarif(allFindings, "pocolente-qa", "0.0.1");
      writeFileSync("pocolente-results.sarif", JSON.stringify(sarif, null, 2));
      core.info("SARIF report written to pocolente-results.sarif");
    }

    // Output
    core.setOutput("status", status);
    core.setOutput("finding-count", allFindings.length);

    if (status === "block") {
      core.setFailed("Pocolente QA: merge blocked due to findings");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Pocolente QA failed: ${message}`);
  }
}

run();
