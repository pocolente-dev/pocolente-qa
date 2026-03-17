# Pocolente QA Harness — Stage 1: Security Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a credible security scanner worth installing — hardened secrets detection with entropy fallback, OWASP vulnerability pattern detection for TypeScript/JavaScript, supply chain risk analysis for npm lockfiles, and SARIF output for GitHub Security tab integration.

**Architecture:** Extends the existing `@pocolente/scanner-security` package with three new scanners (OWASP, Supply Chain, Secrets entropy enhancement) plus a SARIF formatter in `@pocolente/core`. The OWASP scanner uses a rule-based pattern matching approach on source code lines from the diff — each rule targets a specific CWE with regex patterns that detect common vulnerability idioms in TS/JS. This ships a working scanner quickly; tree-sitter AST integration is deferred to Stage 2 where it's also needed for the correctness layer (dead code, behavioral drift). The `Scanner` plugin interface is unchanged — new scanners implement the same `scan(context): Promise<Finding[]>` contract.

**Tech Stack:** TypeScript, Vitest, Zod (existing). New: built-in `fetch` (Node 20) for OSV API, `fastest-levenshtein` for typosquatting detection.

**Pragmatic deviation from spec:** The spec calls for tree-sitter AST parsing in Stage 1. This plan uses regex-based pattern matching instead, with the scanner architecture designed so rules can be upgraded to AST-based analysis later. Rationale: tree-sitter WASM/native setup is complex infrastructure work that blocks all OWASP rules; regex patterns catch the most common TS/JS vulnerability idioms and ship faster. Tree-sitter will be added in Stage 2 when it's also needed for dead code detection and behavioral drift analysis.

---

## File Map

### `packages/scanner-security/` (new and modified files)

| File | Responsibility |
|---|---|
| `src/entropy.ts` | Shannon entropy calculator for high-entropy string detection |
| `src/secrets-scanner.ts` | **Modified:** add entropy fallback to existing scanner |
| `src/owasp-scanner.ts` | OWASP scanner: loads rules, runs them against diff lines |
| `src/owasp-rules/types.ts` | `OwaspRule` interface |
| `src/owasp-rules/sql-injection.ts` | CWE-89: SQL string interpolation in query calls |
| `src/owasp-rules/xss.ts` | CWE-79: dangerouslySetInnerHTML, innerHTML, v-html |
| `src/owasp-rules/path-traversal.ts` | CWE-22: user input in file system paths |
| `src/owasp-rules/ssrf.ts` | CWE-918: user input as URL in HTTP clients |
| `src/owasp-rules/insecure-deserialization.ts` | CWE-502: unsafe deserialization patterns |
| `src/owasp-rules/index.ts` | Rule registry (exports all rules) |
| `src/supply-chain-scanner.ts` | Supply chain scanner: orchestrates lockfile, OSV, typosquatting |
| `src/lockfile-parser.ts` | Parse package-lock.json and yarn.lock diffs for added deps |
| `src/osv-client.ts` | Query OSV.dev API for known CVEs |
| `src/typosquatting.ts` | Levenshtein distance check against popular npm packages |
| `src/index.ts` | **Modified:** export new scanners |
| `tests/entropy.test.ts` | Entropy calculator tests |
| `tests/owasp-scanner.test.ts` | OWASP scanner integration tests |
| `tests/owasp-rules/*.test.ts` | Per-rule unit tests |
| `tests/supply-chain-scanner.test.ts` | Supply chain scanner tests |
| `tests/lockfile-parser.test.ts` | Lockfile parser tests |
| `tests/typosquatting.test.ts` | Typosquatting detector tests |
| `tests/fixtures/` | Sample vulnerable code snippets, lockfiles |

### `packages/core/` (new files)

| File | Responsibility |
|---|---|
| `src/sarif.ts` | Convert `Finding[]` to SARIF JSON format |
| `tests/sarif.test.ts` | SARIF converter tests |

### `packages/cli/` (modified)

| File | Responsibility |
|---|---|
| `src/main.ts` | **Modified:** register new scanners, add `init` command, add `--sarif` flag |

### `packages/github-action/` (modified)

| File | Responsibility |
|---|---|
| `src/main.ts` | **Modified:** register new scanners, upload SARIF artifact |

---

## Task 1: Entropy Calculator

**Files:**
- Create: `packages/scanner-security/src/entropy.ts`
- Create: `packages/scanner-security/tests/entropy.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/scanner-security/tests/entropy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { shannonEntropy, isHighEntropySecret } from "../src/entropy.js";

describe("shannonEntropy", () => {
  it("returns 0 for empty string", () => {
    expect(shannonEntropy("")).toBe(0);
  });

  it("returns 0 for single-char repeated string", () => {
    expect(shannonEntropy("aaaaaaa")).toBe(0);
  });

  it("returns high entropy for random-looking strings", () => {
    // Base64-ish random string
    expect(shannonEntropy("aB3kM9xZpQ2wF7jL5nR8")).toBeGreaterThan(4.0);
  });

  it("returns low entropy for natural English", () => {
    expect(shannonEntropy("hello world")).toBeLessThan(3.5);
  });
});

describe("isHighEntropySecret", () => {
  it("detects high-entropy string in assignment context", () => {
    const line = 'const token = "aB3kM9xZpQ2wF7jL5nR8vY4cE6hT1uI";';
    expect(isHighEntropySecret(line)).not.toBeNull();
    expect(isHighEntropySecret(line)!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("ignores strings shorter than 20 chars", () => {
    const line = 'const x = "short";';
    expect(isHighEntropySecret(line)).toBeNull();
  });

  it("ignores strings in comments", () => {
    const line = '// const token = "aB3kM9xZpQ2wF7jL5nR8vY4cE6hT1uI";';
    expect(isHighEntropySecret(line)).toBeNull();
  });

  it("ignores import paths", () => {
    const line = 'import { foo } from "@scope/very-long-package-name-here";';
    expect(isHighEntropySecret(line)).toBeNull();
  });

  it("ignores URLs without credentials", () => {
    const line = 'const url = "https://api.example.com/v1/long/path/here";';
    expect(isHighEntropySecret(line)).toBeNull();
  });

  it("detects high-entropy in object property", () => {
    const line = '  apiKey: "xK9mB2pL7wQ4vR8nF3jZ5cH1tY6uE0aG",';
    expect(isHighEntropySecret(line)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter @pocolente/scanner-security test`

- [ ] **Step 3: Implement entropy calculator**

Create `packages/scanner-security/src/entropy.ts`:

```ts
export function shannonEntropy(str: string): number {
  if (str.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

interface EntropyMatch {
  matched: string;
  confidence: number;
  entropy: number;
}

// Matches quoted strings in assignment context (=, :, or after key name)
const ASSIGNMENT_STRING_REGEX = /(?:=|:)\s*["']([^"']{20,})["']/;
const COMMENT_PREFIX = /^\s*(?:\/\/|\/\*|\*|#)/;
const IMPORT_PATTERN = /^\s*import\s/;
const URL_WITHOUT_CREDS = /^https?:\/\/[^:@]*$/;

const ENTROPY_THRESHOLD = 4.5;
const MIN_LENGTH = 20;

export function isHighEntropySecret(line: string): EntropyMatch | null {
  // Skip comments
  if (COMMENT_PREFIX.test(line)) return null;

  // Skip import lines
  if (IMPORT_PATTERN.test(line)) return null;

  const match = ASSIGNMENT_STRING_REGEX.exec(line);
  if (!match) return null;

  const value = match[1];
  if (value.length < MIN_LENGTH) return null;

  // Skip plain URLs without credentials
  if (URL_WITHOUT_CREDS.test(value)) return null;

  const entropy = shannonEntropy(value);
  if (entropy < ENTROPY_THRESHOLD) return null;

  // Confidence scales with entropy: 4.5 -> 0.80, 5.0+ -> 0.85
  const confidence = entropy >= 5.0 ? 0.85 : 0.80;

  return { matched: value, confidence, entropy };
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/scanner-security/src/entropy.ts packages/scanner-security/tests/entropy.test.ts
git commit -m "feat(security): add Shannon entropy calculator for secret detection"
```

---

## Task 2: Integrate Entropy Fallback into Secrets Scanner

**Files:**
- Modify: `packages/scanner-security/src/secrets-scanner.ts`
- Modify: `packages/scanner-security/tests/secrets-scanner.test.ts`

- [ ] **Step 1: Add entropy test cases to existing test file**

Add to `packages/scanner-security/tests/secrets-scanner.test.ts`:

```ts
// Add these test cases to the existing describe("SecretsScanner")

it("detects high-entropy strings via entropy fallback", async () => {
  const ctx = makeContext([
    makeDiff("src/config.ts", [
      'const apiToken = "xK9mB2pL7wQ4vR8nF3jZ5cH1tY6uE0aGdS";',
    ]),
  ]);
  const findings = await scanner.scan(ctx);
  expect(findings).toHaveLength(1);
  expect(findings[0].title).toContain("High-entropy");
  expect(findings[0].confidence).toBeGreaterThanOrEqual(0.8);
  expect(findings[0].confidence).toBeLessThanOrEqual(0.85);
});

it("does not flag low-entropy strings", async () => {
  const ctx = makeContext([
    makeDiff("src/config.ts", [
      'const message = "This is a normal long string with low entropy value";',
    ]),
  ]);
  const findings = await scanner.scan(ctx);
  expect(findings).toHaveLength(0);
});

it("prefers pattern match over entropy match on same line", async () => {
  // AWS key is detected by pattern, not entropy
  const ctx = makeContext([
    makeDiff("src/config.ts", [
      'const key = "AKIAIOSFODNN7EXAMPLE";',
    ]),
  ]);
  const findings = await scanner.scan(ctx);
  expect(findings).toHaveLength(1);
  expect(findings[0].title).toContain("AWS"); // Pattern match, not entropy
});
```

- [ ] **Step 2: Run tests — expect FAIL** (entropy tests fail since scanner doesn't use entropy yet)

- [ ] **Step 3: Modify SecretsScanner to add entropy fallback**

In `packages/scanner-security/src/secrets-scanner.ts`:
- Import `isHighEntropySecret` from `./entropy.js`
- After checking pattern matches and finding none (or all allowlisted), check entropy
- If `isHighEntropySecret(line)` returns a match, create a Finding with:
  - title: "High-entropy string detected (potential secret)"
  - confidence from the entropy match (0.80-0.85)
  - cwe: "CWE-798"
  - Pattern matches still take priority over entropy matches on the same line

- [ ] **Step 4: Run ALL scanner-security tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/scanner-security/
git commit -m "feat(security): add entropy fallback to SecretsScanner"
```

---

## Task 3: OWASP Rule Interface and Scanner Framework

**Files:**
- Create: `packages/scanner-security/src/owasp-rules/types.ts`
- Create: `packages/scanner-security/src/owasp-scanner.ts`
- Create: `packages/scanner-security/tests/owasp-scanner.test.ts`

- [ ] **Step 1: Create rule interface**

Create `packages/scanner-security/src/owasp-rules/types.ts`:

```ts
import type { DiffFile } from "@pocolente/core";

export interface RuleMatch {
  line: number;
  matchedText: string;
  confidence: number;
  suggestion: string;
}

export interface OwaspRule {
  id: string;
  name: string;
  cwe: string;
  owaspCategory: string;
  description: string;
  /** Test a single added line for vulnerability patterns. lineNumber is 1-indexed within the added lines. */
  testLine(line: string, lineNumber: number, file: DiffFile): RuleMatch | null;
}
```

- [ ] **Step 2: Write failing test for OWASP scanner**

Create `packages/scanner-security/tests/owasp-scanner.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { OwaspScanner } from "../src/owasp-scanner.js";
import { parseConfig } from "@pocolente/core";
import type { ScanContext, DiffFile } from "@pocolente/core";
import type { OwaspRule, RuleMatch } from "../src/owasp-rules/types.js";

function makeContext(diffs: DiffFile[]): ScanContext {
  return {
    diff: diffs,
    config: parseConfig(undefined),
    repoRoot: "/tmp/test",
    baseBranch: "main",
    prBranch: "feature",
  };
}

function makeDiff(path: string, added: string[]): DiffFile {
  return { path, added, removed: [], patch: added.map((l) => `+${l}`).join("\n") };
}

// A mock rule for testing the scanner framework
const mockRule: OwaspRule = {
  id: "test-rule",
  name: "Test Rule",
  cwe: "CWE-000",
  owaspCategory: "A00:2021-Test",
  description: "A test rule",
  testLine(line: string): RuleMatch | null {
    if (line.includes("VULNERABLE")) {
      return {
        line: 0,
        matchedText: "VULNERABLE",
        confidence: 0.95,
        suggestion: "Fix the vulnerability",
      };
    }
    return null;
  },
};

describe("OwaspScanner", () => {
  it("has correct metadata", () => {
    const scanner = new OwaspScanner([mockRule]);
    expect(scanner.id).toBe("owasp-scanner");
    expect(scanner.layer).toBe("security");
  });

  it("detects vulnerabilities using rules", async () => {
    const scanner = new OwaspScanner([mockRule]);
    const ctx = makeContext([
      makeDiff("src/app.ts", ['const x = "VULNERABLE";']),
    ]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].cwe).toBe("CWE-000");
    expect(findings[0].owasp).toBe("A00:2021-Test");
    expect(findings[0].file).toBe("src/app.ts");
  });

  it("returns empty for clean code", async () => {
    const scanner = new OwaspScanner([mockRule]);
    const ctx = makeContext([makeDiff("src/app.ts", ["const x = 42;"])]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("only scans files matching TS/JS extensions", async () => {
    const scanner = new OwaspScanner([mockRule]);
    const ctx = makeContext([
      makeDiff("readme.md", ['VULNERABLE']),
      makeDiff("src/app.ts", ['VULNERABLE']),
    ]);
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe("src/app.ts");
  });

  it("respects owasp.enabled config", async () => {
    const config = parseConfig({ security: { owasp: { enabled: false } } });
    const scanner = new OwaspScanner([mockRule]);
    const ctx: ScanContext = {
      diff: [makeDiff("src/app.ts", ['VULNERABLE'])],
      config,
      repoRoot: "/tmp",
      baseBranch: "main",
      prBranch: "feature",
    };
    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

- [ ] **Step 4: Implement OWASP scanner**

Create `packages/scanner-security/src/owasp-scanner.ts`:

```ts
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
```

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/scanner-security/
git commit -m "feat(security): add OWASP scanner framework with rule plugin interface"
```

---

## Task 4: OWASP Rule — SQL Injection (CWE-89)

**Files:**
- Create: `packages/scanner-security/src/owasp-rules/sql-injection.ts`
- Create: `packages/scanner-security/tests/owasp-rules/sql-injection.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/scanner-security/tests/owasp-rules/sql-injection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sqlInjectionRule } from "../../src/owasp-rules/sql-injection.js";
import type { DiffFile } from "@pocolente/core";

const dummyFile: DiffFile = { path: "test.ts", added: [], removed: [], patch: "" };

describe("sqlInjectionRule", () => {
  it("detects template literal in .query() call", () => {
    const line = 'const result = await db.query(`SELECT * FROM users WHERE id = ${userId}`);';
    const match = sqlInjectionRule.testLine(line, 1, dummyFile);
    expect(match).not.toBeNull();
    expect(match!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects template literal in .execute() call", () => {
    const line = 'await connection.execute(`DELETE FROM sessions WHERE token = ${token}`);';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("detects string concat in query call", () => {
    const line = 'db.query("SELECT * FROM users WHERE name = \'" + name + "\'");';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("detects Prisma.$queryRaw with template literal", () => {
    const line = 'await prisma.$queryRaw(`SELECT * FROM "User" WHERE id = ${id}`);';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("detects Knex.raw with template literal", () => {
    const line = 'knex.raw(`SELECT * FROM users WHERE email = ${email}`);';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).not.toBeNull();
  });

  it("does NOT flag parameterized queries", () => {
    const line = 'db.query("SELECT * FROM users WHERE id = $1", [userId]);';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("does NOT flag tagged template literals (sql``)", () => {
    const line = 'const result = await sql`SELECT * FROM users WHERE id = ${userId}`;';
    expect(sqlInjectionRule.testLine(line, 1, dummyFile)).toBeNull();
  });

  it("has correct CWE and OWASP mapping", () => {
    expect(sqlInjectionRule.cwe).toBe("CWE-89");
    expect(sqlInjectionRule.owaspCategory).toBe("A03:2021-Injection");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement SQL injection rule**

Create `packages/scanner-security/src/owasp-rules/sql-injection.ts`:

The rule detects:
1. Template literals with `${...}` expressions inside `.query()`, `.execute()`, `.raw()`, `.$queryRaw()`, `.$executeRaw()` calls
2. String concatenation (`+`) inside these same calls
3. Does NOT flag: parameterized queries (`.query("...$1", [param])`), tagged template literals (`sql\`...\``, `Prisma.sql\`...\``)

Pattern approach:
- Check if line contains a known query method call (`.query(`, `.execute(`, `.raw(`, `.$queryRaw(`, `.$executeRaw(`)
- If yes, check if the argument contains a template literal with `${` or string concatenation with `+`
- Exclude tagged templates: if a word character or `sql` appears immediately before the backtick, it's tagged

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/scanner-security/src/owasp-rules/ packages/scanner-security/tests/owasp-rules/
git commit -m "feat(security): add SQL injection detection rule (CWE-89)"
```

---

## Task 5: OWASP Rule — XSS (CWE-79)

**Files:**
- Create: `packages/scanner-security/src/owasp-rules/xss.ts`
- Create: `packages/scanner-security/tests/owasp-rules/xss.test.ts`

- [ ] **Step 1: Write failing test**

Test `xssRule.testLine(line)` detects:
1. `dangerouslySetInnerHTML={{ __html: variable }}` — not a string literal
2. `.innerHTML = variable` (not `.innerHTML = "static string"`)
3. `v-html="variable"` in Vue templates
4. Does NOT flag: `dangerouslySetInnerHTML={{ __html: "static" }}`, `.innerHTML = ""`, `.textContent = variable`

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement XSS rule**

Patterns:
- `dangerouslySetInnerHTML=\{\{\s*__html:\s*(?!["'`])` — detect non-literal value
- `\.innerHTML\s*=\s*(?!["'`]\s*[;"'])` — detect non-literal assignment
- `v-html=` — any usage (Vue templates should use v-text or interpolation)

CWE: CWE-79, OWASP: A03:2021-Injection

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/scanner-security/src/owasp-rules/xss.ts packages/scanner-security/tests/owasp-rules/xss.test.ts
git commit -m "feat(security): add XSS detection rule (CWE-79)"
```

---

## Task 6: OWASP Rules — Path Traversal, SSRF, Insecure Deserialization

**Files:**
- Create: `packages/scanner-security/src/owasp-rules/path-traversal.ts`
- Create: `packages/scanner-security/src/owasp-rules/ssrf.ts`
- Create: `packages/scanner-security/src/owasp-rules/insecure-deserialization.ts`
- Create: `packages/scanner-security/tests/owasp-rules/path-traversal.test.ts`
- Create: `packages/scanner-security/tests/owasp-rules/ssrf.test.ts`
- Create: `packages/scanner-security/tests/owasp-rules/insecure-deserialization.test.ts`

### Path Traversal (CWE-22)

- [ ] **Step 1: Write failing test**

Test detects:
1. `fs.readFile(req.params.path)` or `fs.readFileSync(userInput)`
2. `path.join(baseDir, req.query.file)` — user input in path construction
3. Does NOT flag: `fs.readFile("./config.json")` — string literal path
4. Does NOT flag: `path.join(__dirname, "static")` — no user-controlled input

- [ ] **Step 2: Implement rule**

Detect `fs.readFile`, `fs.readFileSync`, `fs.createReadStream`, `path.join`, `path.resolve` with arguments containing `req.params`, `req.query`, `req.body`, or function parameter names.

CWE: CWE-22, OWASP: A01:2021-Broken-Access-Control

- [ ] **Step 3: Run tests — expect PASS**

### SSRF (CWE-918)

- [ ] **Step 4: Write failing test**

Test detects:
1. `fetch(userUrl)` — variable as URL argument
2. `axios.get(req.body.url)` — user input as URL
3. `http.get(url)` where url came from user
4. Does NOT flag: `fetch("https://api.example.com")` — literal URL
5. Does NOT flag: `fetch("https://api.example.com" + "/users")` — literal string concatenation

- [ ] **Step 5: Implement rule**

Detect `fetch(`, `axios(`, `axios.get(`, `axios.post(`, `http.get(`, `http.request(`, `got(`, `request(` where the first argument is not a string literal.

CWE: CWE-918, OWASP: A10:2021-SSRF

- [ ] **Step 6: Run tests — expect PASS**

### Insecure Deserialization (CWE-502)

- [ ] **Step 7: Write failing test**

Test detects:
1. `yaml.load(input)` without Loader parameter (Python-style but seen in JS yaml libs too)
2. `JSON.parse(untrustedInput)` followed by property access used in control flow (stretch — may skip)
3. `serialize` / `unserialize` patterns from `node-serialize`
4. Does NOT flag: `JSON.parse(fs.readFileSync("config.json"))` — trusted source

For Stage 1, keep this rule simple: flag `yaml.load(` without `{ schema: }` or `Loader` parameter, and flag imports of known-dangerous deserialization packages.

- [ ] **Step 8: Implement rule**

CWE: CWE-502, OWASP: A08:2021-Software-and-Data-Integrity-Failures

- [ ] **Step 9: Run ALL tests — expect PASS**

- [ ] **Step 10: Commit**

```bash
git add packages/scanner-security/src/owasp-rules/ packages/scanner-security/tests/owasp-rules/
git commit -m "feat(security): add path traversal, SSRF, and insecure deserialization rules"
```

---

## Task 7: OWASP Rule Registry + Wire into Scanner

**Files:**
- Create: `packages/scanner-security/src/owasp-rules/index.ts`
- Modify: `packages/scanner-security/src/index.ts`

- [ ] **Step 1: Create rule registry**

Create `packages/scanner-security/src/owasp-rules/index.ts`:

```ts
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
```

- [ ] **Step 2: Update `packages/scanner-security/src/index.ts`**

Add exports:
```ts
export { OwaspScanner } from "./owasp-scanner.js";
export { ALL_OWASP_RULES } from "./owasp-rules/index.js";
export type { OwaspRule } from "./owasp-rules/index.js";
```

- [ ] **Step 3: Verify all tests pass**

Run: `pnpm --filter @pocolente/scanner-security test`

- [ ] **Step 4: Commit**

```bash
git add packages/scanner-security/
git commit -m "feat(security): create OWASP rule registry and export scanner"
```

---

## Task 8: Supply Chain Scanner — Lockfile Parser

**Files:**
- Create: `packages/scanner-security/src/lockfile-parser.ts`
- Create: `packages/scanner-security/tests/lockfile-parser.test.ts`
- Create: `packages/scanner-security/tests/fixtures/package-lock-diff.txt`
- Create: `packages/scanner-security/tests/fixtures/yarn-lock-diff.txt`

- [ ] **Step 1: Create test fixtures**

`package-lock-diff.txt`: a realistic diff showing added dependencies in package-lock.json format.
`yarn-lock-diff.txt`: a realistic diff showing added dependencies in yarn.lock format.

- [ ] **Step 2: Write failing test**

Create `packages/scanner-security/tests/lockfile-parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAddedDependencies } from "../src/lockfile-parser.js";
import type { DiffFile } from "@pocolente/core";

describe("parseAddedDependencies", () => {
  it("extracts added packages from package-lock.json diff", () => {
    const diff: DiffFile = {
      path: "package-lock.json",
      added: [
        '    "lodash": {',
        '      "version": "4.17.21",',
        '      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",',
        '    "evil-package": {',
        '      "version": "1.0.0",',
      ],
      removed: [],
      patch: "",
    };
    const deps = parseAddedDependencies(diff);
    expect(deps).toHaveLength(2);
    expect(deps[0]).toEqual({ name: "lodash", version: "4.17.21" });
    expect(deps[1]).toEqual({ name: "evil-package", version: "1.0.0" });
  });

  it("extracts added packages from yarn.lock diff", () => {
    const diff: DiffFile = {
      path: "yarn.lock",
      added: [
        'axios@^1.6.0:',
        '  version "1.6.5"',
        '  resolved "https://registry.yarnpkg.com/axios/-/axios-1.6.5.tgz"',
      ],
      removed: [],
      patch: "",
    };
    const deps = parseAddedDependencies(diff);
    expect(deps).toHaveLength(1);
    expect(deps[0].name).toBe("axios");
    expect(deps[0].version).toBe("1.6.5");
  });

  it("returns empty for non-lockfile diffs", () => {
    const diff: DiffFile = { path: "src/app.ts", added: ["const x = 1;"], removed: [], patch: "" };
    expect(parseAddedDependencies(diff)).toHaveLength(0);
  });

  it("ignores removed packages", () => {
    const diff: DiffFile = {
      path: "package-lock.json",
      added: [],
      removed: ['    "old-package": {', '      "version": "0.1.0",'],
      patch: "",
    };
    expect(parseAddedDependencies(diff)).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

- [ ] **Step 4: Implement lockfile parser**

Create `packages/scanner-security/src/lockfile-parser.ts`:

Export `parseAddedDependencies(diff: DiffFile): AddedDependency[]` where `AddedDependency = { name: string; version: string }`.

Logic:
- If path is `package-lock.json`: scan added lines for `"package-name": {` pattern followed by `"version": "x.y.z"` on subsequent lines
- If path is `yarn.lock`: scan for `package@version:` header lines followed by `version "x.y.z"` lines
- Return array of `{ name, version }` tuples

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/scanner-security/
git commit -m "feat(security): add lockfile parser for package-lock.json and yarn.lock"
```

---

## Task 9: Supply Chain Scanner — OSV Client + Typosquatting

**Files:**
- Create: `packages/scanner-security/src/osv-client.ts`
- Create: `packages/scanner-security/src/typosquatting.ts`
- Create: `packages/scanner-security/tests/typosquatting.test.ts`

- [ ] **Step 1: Implement OSV client**

Create `packages/scanner-security/src/osv-client.ts`:

```ts
export interface OsvVulnerability {
  id: string;
  summary: string;
  severity: string;
  aliases: string[];
}

export interface OsvQueryResult {
  vulns: OsvVulnerability[];
}

/**
 * Query OSV.dev API for known vulnerabilities affecting a specific package version.
 * Returns empty array on API failure (graceful degradation).
 */
export async function queryOsv(
  packageName: string,
  version: string,
  ecosystem: string = "npm",
): Promise<OsvVulnerability[]> {
  try {
    const response = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        package: { name: packageName, ecosystem },
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as OsvQueryResult;
    return data.vulns ?? [];
  } catch {
    // Graceful degradation: API failure should not block the scan
    return [];
  }
}
```

No unit tests for OSV client (it's an HTTP client — tested via integration). Graceful degradation on failure is the key behavior.

- [ ] **Step 2: Write failing test for typosquatting**

Create `packages/scanner-security/tests/typosquatting.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkTyposquatting } from "../src/typosquatting.js";

describe("checkTyposquatting", () => {
  it("flags a name with Levenshtein distance 1 from a popular package", () => {
    // "lodas" is distance 1 from "lodash"
    const result = checkTyposquatting("lodas");
    expect(result).not.toBeNull();
    expect(result!.similarTo).toBe("lodash");
    expect(result!.distance).toBe(1);
  });

  it("flags a name with Levenshtein distance 2", () => {
    // "exprss" is distance 2 from "express"
    const result = checkTyposquatting("exprss");
    expect(result).not.toBeNull();
    expect(result!.similarTo).toBe("express");
  });

  it("does NOT flag exact matches (legitimate package)", () => {
    const result = checkTyposquatting("lodash");
    expect(result).toBeNull();
  });

  it("does NOT flag names with distance > 2", () => {
    const result = checkTyposquatting("completely-different-name");
    expect(result).toBeNull();
  });

  it("does NOT flag scoped packages (less likely typosquatting)", () => {
    const result = checkTyposquatting("@types/lodas");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

- [ ] **Step 4: Install fastest-levenshtein and implement typosquatting checker**

Run: `pnpm --filter @pocolente/scanner-security add fastest-levenshtein`

Create `packages/scanner-security/src/typosquatting.ts`:

```ts
import { distance } from "fastest-levenshtein";

export interface TyposquattingMatch {
  similarTo: string;
  distance: number;
}

// Top 200 most popular npm packages (curated subset — expand over time)
const POPULAR_PACKAGES = [
  "lodash", "express", "react", "react-dom", "axios",
  "typescript", "webpack", "next", "vue", "angular",
  "moment", "dayjs", "chalk", "commander", "inquirer",
  "jest", "mocha", "vitest", "eslint", "prettier",
  "dotenv", "cors", "uuid", "debug", "semver",
  "glob", "minimatch", "yargs", "fs-extra", "rimraf",
  "body-parser", "cookie-parser", "jsonwebtoken", "bcrypt", "bcryptjs",
  "mongoose", "sequelize", "prisma", "knex", "pg",
  "mysql2", "redis", "ioredis", "mongodb", "sqlite3",
  "nodemon", "concurrently", "cross-env", "tsup", "esbuild",
  "rollup", "vite", "parcel", "turbo", "nx",
  "tailwindcss", "postcss", "sass", "less", "styled-components",
  "zod", "joi", "yup", "ajv", "class-validator",
  "rxjs", "immer", "zustand", "redux", "mobx",
  "socket.io", "ws", "graphql", "apollo-server", "fastify",
  "koa", "hapi", "restify", "micro", "polka",
  "sharp", "jimp", "multer", "formidable", "busboy",
  "nodemailer", "twilio", "aws-sdk", "firebase", "stripe",
  // ... extend to ~200 over time
];

const MAX_DISTANCE = 2;

export function checkTyposquatting(packageName: string): TyposquattingMatch | null {
  // Skip scoped packages
  if (packageName.startsWith("@")) return null;

  for (const popular of POPULAR_PACKAGES) {
    // Skip exact matches
    if (packageName === popular) return null;

    const d = distance(packageName, popular);
    if (d > 0 && d <= MAX_DISTANCE) {
      return { similarTo: popular, distance: d };
    }
  }

  return null;
}
```

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/scanner-security/
git commit -m "feat(security): add OSV client and typosquatting detection"
```

---

## Task 10: Supply Chain Scanner Implementation

**Files:**
- Create: `packages/scanner-security/src/supply-chain-scanner.ts`
- Create: `packages/scanner-security/tests/supply-chain-scanner.test.ts`
- Modify: `packages/scanner-security/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/scanner-security/tests/supply-chain-scanner.test.ts`:

Test `SupplyChainScanner`:
1. Has correct id ("supply-chain-scanner") and layer ("security")
2. Detects typosquatting package in lockfile diff (e.g., "lodas" similar to "lodash") — produces a warning finding
3. Returns empty for lockfile with only legitimate packages
4. Only processes lockfile diffs (package-lock.json, yarn.lock), ignores other files
5. Respects `supplyChain.enabled` config

Note: OSV API tests are skipped (network dependency). The scanner should handle OSV failures gracefully (empty results = no CVE findings, not a crash).

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement Supply Chain Scanner**

Create `packages/scanner-security/src/supply-chain-scanner.ts`:

Implements `Scanner` interface:
- Iterates diff files, filters for lockfiles
- Calls `parseAddedDependencies()` to extract new deps
- For each new dep:
  - Check typosquatting via `checkTyposquatting()` — if match found AND package is new (not an update), flag with warn severity
  - Query OSV API via `queryOsv()` — if vulns found, flag with severity based on vuln severity (critical CVE = block)
- Produces findings with appropriate CWE codes and fix suggestions

- [ ] **Step 4: Update index.ts exports**

Add: `export { SupplyChainScanner } from "./supply-chain-scanner.js";`

- [ ] **Step 5: Run ALL scanner-security tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/scanner-security/
git commit -m "feat(security): implement Supply Chain Scanner with OSV + typosquatting"
```

---

## Task 11: SARIF Output Format

**Files:**
- Create: `packages/core/src/sarif.ts`
- Create: `packages/core/tests/sarif.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/sarif.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toSarif } from "../src/sarif.js";
import type { Finding } from "../src/types.js";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    layer: "security", scanner: "secrets-scanner", severity: "block",
    confidence: 0.97, file: "src/config.ts", line: "12",
    title: "AWS key detected", explanation: "Found AKIA key",
    suggestion: "Use environment variables", cwe: "CWE-798",
    owasp: "A07:2021", estimatedEnergyImpact: null, rcsDelta: null,
    ...overrides,
  };
}

describe("toSarif", () => {
  it("produces valid SARIF structure", () => {
    const sarif = toSarif([makeFinding()], "pocolente-qa", "0.0.1");
    expect(sarif.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
  });

  it("maps findings to SARIF results", () => {
    const sarif = toSarif([makeFinding()], "pocolente-qa", "0.0.1");
    const results = sarif.runs[0].results;
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("secrets-scanner/CWE-798");
    expect(results[0].message.text).toBe("AWS key detected");
    expect(results[0].locations[0].physicalLocation.artifactLocation.uri).toBe("src/config.ts");
  });

  it("maps severity to SARIF level", () => {
    const blockFinding = makeFinding({ severity: "block" });
    const warnFinding = makeFinding({ severity: "warn" });
    const infoFinding = makeFinding({ severity: "info" });

    const sarif = toSarif([blockFinding, warnFinding, infoFinding], "test", "0.0.1");
    const results = sarif.runs[0].results;
    expect(results[0].level).toBe("error");
    expect(results[1].level).toBe("warning");
    expect(results[2].level).toBe("note");
  });

  it("includes tool information", () => {
    const sarif = toSarif([], "pocolente-qa", "1.2.3");
    const tool = sarif.runs[0].tool.driver;
    expect(tool.name).toBe("pocolente-qa");
    expect(tool.version).toBe("1.2.3");
  });

  it("handles findings without CWE", () => {
    const sarif = toSarif([makeFinding({ cwe: null })], "test", "0.0.1");
    expect(sarif.runs[0].results[0].ruleId).toBe("secrets-scanner");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement SARIF converter**

Create `packages/core/src/sarif.ts`:

Export `toSarif(findings: Finding[], toolName: string, toolVersion: string): SarifLog`

SARIF 2.1.0 structure:
- `$schema`, `version: "2.1.0"`, `runs: [{ tool, results }]`
- `tool.driver`: name, version, informationUri
- Each finding maps to a result with: ruleId, level (block→error, warn→warning, info→note), message, locations, properties

- [ ] **Step 4: Export from index.ts**

Add: `export { toSarif } from "./sarif.js";`

- [ ] **Step 5: Run ALL core tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add SARIF 2.1.0 output format converter"
```

---

## Task 12: pocolente init CLI Command

**Files:**
- Create: `packages/cli/src/init.ts`
- Create: `packages/cli/tests/init.test.ts`
- Modify: `packages/cli/src/main.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/init.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initConfig } from "../src/init.js";

describe("initConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pocolente-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates .pocolente.yml in the target directory", async () => {
    const result = await initConfig(tempDir);
    expect(result.created).toBe(true);
    const content = await readFile(join(tempDir, ".pocolente.yml"), "utf-8");
    expect(content).toContain("version: 1");
    expect(content).toContain("severity_threshold:");
  });

  it("returns created: false if file already exists", async () => {
    await initConfig(tempDir); // first call creates it
    const result = await initConfig(tempDir); // second call
    expect(result.created).toBe(false);
    expect(result.message).toContain("already exists");
  });

  it("generated config is valid YAML that parses without error", async () => {
    await initConfig(tempDir);
    const { loadConfig } = await import("@pocolente/core");
    const config = await loadConfig(join(tempDir, ".pocolente.yml"));
    expect(config.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement init module**

Create `packages/cli/src/init.ts`:

Extract the init logic into a testable function `initConfig(targetDir: string): Promise<{ created: boolean; message: string }>`.

The default config template is a well-commented YAML:
```yaml
# Pocolente QA Configuration
# Docs: https://github.com/pocolente/pocolente
version: 1

severity_threshold: warn
block_pr_on: block

scan_paths:
  include: ["src/**", "lib/**"]
  exclude: ["**/*.test.*", "**/*.spec.*"]

security:
  secrets:
    severity: block
  owasp:
    severity: block
  supply_chain:
    severity: warn

greenops:
  enabled: true
```

- [ ] **Step 4: Wire init into CLI main.ts**

In `packages/cli/src/main.ts`:
- Detect `init` as the first positional argument
- Call `initConfig(process.cwd())` and print the result message

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): add pocolente init command"
```

---

## Task 13: Wire All Scanners into Action + CLI

**Files:**
- Modify: `packages/github-action/src/main.ts`
- Modify: `packages/cli/src/main.ts`

- [ ] **Step 1: Update GitHub Action to register all scanners**

In `packages/github-action/src/main.ts`:
- Import `OwaspScanner`, `ALL_OWASP_RULES`, `SupplyChainScanner` from `@pocolente/scanner-security`
- Add to scanners array:
  ```ts
  const scanners = [
    new SecretsScanner(),
    new OwaspScanner(ALL_OWASP_RULES),
    new SupplyChainScanner(),
  ];
  ```
- After generating the comment, if `config.reporting.sarifOutput` is true:
  - Import `toSarif` from `@pocolente/core`
  - Generate SARIF: `const sarif = toSarif(allFindings, "pocolente-qa", "0.0.1");`
  - Write to file: `fs.writeFileSync("pocolente-results.sarif", JSON.stringify(sarif, null, 2));`
  - Log: `core.info("SARIF report written to pocolente-results.sarif");`
  - Note: Users can upload this file to GitHub Security tab via `github/codeql-action/upload-sarif` in a subsequent workflow step. Pocolente does not upload SARIF itself — it produces the file, the workflow consumes it.

- [ ] **Step 2: Update CLI to register all scanners**

In `packages/cli/src/main.ts`:
- Import new scanners
- Add to scanners array (same as Action)
- Add `sarif: boolean` field to `CliArgs` interface (default `false`)
- In `parseArgs()`, recognize `--sarif` flag: `if (args[i] === "--sarif") { result.sarif = true; i += 1; }`
- In output section: if `args.sarif`, output `JSON.stringify(toSarif(allFindings, "pocolente-qa", "0.0.1"), null, 2)` to stdout instead of the normal format. `--sarif` takes precedence over `--format`.

- [ ] **Step 3: Rebuild all packages**

Run: `pnpm -r build`

- [ ] **Step 4: Test CLI with a vulnerable file**

Create a temporary test file with a SQL injection pattern:
```bash
echo 'const result = await db.query(`SELECT * FROM users WHERE id = ${userId}`);' > /tmp/test-vuln.ts
```
Then run the CLI to see if it detects it.

- [ ] **Step 5: Commit**

```bash
git add packages/github-action/ packages/cli/
git commit -m "feat: wire OWASP and supply chain scanners into Action and CLI"
```

---

## Task 14: Full Build Verification

- [ ] **Step 1: Run ALL tests across all packages**

Run: `pnpm test`
Expected: all tests pass. Report exact count.

- [ ] **Step 2: Clean build**

Run: `pnpm -r build`
Expected: all packages build

- [ ] **Step 3: Test CLI with JSON output**

Run: `node packages/cli/dist/main.js scan --format json`
Expected: JSON with status and findings array

- [ ] **Step 4: Verify SARIF output**

Run: `node packages/cli/dist/main.js scan --sarif`
Expected: valid SARIF JSON

- [ ] **Step 5: Verify Action bundle**

Run: `ls -la packages/github-action/dist/index.js`
Expected: bundled file exists (larger than Stage 0 due to new scanners)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: Stage 1 complete — security layer with OWASP, supply chain, SARIF"
```

---

## Done Criteria

Stage 1 is complete when:
1. `pnpm test` passes with all tests green (Stage 0 + Stage 1)
2. Secrets Scanner detects high-entropy strings via entropy fallback
3. OWASP Scanner detects SQL injection, XSS, path traversal, SSRF, insecure deserialization in TS/JS files
4. Supply Chain Scanner detects typosquatting packages in lockfile diffs
5. Supply Chain Scanner queries OSV API for known CVEs (graceful degradation on failure)
6. SARIF output is valid and includes all findings
7. `pocolente init` generates a default config file
8. All scanners are wired into both the GitHub Action and CLI
