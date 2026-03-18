import type { Finding, Severity } from "./types.js";

export interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: { driver: { name: string; version: string; informationUri: string } };
  results: SarifResult[];
}

interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note";
  message: { text: string };
  locations: SarifLocation[];
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string };
    region: { startLine: number };
  };
}

const SEVERITY_TO_LEVEL: Record<Severity, "error" | "warning" | "note"> = {
  block: "error",
  warn: "warning",
  info: "note",
};

export function toSarif(
  findings: Finding[],
  toolName: string,
  toolVersion: string,
): SarifLog {
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            version: toolVersion,
            informationUri: "https://github.com/pocolente-dev/pocolente-qa",
          },
        },
        results: findings.map((f) => ({
          ruleId: f.cwe ? `${f.scanner}/${f.cwe}` : f.scanner,
          level: SEVERITY_TO_LEVEL[f.severity],
          message: { text: f.title },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.file },
                region: { startLine: parseInt(f.line, 10) || 1 },
              },
            },
          ],
        })),
      },
    ],
  };
}
