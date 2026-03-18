import type { Scanner, ScanContext, Finding } from "@pocolente/core";

// ─── Image database ───────────────────────────────────────────────────────────

const BLOATED_IMAGES: Record<string, { sizeMb: number; alternative: string }> = {
  "node": { sizeMb: 900, alternative: "node:{version}-alpine" },
  "python": { sizeMb: 900, alternative: "python:{version}-slim" },
  "ruby": { sizeMb: 850, alternative: "ruby:{version}-slim" },
  "golang": { sizeMb: 800, alternative: "golang:{version}-alpine" },
  "openjdk": { sizeMb: 600, alternative: "eclipse-temurin:{version}-jre-alpine" },
  "java": { sizeMb: 600, alternative: "eclipse-temurin:{version}-jre-alpine" },
};

// Tags that indicate lean images — skip these
const LEAN_TAGS = ["alpine", "slim", "distroless", "scratch", "buster-slim", "bullseye-slim"];

// ─── File type helpers ────────────────────────────────────────────────────────

function isDockerfile(path: string): boolean {
  return /(?:^|[\\/])Dockerfile(?:\.[a-zA-Z0-9._-]+)?$/.test(path);
}

function isK8sYaml(path: string): boolean {
  return /\.(yaml|yml)$/.test(path) &&
    // k8s manifests often live under k8s/, deploy/, manifests/, etc.
    // We match broadly and rely on content checks.
    true;
}

function isDockerCompose(path: string): boolean {
  return /docker-compose(?:\.[a-zA-Z0-9._-]+)?\.(yaml|yml)$/.test(path);
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

export class InfraBloatScanner implements Scanner {
  id = "infra-bloat-scanner";
  name = "Infrastructure Bloat Scanner";
  layer = "greenops" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    if (!context.config.greenops.infrastructure.enabled) {
      return [];
    }

    const severity = context.config.greenops.infrastructure.severity;
    const findings: Finding[] = [];

    for (const file of context.diff) {
      if (isDockerfile(file.path)) {
        findings.push(...this.scanDockerfile(file.path, file.added, severity));
      } else if (isDockerCompose(file.path)) {
        findings.push(...this.scanDockerCompose(file.path, file.added, severity));
      } else if (isK8sYaml(file.path)) {
        findings.push(...this.scanK8sYaml(file.path, file.added, severity));
      }
    }

    return findings;
  }

  // ─── Dockerfile analysis ───────────────────────────────────────────────────

  private scanDockerfile(
    filePath: string,
    lines: string[],
    severity: "block" | "warn" | "info",
  ): Finding[] {
    const findings: Finding[] = [];
    const FROM_RE = /^\s*FROM\s+([^\s]+)/i;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(FROM_RE);
      if (!match) continue;

      const imageRef = match[1]; // e.g. "node:20", "python:3.12-slim", "scratch"
      // Strip digest (@sha256:...) if present
      const withoutDigest = imageRef.split("@")[0];
      const colonIdx = withoutDigest.indexOf(":");
      const imageName = colonIdx === -1 ? withoutDigest : withoutDigest.slice(0, colonIdx);
      const tag = colonIdx === -1 ? "" : withoutDigest.slice(colonIdx + 1);

      // Check if tag is already lean
      const isLean = LEAN_TAGS.some((t) => tag.toLowerCase().includes(t));
      if (isLean) continue;

      const info = BLOATED_IMAGES[imageName.toLowerCase()];

      // Flag `:latest` regardless of whether image is in our DB
      if (tag === "latest") {
        const suggestion = info
          ? `Use a pinned, minimal tag instead. Prefer ${info.alternative.replace("{version}", "LTS")} ` +
            `to reduce image size from ~${info.sizeMb} MB to ~50–100 MB and avoid unpredictable updates.`
          : `Pin to a specific version tag and prefer a minimal variant (e.g., -alpine or -slim) ` +
            `to reduce image size and avoid unpredictable updates.`;
        findings.push({
          layer: "greenops",
          scanner: "infra-bloat-scanner",
          severity,
          confidence: 0.95,
          file: filePath,
          line: String(i + 1),
          title: `Docker image uses :latest tag (${imageName}:latest)`,
          explanation:
            "Using :latest is unpredictable and often resolves to a full-fat image that is hundreds of MB larger than necessary.",
          suggestion,
          cwe: null,
          owasp: null,
          estimatedEnergyImpact: "medium",
          rcsDelta: "+2",
        });
        continue; // already flagged; skip the size check below for this line
      }

      // Flag known bloated images
      if (info) {
        findings.push({
          layer: "greenops",
          scanner: "infra-bloat-scanner",
          severity,
          confidence: 0.9,
          file: filePath,
          line: String(i + 1),
          title: `Bloated Docker base image: ${imageName}:${tag || "(untagged)"} (~${info.sizeMb} MB)`,
          explanation:
            `The base image ${imageName} without an alpine/slim variant is approximately ${info.sizeMb} MB. ` +
            "Larger images consume more bandwidth, storage, and energy in CI and deployment pipelines.",
          suggestion:
            `Switch to ${info.alternative.replace("{version}", tag || "LTS")} to reduce the image size ` +
            `from ~${info.sizeMb} MB to ~50–100 MB. This reduces CI pull times, storage costs, and energy use.`,
          cwe: null,
          owasp: null,
          estimatedEnergyImpact: "medium",
          rcsDelta: "+2",
        });
      }
    }

    return findings;
  }

  // ─── K8s YAML analysis ────────────────────────────────────────────────────

  private scanK8sYaml(
    filePath: string,
    lines: string[],
    severity: "block" | "warn" | "info",
  ): Finding[] {
    const text = lines.join("\n");

    // Only process files that look like K8s manifests with a containers section
    if (!text.includes("containers:")) {
      return [];
    }

    // If the diff also contains 'resources:' and 'limits:' we assume limits are set
    const hasResources = /\bresources\s*:/.test(text);
    const hasLimits = /\blimits\s*:/.test(text);

    if (hasResources && hasLimits) {
      return [];
    }

    return [
      {
        layer: "greenops",
        scanner: "infra-bloat-scanner",
        severity,
        confidence: 0.85,
        file: filePath,
        line: "1",
        title: "K8s containers missing resource limits",
        explanation:
          "Kubernetes containers without CPU/memory limits can consume unbounded resources, " +
          "causing noisy-neighbour effects, pod evictions, and wasted energy from over-provisioning.",
        suggestion:
          "Add a resources.limits section to each container spec:\n" +
          "  resources:\n    limits:\n      cpu: '500m'\n      memory: '256Mi'",
        cwe: null,
        owasp: null,
        estimatedEnergyImpact: "medium",
        rcsDelta: "+2",
      },
    ];
  }

  // ─── docker-compose analysis ──────────────────────────────────────────────

  private scanDockerCompose(
    filePath: string,
    lines: string[],
    severity: "block" | "warn" | "info",
  ): Finding[] {
    const text = lines.join("\n");

    if (!text.includes("services:")) {
      return [];
    }

    // Check for resource limits: deploy.resources.limits or just resources/limits keys
    const hasDeploy = /\bdeploy\s*:/.test(text);
    const hasResources = /\bresources\s*:/.test(text);
    const hasLimits = /\blimits\s*:/.test(text);

    if ((hasDeploy && hasResources && hasLimits) || (hasResources && hasLimits)) {
      return [];
    }

    return [
      {
        layer: "greenops",
        scanner: "infra-bloat-scanner",
        severity,
        confidence: 0.8,
        file: filePath,
        line: "1",
        title: "docker-compose services missing resource limits",
        explanation:
          "docker-compose services without resource limits can consume unbounded CPU and memory, " +
          "causing host resource exhaustion and unnecessary energy consumption.",
        suggestion:
          "Add a deploy.resources.limits section to each service:\n" +
          "  deploy:\n    resources:\n      limits:\n        cpus: '0.5'\n        memory: 256M",
        cwe: null,
        owasp: null,
        estimatedEnergyImpact: "medium",
        rcsDelta: "+2",
      },
    ];
  }
}
