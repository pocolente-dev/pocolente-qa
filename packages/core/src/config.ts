import { z } from "zod";

// ─── Severity helpers ────────────────────────────────────────────────────────

const SeveritySchema = z.enum(["block", "warn", "info"]);
const BlockPrOnSchema = z.enum(["block", "warn", "info", "none"]);

// ─── Input schemas (snake_case, from YAML) ───────────────────────────────────

const ScanPathsInputSchema = z.object({
  include: z.array(z.string()).default(["src/**", "lib/**", "packages/**"]),
  exclude: z.array(z.string()).default(["**/*.test.*", "**/*.spec.*", "vendor/**"]),
});

const CoverageInputSchema = z.object({
  enabled: z.boolean().default(true),
  maxDecreasePercent: z.number().default(2.0),
  baseCoveragePath: z.string().default(""),
  prCoveragePath: z.string().default(""),
  coverageFormat: z.string().default("lcov"),
});

const DeadCodeInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("warn"),
});

const BehavioralDriftInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("block"),
});

const GenerationQualityInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("warn"),
  llmEnhanced: z.boolean().default(false),
  llmProvider: z.string().default("anthropic"),
});

const DependenciesInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("warn"),
  maxAgeDays: z.number().default(730),
  blockOnCriticalCve: z.boolean().default(true),
});

const CorrectnessInputSchema = z.object({
  enabled: z.boolean().default(true),
  coverage: CoverageInputSchema.default({}),
  deadCode: DeadCodeInputSchema.default({}),
  behavioralDrift: BehavioralDriftInputSchema.default({}),
  generationQuality: GenerationQualityInputSchema.default({}),
  dependencies: DependenciesInputSchema.default({}),
});

const SecretsInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("block"),
  customPatterns: z.array(z.string()).default([]),
  allowlist: z.array(z.string()).default([]),
});

const OwaspInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("block"),
});

const SupplyChainInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("warn"),
  blockOnInstallScripts: z.boolean().default(false),
});

const EuComplianceInputSchema = z.object({
  enabled: z.boolean().default(false),
});

const SecurityInputSchema = z.object({
  enabled: z.boolean().default(true),
  secrets: SecretsInputSchema.default({}),
  owasp: OwaspInputSchema.default({}),
  supplyChain: SupplyChainInputSchema.default({}),
  euCompliance: EuComplianceInputSchema.default({}),
});

const ComplexityInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("warn"),
});

const ResourcesInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("warn"),
});

const InfrastructureInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("warn"),
  maxBaseImageMb: z.number().default(200),
});

const RcsInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("info"),
  trendBadge: z.boolean().default(true),
  degradationThreshold: z.number().default(5),
});

const GreenopsInputSchema = z.object({
  enabled: z.boolean().default(true),
  complexity: ComplexityInputSchema.default({}),
  resources: ResourcesInputSchema.default({}),
  infrastructure: InfrastructureInputSchema.default({}),
  rcs: RcsInputSchema.default({}),
});

const RuntimeProfilingInputSchema = z.object({
  enabled: z.boolean().default(false),
  testCommand: z.string().default("npm test"),
  warnOnCpuIncreasePercent: z.number().default(20),
  warnOnMemoryIncreasePercent: z.number().default(25),
});

const ReportingInputSchema = z.object({
  dashboardUrl: z.string().default(""),
  dashboardApiKey: z.string().default(""),
  sarifOutput: z.boolean().default(false),
  jsonOutput: z.boolean().default(false),
});

const RawConfigSchema = z.object({
  version: z.number().default(1),
  severity_threshold: SeveritySchema.default("warn"),
  block_pr_on: BlockPrOnSchema.default("block"),
  scan_paths: ScanPathsInputSchema.default({}),
  correctness: CorrectnessInputSchema.default({}),
  security: SecurityInputSchema.default({}),
  greenops: GreenopsInputSchema.default({}),
  runtime_profiling: RuntimeProfilingInputSchema.default({}),
  reporting: ReportingInputSchema.default({}),
});

// ─── Output interface (camelCase) ─────────────────────────────────────────────

export interface PocolenteConfig {
  version: number;
  severityThreshold: "block" | "warn" | "info";
  blockPrOn: "block" | "warn" | "info" | "none";
  scanPaths: {
    include: string[];
    exclude: string[];
  };
  correctness: {
    enabled: boolean;
    coverage: {
      enabled: boolean;
      maxDecreasePercent: number;
      baseCoveragePath: string;
      prCoveragePath: string;
      coverageFormat: string;
    };
    deadCode: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
    };
    behavioralDrift: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
    };
    generationQuality: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
      llmEnhanced: boolean;
      llmProvider: string;
    };
    dependencies: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
      maxAgeDays: number;
      blockOnCriticalCve: boolean;
    };
  };
  security: {
    enabled: boolean;
    secrets: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
      customPatterns: string[];
      allowlist: string[];
    };
    owasp: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
    };
    supplyChain: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
      blockOnInstallScripts: boolean;
    };
    euCompliance: {
      enabled: boolean;
    };
  };
  greenops: {
    enabled: boolean;
    complexity: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
    };
    resources: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
    };
    infrastructure: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
      maxBaseImageMb: number;
    };
    rcs: {
      enabled: boolean;
      severity: "block" | "warn" | "info";
      trendBadge: boolean;
      degradationThreshold: number;
    };
  };
  runtimeProfiling: {
    enabled: boolean;
    testCommand: string;
    warnOnCpuIncreasePercent: number;
    warnOnMemoryIncreasePercent: number;
  };
  reporting: {
    dashboardUrl: string;
    dashboardApiKey: string;
    sarifOutput: boolean;
    jsonOutput: boolean;
  };
  warnings: string[];
}

// ─── Main parser ──────────────────────────────────────────────────────────────

function parseConfigFromParsed(
  parsed: z.infer<typeof RawConfigSchema>
): PocolenteConfig {
  const warnings: string[] = [];

  // Runtime profiling guard
  let runtimeProfilingEnabled = parsed.runtime_profiling.enabled;
  if (runtimeProfilingEnabled) {
    warnings.push(
      "Runtime profiling is not yet available. This setting will be ignored."
    );
    runtimeProfilingEnabled = false;
  }

  return {
    version: parsed.version,
    severityThreshold: parsed.severity_threshold,
    blockPrOn: parsed.block_pr_on,
    scanPaths: {
      include: parsed.scan_paths.include,
      exclude: parsed.scan_paths.exclude,
    },
    correctness: {
      enabled: parsed.correctness.enabled,
      coverage: {
        enabled: parsed.correctness.coverage.enabled,
        maxDecreasePercent: parsed.correctness.coverage.maxDecreasePercent,
        baseCoveragePath: parsed.correctness.coverage.baseCoveragePath,
        prCoveragePath: parsed.correctness.coverage.prCoveragePath,
        coverageFormat: parsed.correctness.coverage.coverageFormat,
      },
      deadCode: {
        enabled: parsed.correctness.deadCode.enabled,
        severity: parsed.correctness.deadCode.severity,
      },
      behavioralDrift: {
        enabled: parsed.correctness.behavioralDrift.enabled,
        severity: parsed.correctness.behavioralDrift.severity,
      },
      generationQuality: {
        enabled: parsed.correctness.generationQuality.enabled,
        severity: parsed.correctness.generationQuality.severity,
        llmEnhanced: parsed.correctness.generationQuality.llmEnhanced,
        llmProvider: parsed.correctness.generationQuality.llmProvider,
      },
      dependencies: {
        enabled: parsed.correctness.dependencies.enabled,
        severity: parsed.correctness.dependencies.severity,
        maxAgeDays: parsed.correctness.dependencies.maxAgeDays,
        blockOnCriticalCve: parsed.correctness.dependencies.blockOnCriticalCve,
      },
    },
    security: {
      enabled: parsed.security.enabled,
      secrets: {
        enabled: parsed.security.secrets.enabled,
        severity: parsed.security.secrets.severity,
        customPatterns: parsed.security.secrets.customPatterns,
        allowlist: parsed.security.secrets.allowlist,
      },
      owasp: {
        enabled: parsed.security.owasp.enabled,
        severity: parsed.security.owasp.severity,
      },
      supplyChain: {
        enabled: parsed.security.supplyChain.enabled,
        severity: parsed.security.supplyChain.severity,
        blockOnInstallScripts: parsed.security.supplyChain.blockOnInstallScripts,
      },
      euCompliance: {
        enabled: parsed.security.euCompliance.enabled,
      },
    },
    greenops: {
      enabled: parsed.greenops.enabled,
      complexity: {
        enabled: parsed.greenops.complexity.enabled,
        severity: parsed.greenops.complexity.severity,
      },
      resources: {
        enabled: parsed.greenops.resources.enabled,
        severity: parsed.greenops.resources.severity,
      },
      infrastructure: {
        enabled: parsed.greenops.infrastructure.enabled,
        severity: parsed.greenops.infrastructure.severity,
        maxBaseImageMb: parsed.greenops.infrastructure.maxBaseImageMb,
      },
      rcs: {
        enabled: parsed.greenops.rcs.enabled,
        severity: parsed.greenops.rcs.severity,
        trendBadge: parsed.greenops.rcs.trendBadge,
        degradationThreshold: parsed.greenops.rcs.degradationThreshold,
      },
    },
    runtimeProfiling: {
      enabled: runtimeProfilingEnabled,
      testCommand: parsed.runtime_profiling.testCommand,
      warnOnCpuIncreasePercent: parsed.runtime_profiling.warnOnCpuIncreasePercent,
      warnOnMemoryIncreasePercent: parsed.runtime_profiling.warnOnMemoryIncreasePercent,
    },
    reporting: {
      dashboardUrl: parsed.reporting.dashboardUrl,
      dashboardApiKey: parsed.reporting.dashboardApiKey,
      sarifOutput: parsed.reporting.sarifOutput,
      jsonOutput: parsed.reporting.jsonOutput,
    },
    warnings,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseConfig(raw: unknown): PocolenteConfig {
  const input = raw === undefined || raw === null ? {} : raw;
  const parsed = RawConfigSchema.parse(input);
  return parseConfigFromParsed(parsed);
}

export const DEFAULT_CONFIG: PocolenteConfig = parseConfigFromParsed(
  RawConfigSchema.parse({})
);
