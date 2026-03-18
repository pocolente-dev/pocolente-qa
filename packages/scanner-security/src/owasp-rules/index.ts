import type { OwaspRule } from "./types.js";
import { sqlInjectionRule } from "./sql-injection.js";
import { xssRule } from "./xss.js";
import { pathTraversalRule } from "./path-traversal.js";
import { ssrfRule } from "./ssrf.js";
import { insecureDeserializationRule } from "./insecure-deserialization.js";

export const ALL_OWASP_RULES: OwaspRule[] = [
  sqlInjectionRule,
  xssRule,
  pathTraversalRule,
  ssrfRule,
  insecureDeserializationRule,
];

export type { OwaspRule } from "./types.js";
