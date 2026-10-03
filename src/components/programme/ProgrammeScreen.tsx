"use client";

import { useState } from "react";
import { Pastille } from "@/components/Pastille";
import { PARCOURS } from "@/lib/programme/parcours";
import { DaySheet } from "./DaySheet";
import type { ProgrammeLevelRow } from "@/lib/programme/loadProgrammeState";

export function ProgrammeScreen({
  initialParcours,
  levelsByParcours,
}: {
  initialParcours: string;
  levelsByParcours: Record<string, ProgrammeLevelRow[]>;
}) {
  const [parcours, setParcours] = useState(initialParcours);
  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [sheetDay, setSheetDay] = useState<{ level: number; dayIndex: number } | null>(null);

  const levels = levelsByParcours[parcours] ?? [];

  return (
    <div className="p-5">
      <h1 className="font-display text-32 font-semibold">Programme</h1>
      <p className="text-15 text-graphite mt-2">Consultation libre. Ta progression ne bouge pas.</p>

      <div className="flex gap-1 bg-paper border border-hairline rounded-pill p-1 mt-6">
        {PARCOURS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setParcours(p.id);
              setOpenLevel(null);
            }}
            className={`flex-1 h-10 rounded-pill font-body text-13 font-semibold ${
              p.id === parcours ? "bg-ink text-paper" : "text-graphite"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col mt-8 bg-paper border border-hairline rounded-card overflow-hidden">
        {levels.map((row, i) => (
          <div key={row.level} className={i > 0 ? "border-t border-hairline" : ""}>
            <button
              type="button"
              onClick={() => setOpenLevel(openLevel === row.level ? null : row.level)}
              className="w-full text-left flex items-center gap-4 p-4"
            >
              <span className="font-display text-24 font-semibold tabular-nums w-8 flex-none">{row.level + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-15">Niveau {row.level + 1}</span>
                <span className="flex gap-1.5 mt-2">
                  {row.pastilles.map((state, d) => (
                    <Pastille key={d} state={state} accent="cobalt" />
                  ))}
                </span>
              </span>
              <span className="font-display text-13 font-medium text-graphite tabular-nums flex-none">
                {row.percentDone}%
              </span>
            </button>
            {openLevel === row.level && (
              <div className="flex flex-col pb-2">
                {row.days.map((d) => (
                  <button
                    key={d.dayIndex}
                    type="button"
                    onClick={() => setSheetDay({ level: row.level, dayIndex: d.dayIndex })}
                    className="flex items-center gap-3.5 px-4 py-3 border-t border-hairline text-left min-h-11"
                  >
                    <Pastille state={d.pastilleState} accent="cobalt" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-15">{d.title}</span>
                      <span className="block text-13 text-graphite mt-0.5">
                        {d.exerciseCount > 0 ? `${d.exerciseCount} exercices · ${d.durationEstimateMinutes} min` : "Repos"}
                      </span>
                    </span>
                    <span className="text-graphite text-15">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {sheetDay && (
        <DaySheet
          parcours={parcours}
          level={sheetDay.level}
          dayIndex={sheetDay.dayIndex}
          onClose={() => setSheetDay(null)}
        />
      )}
    </div>
  );
}
