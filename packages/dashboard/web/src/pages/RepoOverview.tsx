import { useEffect, useState } from "react";
import RcsChart from "../components/RcsChart.tsx";

interface ScanTrend {
  id: number;
  createdAt: string;
  status: string;
  findingCount: number;
  rcsDelta: number;
  rcsBadge: string;
  prNumber: number | null;
  branch: string | null;
}

interface RcsDataPoint {
  date: string;
  rcsDelta: number;
  badge: string;
}

export default function RepoOverview({ repo }: { repo: string }) {
  const [scans, setScans] = useState<ScanTrend[]>([]);
  const [rcsTrend, setRcsTrend] = useState<RcsDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const encoded = encodeURIComponent(repo);
    Promise.all([
      fetch(`/api/v1/repos/${encoded}/trends`).then(r => r.json()),
      fetch(`/api/v1/repos/${encoded}/rcs`).then(r => r.json()),
    ]).then(([trendsData, rcsData]) => {
      setScans(trendsData.scans ?? []);
      setRcsTrend(rcsData.trend ?? []);
    }).catch(() => {
      setScans([]);
      setRcsTrend([]);
    }).finally(() => setLoading(false));
  }, [repo]);

  const handleExport = () => {
    window.open(`/api/v1/repos/${encodeURIComponent(repo)}/export/csrd`, "_blank");
  };

  if (loading) return <p style={{ color: "var(--grey-500)" }}>Loading...</p>;

  const badgeStyle = (badge: string) => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "var(--radius-sm)",
    fontSize: 12,
    fontWeight: 600,
    ...(badge === "green" ? { background: "var(--semantic-green-100)", color: "var(--semantic-green-500)" } :
      badge === "yellow" ? { background: "var(--semantic-yellow-100)", color: "var(--semantic-yellow-500)" } :
      { background: "var(--semantic-red-100)", color: "var(--semantic-red-500)" }),
  });

  const statusStyle = (status: string) => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "var(--radius-sm)",
    fontSize: 12,
    fontWeight: 600,
    ...(status === "pass"
      ? { background: "var(--semantic-green-100)", color: "var(--semantic-green-500)" }
      : { background: "var(--semantic-red-100)", color: "var(--semantic-red-500)" }),
  });

  return (
    <div>
      {/* RCS Trend Chart */}
      {rcsTrend.length > 0 && (
        <section style={{
          background: "var(--neutral-0)", borderRadius: "var(--radius-md)",
          padding: 24, marginBottom: 24, boxShadow: "var(--shadow-sm)",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: "var(--grey-900)" }}>
            RCS Trend
          </h2>
          <RcsChart data={rcsTrend} />
        </section>
      )}

      {/* Scan History */}
      <section style={{
        background: "var(--neutral-0)", borderRadius: "var(--radius-md)",
        padding: 24, boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--grey-900)" }}>Scan History</h2>
          <button
            onClick={handleExport}
            style={{
              padding: "8px 16px", borderRadius: "var(--radius-sm)",
              background: "var(--primary-500)", color: "#fff",
              border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}
          >
            Export CSRD CSV
          </button>
        </div>

        {scans.length === 0 ? (
          <p style={{ color: "var(--grey-500)", fontSize: 14 }}>No scans yet. Run Pocolente QA on a PR to see results here.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--grey-200)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", color: "var(--grey-600)", fontWeight: 500 }}>Date</th>
                <th style={{ padding: "8px 12px", color: "var(--grey-600)", fontWeight: 500 }}>PR</th>
                <th style={{ padding: "8px 12px", color: "var(--grey-600)", fontWeight: 500 }}>Status</th>
                <th style={{ padding: "8px 12px", color: "var(--grey-600)", fontWeight: 500 }}>Findings</th>
                <th style={{ padding: "8px 12px", color: "var(--grey-600)", fontWeight: 500 }}>RCS</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} style={{ borderBottom: "1px solid var(--grey-150)" }}>
                  <td style={{ padding: "10px 12px" }}>{new Date(scan.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: "10px 12px" }}>{scan.prNumber ? `#${scan.prNumber}` : scan.branch ?? "—"}</td>
                  <td style={{ padding: "10px 12px" }}><span style={statusStyle(scan.status)}>{scan.status}</span></td>
                  <td style={{ padding: "10px 12px" }}>{scan.findingCount}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={badgeStyle(scan.rcsBadge)}>
                      {scan.rcsDelta > 0 ? "+" : ""}{scan.rcsDelta}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
