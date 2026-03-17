import * as core from "@actions/core";
import { simpleGit } from "simple-git";
import {
  loadConfig,
  runScanners,
  renderComment,
  filterFindings,
  deduplicateFindings,
  computeStatus,
  parseDiff,
} from "@pocolente/core";
import { SecretsScanner } from "@pocolente/scanner-security";
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
    const scanners = [new SecretsScanner()];

    // Run scan
    const startTime = performance.now();
    const results = await runScanners(scanners, context);
    const durationMs = performance.now() - startTime;

    // Process findings
    let allFindings = results.flatMap((r) => r.findings);
    allFindings = deduplicateFindings(allFindings);
    allFindings = filterFindings(allFindings, config.severityThreshold);

    const status = computeStatus(allFindings, config.blockPrOn);

    // Post results
    const comment = renderComment(allFindings, status, durationMs);
    const gh = createGitHubClient(token);
    await gh.postComment(comment);
    await gh.setCommitStatus(
      status === "pass" ? "success" : "failure",
      status === "pass"
        ? "All checks passed"
        : `${allFindings.filter((f) => f.severity === "block").length} issue(s) found`,
    );

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
