import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.resolve(__dirname, "./globals.css"), "utf-8");

describe("design tokens", () => {
  it.each([
    ["--color-paper", "#FFFFFF"],
    ["--color-canvas", "#EDEFF2"],
    ["--color-ink", "#0B0D12"],
    ["--color-graphite", "#626B78"],
    ["--color-hairline", "#D9DEE5"],
    ["--color-cobalt", "#2F2BFF"],
    ["--color-cobalt-soft", "#E6E5FF"],
    ["--color-sage", "#0F9D74"],
    ["--color-sage-soft", "#DDF3EC"],
    ["--color-sage-ink", "#0A5E47"],
    ["--color-brass", "#C8961E"],
    ["--color-brass-soft", "#F6EDD8"],
    ["--color-alert", "#B3402E"],
    ["--color-rest-surface", "#1A1E28"],
    ["--color-rest-line", "#232733"],
  ])("declares %s as %s", (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`));
  });

  it.each([
    ["--radius-card", "24px"],
    ["--radius-field", "14px"],
    ["--radius-pill", "999px"],
  ])("declares %s as %s", (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`));
  });

  it.each([11, 13, 15, 18, 24, 32, 44, 72, 96, 112, 120])(
    "declares --text-%i",
    (size) => {
      expect(css).toMatch(new RegExp(`--text-${size}:\\s*${size}px;`));
    },
  );

  it.each(["--font-display", "--font-body", "--font-mono"])("declares the %s utility font", (name) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*var\\(--nf-`));
  });

  it("no longer declares the Archivo / Inter Tight fonts", () => {
    expect(css).not.toMatch(/--font-archivo|--font-inter-tight/);
  });
});
