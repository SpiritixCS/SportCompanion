import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock next/font/google to return deterministic __variable_ class names in test env
// NOTE: This mock intentionally exposes only .variable (CSS custom property class name)
// per the current font-loading contract. If future code needs .className or .style,
// widen this mock to include them rather than debugging undefined properties.
vi.mock("next/font/google", () => ({
  Big_Shoulders: () => ({ variable: "__variable_big_shoulders_hash" }),
  Instrument_Sans: () => ({ variable: "__variable_instrument_sans_hash" }),
  IBM_Plex_Mono: () => ({ variable: "__variable_ibm_plex_mono_hash" }),
}));
