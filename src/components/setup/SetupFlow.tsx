"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PARCOURS } from "@/lib/programme/parcours";
import { setCurrentPositionAction } from "@/lib/programme/actions";

type Step =
  | { step: "parcours" }
  | { step: "level"; parcours: string }
  | { step: "day"; parcours: string; level: number }
  | { step: "confirm"; parcours: string; level: number; dayIndex: number };

const STEP_NUMBER: Record<Step["step"], number> = { parcours: 1, level: 2, day: 3, confirm: 4 };

export function SetupFlow({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<Step>({ step: "parcours" });

  function back() {
    if (state.step === "level") setState({ step: "parcours" });
    else if (state.step === "day") setState({ step: "level", parcours: state.parcours });
    else if (state.step === "confirm") setState({ step: "day", parcours: state.parcours, level: state.level });
    else onClose();
  }

  async function confirm() {
    if (state.step !== "confirm") return;
    await setCurrentPositionAction(state.parcours, state.level, state.dayIndex);
    onClose();
    router.refresh();
  }

  const stepNumber = STEP_NUMBER[state.step];

  return (
    <div className="fixed inset-0 z-60 bg-canvas flex flex-col">
      <div className="flex-none px-5 pt-5">
        <div className="h-0.5 bg-hairline rounded-pill overflow-hidden">
          <div className="h-full bg-cobalt rounded-pill" style={{ width: `${(stepNumber / 4) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between mt-4">
          <button type="button" onClick={back} className="h-11 font-display text-15 font-medium text-graphite">
            {state.step === "parcours" ? "Annuler" : "Retour"}
          </button>
          <span className="font-mono text-11 uppercase tracking-[0.14em] text-graphite">
            Étape {stepNumber} / 4
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {state.step === "parcours" && (
          <ParcoursStep onSelect={(parcours) => setState({ step: "level", parcours })} />
        )}
        {state.step === "level" && (
          <LevelStep
            parcours={state.parcours}
            onSelect={(level) => setState({ step: "day", parcours: state.parcours, level })}
          />
        )}
        {state.step === "day" && (
          <DayStep
            parcours={state.parcours}
            level={state.level}
            onSelect={(dayIndex) => setState({ step: "confirm", parcours: state.parcours, level: state.level, dayIndex })}
          />
        )}
        {state.step === "confirm" && (
          <ConfirmStep parcours={state.parcours} level={state.level} dayIndex={state.dayIndex} />
        )}
      </div>

      {state.step === "confirm" && (
        <div className="flex-none px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-paper border-t border-hairline shadow-[0_-12px_24px_rgba(17,19,16,0.04)]">
          <button
            type="button"
            onClick={confirm}
            className="w-full h-14 rounded-pill bg-cobalt text-paper font-body text-15 font-semibold"
          >
            C&apos;est parti
          </button>
        </div>
      )}
    </div>
  );
}

function ParcoursStep({ onSelect }: { onSelect: (parcours: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-32 font-semibold">Choisis ton parcours</h1>
      {PARCOURS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className="text-left bg-paper border border-hairline rounded-card p-5"
        >
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-display text-24 font-semibold">{p.label}</span>
            <span className="font-display text-13 font-medium text-graphite tabular-nums">
              {p.levelCount} niveaux
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function LevelStep({ parcours, onSelect }: { parcours: string; onSelect: (level: number) => void }) {
  const meta = PARCOURS.find((p) => p.id === parcours)!;
  return (
    <div>
      <h1 className="font-display text-32 font-semibold">Choisis ton niveau</h1>
      <div className="flex flex-col mt-6 bg-paper border border-hairline rounded-card overflow-hidden">
        {meta.program.map((_, level) => (
          <button
            key={level}
            type="button"
            onClick={() => onSelect(level)}
            className={`w-full text-left flex items-center gap-4 p-4 ${level > 0 ? "border-t border-hairline" : ""}`}
          >
            <span className="font-display text-24 font-semibold tabular-nums w-8 flex-none">{level + 1}</span>
            <span className="text-15">Niveau {level + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DayStep({
  parcours,
  level,
  onSelect,
}: {
  parcours: string;
  level: number;
  onSelect: (dayIndex: number) => void;
}) {
  const meta = PARCOURS.find((p) => p.id === parcours)!;
  const days = meta.program[level] ?? [];
  return (
    <div>
      <h1 className="font-display text-32 font-semibold">Choisis ton jour</h1>
      <div className="flex flex-col gap-2.5 mt-6">
        {days.map((day, dayIndex) => (
          <button
            key={dayIndex}
            type="button"
            onClick={() => onSelect(dayIndex)}
            disabled={day.kind === "rest"}
            className="w-full text-left flex items-center gap-4 bg-paper border border-hairline rounded-card p-4 disabled:opacity-40"
          >
            <span className="font-body text-15 font-semibold w-8 flex-none">{dayIndex + 1}</span>
            <span className="text-15">{day.kind === "rest" ? "Repos" : `Jour ${dayIndex + 1}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfirmStep({ parcours, level, dayIndex }: { parcours: string; level: number; dayIndex: number }) {
  const meta = PARCOURS.find((p) => p.id === parcours)!;
  return (
    <div className="bg-paper border border-cobalt rounded-card p-6">
      <span className="font-mono text-11 uppercase tracking-[0.14em] text-cobalt">Point de départ</span>
      <div className="font-display text-32 font-semibold mt-3">
        {meta.label} · Niveau {level + 1} · Jour {dayIndex + 1}
      </div>
      <div className="text-15 text-graphite mt-3">
        Tu peux le changer à tout moment. Ta progression repart de là.
      </div>
    </div>
  );
}
