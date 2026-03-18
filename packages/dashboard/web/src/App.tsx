import { useState } from "react";
import RepoOverview from "./pages/RepoOverview.tsx";

export default function App() {
  const [repo, setRepo] = useState("owner/repo");

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 32, paddingBottom: 16,
        borderBottom: `1px solid var(--grey-200)`
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--primary-700)" }}>
          Pocolente QA
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 14, color: "var(--grey-600)" }}>Repository:</label>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            style={{
              padding: "6px 12px", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--grey-300)", fontSize: 14,
              width: 250,
            }}
          />
        </div>
      </header>
      <RepoOverview repo={repo} />
    </div>
  );
}
