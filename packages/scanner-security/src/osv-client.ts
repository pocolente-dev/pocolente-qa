export interface OsvVulnerability {
  id: string;
  summary: string;
  severity: string;
  aliases: string[];
}

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
    const data = await response.json() as { vulns?: OsvVulnerability[] };
    return data.vulns ?? [];
  } catch {
    return []; // Graceful degradation
  }
}
