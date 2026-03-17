import type { ScanLayer, Finding, ScanContext } from "./types.js";

export interface Scanner {
  id: string;
  name: string;
  layer: ScanLayer;
  scan(context: ScanContext): Promise<Finding[]>;
}
