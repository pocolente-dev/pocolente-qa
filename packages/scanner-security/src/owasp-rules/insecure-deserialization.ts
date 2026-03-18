import type { DiffFile } from "@pocolente/core";
import type { OwaspRule, RuleMatch } from "./types.js";

// yaml.load( without a second argument containing schema or Loader
const YAML_LOAD_RE = /\byaml\.load\s*\(/;

// Known dangerous packages
const DANGEROUS_PACKAGE_RE = /["']node-serialize["']/;

// require() or import of a dangerous package
const REQUIRE_RE = /\brequire\s*\(/;
const IMPORT_RE = /\bimport\b/;

export const insecureDeserializationRule: OwaspRule = {
  id: "insecure-deserialization",
  name: "Insecure Deserialization",
  cwe: "CWE-502",
  owaspCategory: "A08:2021-Software-and-Data-Integrity-Failures",
  description:
    "Detected potential insecure deserialization: using unsafe deserialization methods can allow attackers to execute arbitrary code. Use safe deserialization methods with strict schemas.",

  testLine(line: string, lineNumber: number, _file: DiffFile): RuleMatch | null {
    // Check for dangerous package imports/requires
    if (DANGEROUS_PACKAGE_RE.test(line)) {
      if (REQUIRE_RE.test(line) || IMPORT_RE.test(line)) {
        return {
          line: lineNumber,
          matchedText: "node-serialize",
          confidence: 0.95,
          suggestion:
            "Avoid using node-serialize or similar packages that allow arbitrary code execution during deserialization. Use JSON.parse for plain data.",
        };
      }
    }

    // Check for yaml.load( usage
    if (YAML_LOAD_RE.test(line)) {
      // Safe if a second argument containing 'schema' or 'Loader' is present
      // Look for the call and check if it has a second argument with schema/Loader
      const hasSchema = /\bschema\b/.test(line) || /\bLoader\b/.test(line);
      if (hasSchema) return null;

      return {
        line: lineNumber,
        matchedText: "yaml.load(",
        confidence: 0.9,
        suggestion:
          "Use safe deserialization methods. For YAML, use yaml.load with { schema: yaml.SAFE_SCHEMA } or yaml.safeLoad.",
      };
    }

    return null;
  },
};
