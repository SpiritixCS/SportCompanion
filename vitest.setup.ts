import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock next/font/google to return deterministic __variable_ class names in test env
vi.mock("next/font/google", () => ({
  Archivo: () => ({ variable: "__variable_archivo_hash" }),
  Inter_Tight: () => ({ variable: "__variable_inter_tight_hash" }),
}));
