import type { DiffFile } from "@pocolente/core";
import type { OwaspRule, RuleMatch } from "./types.js";

// Query method patterns that accept raw SQL
const QUERY_METHOD_RE = /\.(query|execute|raw|\$queryRaw|\$executeRaw)\s*\(/;

// Template literal interpolation: `...${...}...`
const TEMPLATE_INTERP_RE = /`[^`]*\$\{[^}]+\}[^`]*`/;

// String concatenation with quotes: "..." + var or var + "..."
const STRING_CONCAT_RE = /["'][^"']*["']\s*\+|\+\s*["'][^"']*["']/;

// Tagged template literal: word` (e.g. sql`, Prisma.sql`, gql`)
const TAGGED_TEMPLATE_RE = /\w`/;

// Parameterized query: has a query string AND an array argument [...]
const PARAMETERIZED_RE = /["'`][^"'`]*["'`]\s*,\s*\[/;

export const sqlInjectionRule: OwaspRule = {
  id: "sql-injection",
  name: "SQL Injection",
  cwe: "CWE-89",
  owaspCategory: "A03:2021-Injection",
  description:
    "Detected potential SQL injection: user-controlled data is interpolated directly into a SQL query. Use parameterized queries or prepared statements instead.",

  testLine(line: string, lineNumber: number, _file: DiffFile): RuleMatch | null {
    // Must have a query method call
    if (!QUERY_METHOD_RE.test(line)) return null;

    // Check for template literal with interpolation
    const hasTemplateInterp = TEMPLATE_INTERP_RE.test(line);
    // Check for string concatenation
    const hasStringConcat = STRING_CONCAT_RE.test(line);

    if (!hasTemplateInterp && !hasStringConcat) return null;

    // Exclude tagged template literals (safe DSLs like sql``, gql``)
    if (hasTemplateInterp && TAGGED_TEMPLATE_RE.test(line)) return null;

    // Exclude parameterized queries: query("...", [...])
    if (PARAMETERIZED_RE.test(line)) return null;

    const matched = QUERY_METHOD_RE.exec(line)!;

    return {
      line: lineNumber,
      matchedText: matched[0],
      confidence: 0.9,
      suggestion:
        "Use parameterized queries (e.g., db.query('SELECT ... WHERE id = \$1', [id])) or a query builder with bound parameters.",
    };
  },
};
