import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.resolve(__dirname, "./globals.css"), "utf-8");

describe("design tokens", () => {
  it.each([
    ["--color-paper", "#FFFFFF"],
    ["--color-canvas", "#F6F7F4"],
    ["--color-ink", "#111310"],
    ["--color-graphite", "#6E736B"],
    ["--color-hairline", "#E5E7E1"],
    ["--color-cobalt", "#1F3BE0"],
    ["--color-sage", "#2E7D63"],
    ["--color-brass", "#A9782C"],
    ["--color-alert", "#B3402E"],
  ])("declares %s as %s", (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`));
  });

  it.each([
    ["--radius-card", "20px"],
    ["--radius-field", "14px"],
    ["--radius-pill", "999px"],
  ])("declares %s as %s", (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`));
  });

  it.each([11, 13, 15, 18, 24, 32, 44, 72, 96])(
    "declares --text-%i",
    (size) => {
      expect(css).toMatch(new RegExp(`--text-${size}:\\s*${size}px;`));
    },
  );
});
