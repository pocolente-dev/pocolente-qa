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
  max_decrease_percent: z.number().default(2.0),
  base_coverage_path: z.string().default(""),
  pr_coverage_path: z.string().default(""),
  coverage_format: z.string().default("lcov"),
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
  llm_enhanced: z.boolean().default(false),
  llm_provider: z.string().default("anthropic"),
});

const DependenciesInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("warn"),
  max_age_days: z.number().default(730),
  block_on_critical_cve: z.boolean().default(true),
});

const CorrectnessInputSchema = z.object({
  enabled: z.boolean().default(true),
  coverage: CoverageInputSchema.default({}),
  dead_code: DeadCodeInputSchema.default({}),
  behavioral_drift: BehavioralDriftInputSchema.default({}),
  generation_quality: GenerationQualityInputSchema.default({}),
  dependencies: DependenciesInputSchema.default({}),
});

const SecretsInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("block"),
  custom_patterns: z.array(z.string()).default([]),
  allowlist: z.array(z.string()).default([]),
});

const OwaspInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("block"),
});

const SupplyChainInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("warn"),
  block_on_install_scripts: z.boolean().default(false),
});

const EuComplianceInputSchema = z.object({
  enabled: z.boolean().default(false),
});

const SecurityInputSchema = z.object({
  enabled: z.boolean().default(true),
  secrets: SecretsInputSchema.default({}),
  owasp: OwaspInputSchema.default({}),
  supply_chain: SupplyChainInputSchema.default({}),
  eu_compliance: EuComplianceInputSchema.default({}),
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
  max_base_image_mb: z.number().default(200),
});

const RcsInputSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.default("info"),
  trend_badge: z.boolean().default(true),
  degradation_threshold: z.number().default(5),
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
  test_command: z.string().default("npm test"),
  warn_on_cpu_increase_percent: z.number().default(20),
  warn_on_memory_increase_percent: z.number().default(25),
});

const ReportingInputSchema = z.object({
  dashboard_url: z.string().default(""),
  dashboard_api_key: z.string().default(""),
  sarif_output: z.boolean().default(false),
  json_output: z.boolean().default(false),
});

const RawConfigSchema = z.object({
  version: z.number().default(1),
  severity_threshold: SeveritySchema.default("warn"),
  block_pr_on: BlockPrOnSchema.default("block"),
  min_confidence: z.number().min(0).max(1).default(0.85),
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
  minConfidence: number;
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
    minConfidence: parsed.min_confidence,
    scanPaths: {
      include: parsed.scan_paths.include,
      exclude: parsed.scan_paths.exclude,
    },
    correctness: {
      enabled: parsed.correctness.enabled,
      coverage: {
        enabled: parsed.correctness.coverage.enabled,
        maxDecreasePercent: parsed.correctness.coverage.max_decrease_percent,
        baseCoveragePath: parsed.correctness.coverage.base_coverage_path,
        prCoveragePath: parsed.correctness.coverage.pr_coverage_path,
        coverageFormat: parsed.correctness.coverage.coverage_format,
      },
      deadCode: {
        enabled: parsed.correctness.dead_code.enabled,
        severity: parsed.correctness.dead_code.severity,
      },
      behavioralDrift: {
        enabled: parsed.correctness.behavioral_drift.enabled,
        severity: parsed.correctness.behavioral_drift.severity,
      },
      generationQuality: {
        enabled: parsed.correctness.generation_quality.enabled,
        severity: parsed.correctness.generation_quality.severity,
        llmEnhanced: parsed.correctness.generation_quality.llm_enhanced,
        llmProvider: parsed.correctness.generation_quality.llm_provider,
      },
      dependencies: {
        enabled: parsed.correctness.dependencies.enabled,
        severity: parsed.correctness.dependencies.severity,
        maxAgeDays: parsed.correctness.dependencies.max_age_days,
        blockOnCriticalCve: parsed.correctness.dependencies.block_on_critical_cve,
      },
    },
    security: {
      enabled: parsed.security.enabled,
      secrets: {
        enabled: parsed.security.secrets.enabled,
        severity: parsed.security.secrets.severity,
        customPatterns: parsed.security.secrets.custom_patterns,
        allowlist: parsed.security.secrets.allowlist,
      },
      owasp: {
        enabled: parsed.security.owasp.enabled,
        severity: parsed.security.owasp.severity,
      },
      supplyChain: {
        enabled: parsed.security.supply_chain.enabled,
        severity: parsed.security.supply_chain.severity,
        blockOnInstallScripts: parsed.security.supply_chain.block_on_install_scripts,
      },
      euCompliance: {
        enabled: parsed.security.eu_compliance.enabled,
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
        maxBaseImageMb: parsed.greenops.infrastructure.max_base_image_mb,
      },
      rcs: {
        enabled: parsed.greenops.rcs.enabled,
        severity: parsed.greenops.rcs.severity,
        trendBadge: parsed.greenops.rcs.trend_badge,
        degradationThreshold: parsed.greenops.rcs.degradation_threshold,
      },
    },
    runtimeProfiling: {
      enabled: runtimeProfilingEnabled,
      testCommand: parsed.runtime_profiling.test_command,
      warnOnCpuIncreasePercent: parsed.runtime_profiling.warn_on_cpu_increase_percent,
      warnOnMemoryIncreasePercent: parsed.runtime_profiling.warn_on_memory_increase_percent,
    },
    reporting: {
      dashboardUrl: parsed.reporting.dashboard_url,
      dashboardApiKey: parsed.reporting.dashboard_api_key,
      sarifOutput: parsed.reporting.sarif_output,
      jsonOutput: parsed.reporting.json_output,
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
