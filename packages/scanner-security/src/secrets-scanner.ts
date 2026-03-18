import type { Scanner, ScanContext, Finding } from "@pocolente/core";
import { matchSecretPatterns } from "./secrets-patterns.js";
import { isHighEntropySecret } from "./entropy.js";

const PATTERN_TITLES: Record<string, string> = {
  "aws-access-key": "AWS Access Key detected",
  "github-token": "GitHub Token detected",
  "stripe-secret-key": "Stripe Secret Key detected",
  "private-key": "Private Key header detected",
  "database-url": "Database URL with credentials detected",
  "jwt": "JWT token detected",
  "slack-webhook": "Slack Webhook URL detected",
  "gcp-api-key": "GCP API Key detected",
  "generic-secret-assignment": "Potential secret assignment detected",
};

export class SecretsScanner implements Scanner {
  id = "secrets-scanner";
  name = "Secrets Scanner";
  layer = "security" as const;

  async scan(context: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const allowlist = context.config.security.secrets.allowlist;
    const severity = context.config.security.secrets.severity;

    for (const file of context.diff) {
      for (let i = 0; i < file.added.length; i++) {
        const line = file.added[i];
        const matches = matchSecretPatterns(line);

        // Use the highest-confidence (first) non-allowlisted, non-generic match per line
        const specificMatch = matches.find(
          (match) =>
            match.patternName !== "generic-secret-assignment" &&
            !allowlist.some((a) => match.matched.includes(a))
        );

        // Fall back to generic pattern only if no specific match and no entropy match
        const genericMatch = !specificMatch
          ? matches.find(
              (match) =>
                match.patternName === "generic-secret-assignment" &&
                !allowlist.some((a) => match.matched.includes(a))
            )
          : undefined;

        // Entropy fallback: fires when no specific pattern matched (generic is overridden by entropy)
        const entropyMatch = !specificMatch
          ? isHighEntropySecret(line)
          : null;

        // Priority: specific pattern > entropy > generic pattern
        const firstMatch = specificMatch ?? undefined;

        if (firstMatch) {
          const title =
            PATTERN_TITLES[firstMatch.patternName] ??
            `Secret detected: ${firstMatch.patternName}`;

          findings.push({
            layer: "security",
            scanner: "secrets-scanner",
            severity,
            confidence: firstMatch.confidence,
            file: file.path,
            line: String(i + 1),
            title,
            explanation: `A ${firstMatch.patternName} pattern was detected in the added lines of this file. Committing secrets to source control exposes credentials to anyone with repository access.`,
            suggestion:
              "Remove the secret from source code and use environment variables or a secrets manager instead.",
            cwe: "CWE-798",
            owasp: null,
            estimatedEnergyImpact: null,
            rcsDelta: null,
          });
        } else if (entropyMatch) {
          findings.push({
            layer: "security",
            scanner: "secrets-scanner",
            severity,
            confidence: entropyMatch.confidence,
            file: file.path,
            line: String(i + 1),
            title: "High-entropy string detected (potential secret)",
            explanation: `A high-entropy string (entropy: ${entropyMatch.entropy.toFixed(2)}) was detected in the added lines of this file. High-entropy strings often indicate secrets or credentials.`,
            suggestion:
              "Remove the secret from source code and use environment variables or a secrets manager instead.",
            cwe: "CWE-798",
            owasp: null,
            estimatedEnergyImpact: null,
            rcsDelta: null,
          });
        } else if (genericMatch) {
          const title =
            PATTERN_TITLES[genericMatch.patternName] ??
            `Secret detected: ${genericMatch.patternName}`;

          findings.push({
            layer: "security",
            scanner: "secrets-scanner",
            severity,
            confidence: genericMatch.confidence,
            file: file.path,
            line: String(i + 1),
            title,
            explanation: `A ${genericMatch.patternName} pattern was detected in the added lines of this file. Committing secrets to source control exposes credentials to anyone with repository access.`,
            suggestion:
              "Remove the secret from source code and use environment variables or a secrets manager instead.",
            cwe: "CWE-798",
            owasp: null,
            estimatedEnergyImpact: null,
            rcsDelta: null,
          });
        }
      }
    }

    return findings;
  }
}
