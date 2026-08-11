import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders an svg with the design system stroke width", () => {
    const { container } = render(
      <Icon>
        <path d="M0 0 L1 1" />
      </Icon>,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("stroke-width", "1.5");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("defaults to 24px and accepts a custom size", () => {
    const { container } = render(
      <Icon size={16}>
        <path d="M0 0 L1 1" />
      </Icon>,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("height", "16");
  });
});
