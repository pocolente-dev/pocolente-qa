import type { Scanner, ScanContext, Finding } from "@pocolente/core";
import type { OwaspRule } from "./owasp-rules/types.js";

const TS_JS_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|mjs|cts|cjs)$/;

export class OwaspScanner implements Scanner {
  id = "owasp-scanner";
  name = "OWASP Pattern Scanner";
  layer = "security" as const;

  constructor(private rules: OwaspRule[]) {}

  async scan(context: ScanContext): Promise<Finding[]> {
    if (!context.config.security.owasp.enabled) return [];

    const severity = context.config.security.owasp.severity;
    const findings: Finding[] = [];

    for (const file of context.diff) {
      if (!TS_JS_EXTENSIONS.test(file.path)) continue;

      for (let i = 0; i < file.added.length; i++) {
        const line = file.added[i];
        const lineNumber = i + 1;

        for (const rule of this.rules) {
          const match = rule.testLine(line, lineNumber, file);
          if (match) {
            findings.push({
              layer: "security",
              scanner: this.id,
              severity,
              confidence: match.confidence,
              file: file.path,
              line: String(lineNumber),
              title: `${rule.name}: ${rule.cwe}`,
              explanation: `${rule.description} Matched: \`${match.matchedText}\``,
              suggestion: match.suggestion,
              cwe: rule.cwe,
              owasp: rule.owaspCategory,
              estimatedEnergyImpact: null,
              rcsDelta: null,
            });
          }
        }
      }
    }

    return findings;
  }
}
