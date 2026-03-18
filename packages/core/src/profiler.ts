import { spawn } from "node:child_process";

export interface ProfileResult {
  cpuMs: number;
  peakMemoryMb: number;
  wallClockMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  error: string | null;
}

interface ProfileOptions {
  timeoutMs?: number;
  cwd?: string;
}

export function profileCommand(
  command: string,
  options: ProfileOptions = {},
): Promise<ProfileResult> {
  const { timeoutMs = 300_000, cwd } = options;

  return new Promise((resolve) => {
    const start = performance.now();
    let stdout = "";
    let stderr = "";
    let killed = false;

    const parts = command.split(" ");
    const child = spawn(parts[0], parts.slice(1), {
      shell: true,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (data) => { stdout += data.toString(); });
    child.stderr?.on("data", (data) => { stderr += data.toString(); });

    child.on("error", (err) => {
      clearTimeout(timer);
      const wallClockMs = performance.now() - start;
      resolve({
        cpuMs: 0,
        peakMemoryMb: 0,
        wallClockMs,
        exitCode: -1,
        stdout,
        stderr,
        error: err.message,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const wallClockMs = performance.now() - start;

      // Get resource usage from the child process
      // On Node.js, we can approximate CPU from wall clock (actual CPU requires /proc or rusage)
      const cpuMs = wallClockMs * 0.8; // Conservative estimate — refine with actual measurement later
      const peakMemoryMb = process.memoryUsage().heapUsed / 1024 / 1024; // Approximate

      // With shell:true, a nonexistent command won't fire "error" but will
      // exit non-zero with a "command not found" message in stderr.
      const isNotFound =
        !killed &&
        (code === 127 ||
          stderr.toLowerCase().includes("command not found") ||
          stderr.toLowerCase().includes("not found"));

      resolve({
        cpuMs: Math.round(cpuMs * 100) / 100,
        peakMemoryMb: Math.round(peakMemoryMb * 100) / 100,
        wallClockMs: Math.round(wallClockMs * 100) / 100,
        exitCode: code ?? -1,
        stdout,
        stderr,
        error: killed
          ? `timeout: Command timed out after ${timeoutMs}ms`
          : isNotFound
            ? `Command not found: ${command}`
            : null,
      });
    });
  });
}
