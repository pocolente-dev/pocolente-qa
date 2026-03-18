import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_CONFIG = `# Pocolente QA Configuration
# Docs: https://github.com/pocolente/pocolente
version: 1

severity_threshold: warn
block_pr_on: block

scan_paths:
  include: ["src/**", "lib/**"]
  exclude: ["**/*.test.*", "**/*.spec.*"]

security:
  secrets:
    severity: block
  owasp:
    severity: block
  supply_chain:
    severity: warn

greenops:
  enabled: true
`;

export async function initConfig(
  targetDir: string,
): Promise<{ created: boolean; message: string }> {
  const filePath = join(targetDir, ".pocolente.yml");

  try {
    await access(filePath);
    return { created: false, message: "Config already exists at .pocolente.yml" };
  } catch {
    await writeFile(filePath, DEFAULT_CONFIG, "utf-8");
    return { created: true, message: "Created .pocolente.yml — customize as needed" };
  }
}
