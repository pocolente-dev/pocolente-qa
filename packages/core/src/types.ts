export type Severity = "block" | "warn" | "info";

export type ScanLayer = "correctness" | "security" | "greenops";

export interface Finding {
  layer: ScanLayer;
  scanner: string;
  severity: Severity;
  confidence: number;
  file: string;
  line: string;
  title: string;
  explanation: string;
  suggestion: string;
  cwe: string | null;
  owasp: string | null;
  estimatedEnergyImpact: string | null;
  rcsDelta: string | null;
}

export interface ScannerResult {
  scannerId: string;
  layer: ScanLayer;
  findings: Finding[];
  durationMs: number;
  error: string | null;
}

export interface DiffFile {
  path: string;
  added: string[];
  removed: string[];
  patch: string;
}

export interface ScanContext {
  diff: DiffFile[];
  config: PocolenteConfig;
  repoRoot: string;
  baseBranch: string;
  prBranch: string;
  /** Populated by tree-sitter in Stage 1+. Not used in Stage 0. */
  parsedASTs?: Map<string, unknown>;
}

// Forward declaration — full type defined in config.ts
export type PocolenteConfig = Record<string, unknown>;
