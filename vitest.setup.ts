import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock next/font/google to return deterministic __variable_ class names in test env
// NOTE: This mock intentionally exposes only .variable (CSS custom property class name)
// per the current font-loading contract. If future code needs .className or .style,
// widen this mock to include them rather than debugging undefined properties.
vi.mock("next/font/google", () => ({
  Archivo: () => ({ variable: "__variable_archivo_hash" }),
  Inter_Tight: () => ({ variable: "__variable_inter_tight_hash" }),
}));
