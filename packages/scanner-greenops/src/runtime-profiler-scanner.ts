import type { Scanner, ScanContext, Finding } from "@pocolente/core";
import { profileCommand, computeSci, formatSci } from "@pocolente/core";

export class RuntimeProfilerScanner implements Scanner {
  id = "runtime-profiler-scanner";
  name = "Runtime Profiler";
  layer = "greenops" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    if (!context.config.runtimeProfiling.enabled) return [];

    const command = context.config.runtimeProfiling.testCommand;
    const result = await profileCommand(command, { cwd: context.repoRoot, timeoutMs: 300_000 });

    const findings: Finding[] = [];

    if (result.error) {
      findings.push({
        layer: "greenops", scanner: this.id, severity: "info", confidence: 1.0,
        file: "", line: "",
        title: "Runtime profiling: command error",
        explanation: `Test command "${command}" encountered an error: ${result.error}`,
        suggestion: "Check that the test command is correct and the project is properly set up.",
        cwe: null, owasp: null, estimatedEnergyImpact: null, rcsDelta: null,
      });
      return findings;
    }

    // Compute SCI
    const sci = computeSci({ cpuMs: result.cpuMs });

    // Report metrics
    findings.push({
      layer: "greenops", scanner: this.id, severity: "info", confidence: 1.0,
      file: "", line: "",
      title: `Runtime profile: ${formatSci(sci)}`,
      explanation: `Test suite completed in ${result.wallClockMs.toFixed(0)}ms. CPU: ${result.cpuMs.toFixed(0)}ms, Peak memory: ${result.peakMemoryMb.toFixed(1)}MB. Exit code: ${result.exitCode}. ${result.exitCode !== 0 ? "Warning: tests exited with non-zero code." : ""}`,
      suggestion: "Compare with previous runs to track resource consumption trends.",
      cwe: null, owasp: null, estimatedEnergyImpact: null, rcsDelta: null,
    });

    return findings;
  }
}
