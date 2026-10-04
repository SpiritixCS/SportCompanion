import { pyramidLabel, type PyramidShape } from "@/lib/pyramide/pyramid";
import type { TrackingUnit } from "./db";

// « 3 × 10 », « 3 × 45 s » ou « Pyramide 1→7→1 ».
export function doseLabel(e: {
  setsCount: number;
  targetValue: number;
  unit: TrackingUnit;
  pyramid?: { shape: PyramidShape; peak: number } | null;
}): string {
  if (e.pyramid) return pyramidLabel(e.pyramid.shape, e.pyramid.peak);
  return `${e.setsCount} × ${e.targetValue}${e.unit === "seconds" ? " s" : ""}`;
}
