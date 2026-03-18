import type { Scanner, ScanContext, Finding } from "@pocolente/core";
import { parseAddedDependencies } from "./lockfile-parser.js";
import { checkTyposquatting } from "./typosquatting.js";
import { queryOsv } from "./osv-client.js";
import type { OsvVulnerability } from "./osv-client.js";

export class SupplyChainScanner implements Scanner {
  id = "supply-chain-scanner";
  name = "Supply Chain Scanner";
  layer = "security" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    if (!context.config.security.supplyChain.enabled) return [];

    const severity = context.config.security.supplyChain.severity;
    const findings: Finding[] = [];

    for (const file of context.diff) {
      const deps = parseAddedDependencies(file);
      if (deps.length === 0) continue;

      // Collect OSV queries in parallel, typosquatting runs synchronously
      const osvPromises = deps.map((dep) => queryOsv(dep.name, dep.version));
      const osvResults = await Promise.all(osvPromises);

      for (let i = 0; i < deps.length; i++) {
        const dep = deps[i];

        // Typosquatting check
        const typoMatch = checkTyposquatting(dep.name);
        if (typoMatch) {
          findings.push({
            layer: "security",
            scanner: this.id,
            severity: "warn",
            confidence: 0.8,
            file: file.path,
            line: "0",
            title: `Potential typosquatting: ${dep.name} is similar to ${typoMatch.similarTo}`,
            explanation: `The package "${dep.name}" has a Levenshtein distance of ${typoMatch.distance} from the popular package "${typoMatch.similarTo}". This may indicate a typosquatting attack.`,
            suggestion: `Verify that "${dep.name}" is the intended package. If you meant "${typoMatch.similarTo}", update your dependency.`,
            cwe: "CWE-829",
            owasp: "A08:2021-Software and Data Integrity Failures",
            estimatedEnergyImpact: null,
            rcsDelta: null,
          });
        }

        // OSV vulnerability findings
        const vulns: OsvVulnerability[] = osvResults[i];
        for (const vuln of vulns) {
          const vulnSeverity = mapOsvSeverity(vuln.severity, severity);
          findings.push({
            layer: "security",
            scanner: this.id,
            severity: vulnSeverity,
            confidence: 1.0,
            file: file.path,
            line: "0",
            title: `Known vulnerability in ${dep.name}@${dep.version}: ${vuln.id}`,
            explanation: vuln.summary || `Vulnerability ${vuln.id} affects ${dep.name}@${dep.version}.`,
            suggestion: `Upgrade ${dep.name} to a version that does not contain this vulnerability. Check https://osv.dev/vulnerability/${vuln.id} for more details.`,
            cwe: null,
            owasp: "A06:2021-Vulnerable and Outdated Components",
            estimatedEnergyImpact: null,
            rcsDelta: null,
          });
        }
      }
    }

    return findings;
  }
}

function mapOsvSeverity(
  osvSeverity: unknown,
  defaultSeverity: "block" | "warn" | "info",
): "block" | "warn" | "info" {
  const raw = typeof osvSeverity === "string" ? osvSeverity : "";
  const normalized = raw.toUpperCase();
  if (normalized === "CRITICAL" || normalized === "HIGH") return "block";
  if (normalized === "MODERATE" || normalized === "MEDIUM") return "warn";
  if (normalized === "LOW") return "info";
  return defaultSeverity;
}
