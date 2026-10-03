import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CycleButton } from "./CycleButton";

const OPTIONS = [
  { value: "reps", label: "Plus de reps" },
  { value: "recent", label: "Récent" },
  { value: "alpha", label: "A → Z" },
] as const;

function Harness({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = useState<string>("reps");
  return <CycleButton options={[...OPTIONS]} value={v} onChange={(n) => { setV(n); onChange(n); }} ariaLabelPrefix="Changer le tri" />;
}

describe("CycleButton", () => {
  it("moves to the next option on each tap and loops", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const btn = screen.getByRole("button", { name: "Changer le tri : Plus de reps" });
    await userEvent.click(btn);
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(["recent", "alpha", "reps"]);
    expect(screen.getByRole("button", { name: "Changer le tri : Plus de reps" })).toHaveTextContent("Plus de reps");
  });
});
