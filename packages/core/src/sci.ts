export interface SciInput {
  cpuMs: number;
  gridIntensityGCo2PerKwh?: number; // default 400 (EU average)
  tdpWatts?: number;                 // default 65W (typical server CPU per core)
  embodiedGCo2?: number;             // default 0
  functionalUnits?: number;          // default 1
}

export interface SciScore {
  energyKwh: number;
  sciGCo2: number;
  gridIntensity: number;
  tdpWatts: number;
}

export interface SciDelta {
  absoluteGCo2: number;
  percentChange: number;
}

const DEFAULT_GRID_INTENSITY = 400; // gCO2/kWh EU average
const DEFAULT_TDP_WATTS = 65;       // typical server CPU per core

export function computeSci(input: SciInput): SciScore {
  const tdpWatts = input.tdpWatts ?? DEFAULT_TDP_WATTS;
  const gridIntensity = input.gridIntensityGCo2PerKwh ?? DEFAULT_GRID_INTENSITY;
  const embodied = input.embodiedGCo2 ?? 0;
  const units = input.functionalUnits ?? 1;

  // E = TDP (W) × time (h) / 1000 → kWh
  const cpuHours = input.cpuMs / 1000 / 3600;
  const energyKwh = (tdpWatts * cpuHours) / 1000;

  // SCI = ((E × I) + M) / R
  const sciGCo2 = ((energyKwh * gridIntensity) + embodied) / units;

  return {
    energyKwh: Math.round(energyKwh * 1_000_000) / 1_000_000,
    sciGCo2: Math.round(sciGCo2 * 1000) / 1000,
    gridIntensity,
    tdpWatts,
  };
}

export function computeSciDelta(base: SciScore, pr: SciScore): SciDelta {
  const absoluteGCo2 = pr.sciGCo2 - base.sciGCo2;
  const percentChange = base.sciGCo2 === 0 ? 0 : (absoluteGCo2 / base.sciGCo2) * 100;

  return {
    absoluteGCo2: Math.round(absoluteGCo2 * 1000) / 1000,
    percentChange: Math.round(percentChange * 100) / 100,
  };
}

export function formatSci(sci: SciScore): string {
  return `${sci.sciGCo2} gCO2eq (${sci.energyKwh.toFixed(6)} kWh @ ${sci.gridIntensity} gCO2/kWh)`;
}
