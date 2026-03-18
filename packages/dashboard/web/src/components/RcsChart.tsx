interface RcsDataPoint {
  date: string;
  rcsDelta: number;
  badge: string;
}

const BADGE_COLORS: Record<string, string> = {
  green: "var(--semantic-green-500)",
  yellow: "var(--semantic-yellow-500)",
  red: "var(--semantic-red-500)",
};

export default function RcsChart({ data }: { data: RcsDataPoint[] }) {
  if (data.length === 0) return null;

  const reversed = [...data].reverse(); // oldest first for chart
  const maxDelta = Math.max(...reversed.map(d => Math.abs(d.rcsDelta)), 1);
  const width = 600;
  const height = 200;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = reversed.map((d, i) => ({
    x: padding + (i / Math.max(reversed.length - 1, 1)) * chartWidth,
    y: padding + chartHeight / 2 - (d.rcsDelta / maxDelta) * (chartHeight / 2),
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      {/* Zero line */}
      <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2}
        stroke="var(--grey-200)" strokeDasharray="4" />
      {/* Line */}
      <path d={pathD} fill="none" stroke="var(--primary-500)" strokeWidth="2" />
      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4"
          fill={BADGE_COLORS[p.badge] ?? "var(--grey-400)"} />
      ))}
      {/* Labels */}
      <text x={padding} y={padding - 8} fontSize="11" fill="var(--grey-600)">+{maxDelta}</text>
      <text x={padding} y={height - padding + 16} fontSize="11" fill="var(--grey-600)">-{maxDelta}</text>
      <text x={width / 2} y={height - 4} fontSize="11" fill="var(--grey-600)" textAnchor="middle">
        RCS Delta over time
      </text>
    </svg>
  );
}
