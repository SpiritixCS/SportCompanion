import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReglagesScreen } from "./ReglagesScreen";

const getReglagesStateAction = vi.fn();
const updateSettingsAction = vi.fn();
vi.mock("@/lib/settings/actions", () => ({
  getReglagesStateAction: (...args: unknown[]) => getReglagesStateAction(...args),
  updateSettingsAction: (...args: unknown[]) => updateSettingsAction(...args),
}));

// Module-level mocks (required by vi.mock hoisting) otherwise accumulate call
// counts across tests in this file — clear between tests so each test's
// call-count assertions (e.g. the remount check) reflect only its own calls.
beforeEach(() => {
  vi.clearAllMocks();
});

const BASE_STATE = {
  restBetweenSetsSeconds: 90,
  restBetweenExercisesSeconds: 120,
  soundCountdownEnabled: false,
  startCountdownEnabled: false,
  keepScreenAwakeEnabled: true,
  dosStartDate: null,
  version: "0.1.0",
};

describe("ReglagesScreen", () => {
  it("loads settings on mount and renders all five groups", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    render(<ReglagesScreen userSlug="mathis" onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("90 s")).toBeInTheDocument());
    expect(screen.getByText("Programme")).toBeInTheDocument();
    expect(screen.getByText("Séance")).toBeInTheDocument();
    expect(screen.getByText("BackPain")).toBeInTheDocument();
    expect(screen.getByText("Données")).toBeInTheDocument();
    expect(screen.getByText("À propos")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
  });

  it("shows programme position when provided, a placeholder otherwise", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    render(
      <ReglagesScreen
        userSlug="mathis"
        onClose={() => {}}
        onChangePointDepart={() => {}}
        programmePosition={{ parcoursLabel: "Débutant", level: 2, dayIndex: 4 }}
      />,
    );
    await waitFor(() => expect(screen.getByText("Débutant")).toBeInTheDocument());
    expect(screen.getByText("Niveau 3 · Jour 5")).toBeInTheDocument();
  });

  it("shows Niveau N alone when dayIndex is null (level-up phase, no day assigned yet)", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    render(
      <ReglagesScreen
        userSlug="mathis"
        onClose={() => {}}
        onChangePointDepart={() => {}}
        programmePosition={{ parcoursLabel: "Débutant", level: 2, dayIndex: null }}
      />,
    );
    await waitFor(() => expect(screen.getByText("Débutant")).toBeInTheDocument());
    expect(screen.getByText("Niveau 3")).toBeInTheDocument();
  });

  it("calls onChangePointDepart when the row is tapped", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    const onChangePointDepart = vi.fn();
    render(<ReglagesScreen userSlug="mathis" onClose={() => {}} onChangePointDepart={onChangePointDepart} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("Changer mon point de départ")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Changer mon point de départ" }));
    expect(onChangePointDepart).toHaveBeenCalledOnce();
  });

  it("edits a rest duration through the DurationRow sheet", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    updateSettingsAction.mockResolvedValue({ ...BASE_STATE, restBetweenSetsSeconds: 105 });
    render(<ReglagesScreen userSlug="mathis" onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("90 s")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Repos entre séries" }));
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(updateSettingsAction).toHaveBeenCalledWith({ restBetweenSetsSeconds: 105 });
    await waitFor(() => expect(screen.getByText("105 s")).toBeInTheDocument());
  });

  it("toggles garder l'écran allumé", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    updateSettingsAction.mockResolvedValue({ ...BASE_STATE, keepScreenAwakeEnabled: false });
    render(<ReglagesScreen userSlug="mathis" onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("Garder l'écran allumé")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("switch", { name: "Garder l'écran allumé" }));
    expect(updateSettingsAction).toHaveBeenCalledWith({ keepScreenAwakeEnabled: false });
  });

  it("renders the Données rows disabled with a Bientôt disponible sub-label", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    render(<ReglagesScreen userSlug="mathis" onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getAllByText("Bientôt disponible")).toHaveLength(2));
  });

  it("shows an error state with a retry button when loading fails", async () => {
    getReglagesStateAction.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(BASE_STATE);
    render(<ReglagesScreen userSlug="mathis" onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("Impossible de charger les réglages.")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(screen.getByText("90 s")).toBeInTheDocument());
  });

  it("calls onClose when the close button is tapped", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    const onClose = vi.fn();
    render(<ReglagesScreen userSlug="mathis" onClose={onClose} onChangePointDepart={() => {}} programmePosition={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the error state when a settings update fails", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    updateSettingsAction.mockRejectedValue(new Error("boom"));
    render(<ReglagesScreen userSlug="mathis" onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("Garder l'écran allumé")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("switch", { name: "Garder l'écran allumé" }));
    await waitFor(() => expect(screen.getByText("Impossible de charger les réglages.")).toBeInTheDocument());
  });

  it("hides the BackPain section for Clément", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    render(
      <ReglagesScreen userSlug="clement" onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />,
    );
    await waitFor(() => expect(screen.getByText("Programme")).toBeInTheDocument());
    expect(screen.queryByText("BackPain")).not.toBeInTheDocument();
  });

  // Mandatory persistence check (CLAUDE.md §2/§7): a value edited in one
  // mount must still be there after the overlay unmounts and remounts —
  // ReglagesScreen must re-read from the action on every mount, never
  // reuse whatever it had in memory before.
  it("survives an unmount/remount cycle after an edit (reads fresh, not from memory)", async () => {
    getReglagesStateAction.mockResolvedValueOnce(BASE_STATE).mockResolvedValueOnce({
      ...BASE_STATE,
      restBetweenSetsSeconds: 105,
    });
    updateSettingsAction.mockResolvedValue({ ...BASE_STATE, restBetweenSetsSeconds: 105 });

    const { unmount } = render(
      <ReglagesScreen userSlug="mathis" onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />,
    );
    await waitFor(() => expect(screen.getByText("90 s")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Repos entre séries" }));
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(() => expect(screen.getByText("105 s")).toBeInTheDocument());
    unmount();

    render(<ReglagesScreen userSlug="mathis" onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("105 s")).toBeInTheDocument());
    expect(getReglagesStateAction).toHaveBeenCalledTimes(2);
  });
});
