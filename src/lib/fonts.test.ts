import { describe, it, expect } from "vitest";
import { display, body, mono } from "./fonts";

describe("fonts", () => {
  it.each([
    ["display (Big Shoulders)", display],
    ["body (Instrument Sans)", body],
    ["mono (IBM Plex Mono)", mono],
  ])("exposes a CSS variable class for %s", (_name, font) => {
    expect(font.variable).toMatch(/^__variable_/);
  });
});
