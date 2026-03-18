import type { Scanner, ScanContext, Finding } from "@pocolente/core";

const YAML_EXTENSIONS = /\.(ya?ml)$/i;
const DOCKERFILE_PATTERN = /(^|[\\/])Dockerfile[^/\\]*$/i;

function isYamlFile(path: string): boolean {
  return YAML_EXTENSIONS.test(path);
}

function isDockerfile(path: string): boolean {
  return DOCKERFILE_PATTERN.test(path);
}

export class PermissionsScanner implements Scanner {
  id = "permissions-scanner";
  name = "Permission & Scope Analyzer";
  layer = "security" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    // Default: enabled=true, severity="warn" (no permissions section in config yet)
    const findings: Finding[] = [];

    for (const file of context.diff) {
      if (isYamlFile(file.path)) {
        findings.push(...this.scanYaml(file.path, file.added));
      } else if (isDockerfile(file.path)) {
        findings.push(...this.scanDockerfile(file.path, file.added));
      }
    }

    return findings;
  }

  private scanYaml(filePath: string, addedLines: string[]): Finding[] {
    const findings: Finding[] = [];

    for (let i = 0; i < addedLines.length; i++) {
      const line = addedLines[i];
      const lineNum = String(i + 1);

      // Detect wildcard resources
      if (/resources\s*:\s*\[?\s*["']?\*["']?\s*\]?/.test(line)) {
        findings.push({
          layer: "security",
          scanner: this.id,
          severity: "warn",
          confidence: 0.9,
          file: filePath,
          line: lineNum,
          title: "Wildcard resource permissions in K8s RBAC",
          explanation:
            'Using `resources: ["*"]` grants access to all resource types. Prefer explicit resource names.',
          suggestion: "Replace wildcard resources with explicit resource names.",
          cwe: "CWE-250",
          owasp: "A01:2021",
          estimatedEnergyImpact: null,
          rcsDelta: null,
        });
      }

      // Detect wildcard verbs
      if (/verbs\s*:\s*\[?\s*["']?\*["']?\s*\]?/.test(line)) {
        findings.push({
          layer: "security",
          scanner: this.id,
          severity: "warn",
          confidence: 0.9,
          file: filePath,
          line: lineNum,
          title: "Wildcard verb permissions in K8s RBAC",
          explanation:
            'Using `verbs: ["*"]` grants all operations. Prefer explicit verbs.',
          suggestion: "Replace wildcard verbs with explicit verbs (e.g., get, list, watch).",
          cwe: "CWE-250",
          owasp: "A01:2021",
          estimatedEnergyImpact: null,
          rcsDelta: null,
        });
      }

      // Detect container running as root via runAsUser: 0
      if (/runAsUser\s*:\s*0\b/.test(line)) {
        findings.push({
          layer: "security",
          scanner: this.id,
          severity: "warn",
          confidence: 0.95,
          file: filePath,
          line: lineNum,
          title: "Container running as root user (runAsUser: 0)",
          explanation:
            "Setting `runAsUser: 0` runs the container process as root, increasing blast radius.",
          suggestion: "Use a non-root UID (e.g., runAsUser: 1000) and set runAsNonRoot: true.",
          cwe: "CWE-250",
          owasp: "A05:2021",
          estimatedEnergyImpact: null,
          rcsDelta: null,
        });
      }

      // Detect runAsNonRoot: false
      if (/runAsNonRoot\s*:\s*false/.test(line)) {
        findings.push({
          layer: "security",
          scanner: this.id,
          severity: "warn",
          confidence: 0.85,
          file: filePath,
          line: lineNum,
          title: "Container allows root execution (runAsNonRoot: false)",
          explanation:
            "Setting `runAsNonRoot: false` allows the container to run as root.",
          suggestion: "Set runAsNonRoot: true to prevent root container execution.",
          cwe: "CWE-250",
          owasp: "A05:2021",
          estimatedEnergyImpact: null,
          rcsDelta: null,
        });
      }
    }

    return findings;
  }

  private scanDockerfile(filePath: string, addedLines: string[]): Finding[] {
    const findings: Finding[] = [];

    // Track the last USER directive in the added lines
    let lastUserLine: { value: string; lineNum: number } | null = null;
    let hasUserDirective = false;

    for (let i = 0; i < addedLines.length; i++) {
      const line = addedLines[i].trim();
      const userMatch = /^USER\s+(\S+)/i.exec(line);
      if (userMatch) {
        hasUserDirective = true;
        lastUserLine = { value: userMatch[1], lineNum: i + 1 };
      }
    }

    if (!hasUserDirective) {
      // No USER directive — defaults to root
      findings.push({
        layer: "security",
        scanner: this.id,
        severity: "warn",
        confidence: 0.8,
        file: filePath,
        line: "1",
        title: "Dockerfile has no USER directive — defaults to root",
        explanation:
          "Without a USER instruction, Docker runs the container as root by default.",
        suggestion: "Add a non-root USER instruction (e.g., USER node or USER 1000).",
        cwe: "CWE-250",
        owasp: "A05:2021",
        estimatedEnergyImpact: null,
        rcsDelta: null,
      });
    } else if (lastUserLine) {
      const user = lastUserLine.value.toLowerCase();
      if (user === "root" || user === "0") {
        findings.push({
          layer: "security",
          scanner: this.id,
          severity: "warn",
          confidence: 0.95,
          file: filePath,
          line: String(lastUserLine.lineNum),
          title: "Dockerfile final USER directive sets root",
          explanation: `The last USER directive sets the user to "${lastUserLine.value}", running the container as root.`,
          suggestion: "Switch to a non-root user at the end of the Dockerfile (e.g., USER node).",
          cwe: "CWE-250",
          owasp: "A05:2021",
          estimatedEnergyImpact: null,
          rcsDelta: null,
        });
      }
    }

    return findings;
  }
}
