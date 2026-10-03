"use client";

import { useState } from "react";
import { SeptTraits } from "@/components/SeptTraits";
import { PARCOURS } from "@/lib/programme/parcours";
import { DaySheet } from "./DaySheet";
import type { PastilleState } from "@/components/Pastille";
import type { ProgrammeLevelRow } from "@/lib/programme/loadProgrammeState";

// dayIndex null : plus aucun jour d'entraînement à faire dans le niveau (fin de niveau).
type Current = { parcours: string; level: number; dayIndex: number | null } | null;

// Le jour courant reste « fait » s'il est validé ; sinon il passe en « aujourd'hui ».
function withToday(states: PastilleState[], todayIndex: number | null): PastilleState[] {
  if (todayIndex === null) return states;
  return states.map((s, i) => (i === todayIndex && s === "upcoming" ? "today" : s));
}

const MARK: Record<PastilleState, string> = {
  done: "bg-cobalt h-1",
  today: "bg-cobalt opacity-35 h-1",
  upcoming: "bg-hairline h-1",
  skipped: "bg-hairline h-1",
  restOrWalk: "bg-hairline h-0.5",
};

export function ProgrammeScreen({
  initialParcours,
  levelsByParcours,
  current = null,
}: {
  initialParcours: string;
  levelsByParcours: Record<string, ProgrammeLevelRow[]>;
  current?: Current;
}) {
  const [parcours, setParcours] = useState(current?.parcours ?? initialParcours);
  const [openLevel, setOpenLevel] = useState<number | null>(current ? current.level : null);
  const [sheetDay, setSheetDay] = useState<{ level: number; dayIndex: number } | null>(null);

  const levels = levelsByParcours[parcours] ?? [];
  const parcoursIndex = Math.max(0, PARCOURS.findIndex((p) => p.id === parcours));
  const currentHere = current && current.parcours === parcours ? current : null;

  return (
    <div className="px-[18px] pt-5">
      <span className="font-mono text-11 uppercase tracking-[0.14em] text-graphite">Consultation libre</span>
      <h1 className="font-display font-extrabold text-[56px] uppercase leading-[0.9] mt-1.5">Programme</h1>
      <p className="text-[14px] text-graphite mt-1.5">Ta progression ne bouge pas quand tu consultes.</p>

      <div
        role="group"
        aria-label="Parcours"
        style={{ "--seg-index": String(parcoursIndex) } as React.CSSProperties}
        className="relative grid grid-cols-3 bg-paper border border-hairline rounded-pill p-1 mt-[18px]"
      >
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] rounded-pill bg-ink transition-transform duration-[450ms] ease-[cubic-bezier(.3,1.25,.4,1)] [transform:translateX(calc(var(--seg-index)*100%))] motion-reduce:transition-none"
        />
        {PARCOURS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === parcours}
            onClick={() => {
              setParcours(p.id);
              setOpenLevel(current && current.parcours === p.id ? current.level : null);
            }}
            className={`relative z-10 h-[38px] rounded-pill font-body text-13 font-semibold transition-colors duration-300 ${
              p.id === parcours ? "text-paper" : "text-graphite"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 mt-[18px]">
        {levels.map((row, i) => {
          const isCurrent = currentHere?.level === row.level;
          const isOpen = openLevel === row.level;
          const states = withToday(row.pastilles, isCurrent ? currentHere!.dayIndex : null);
          return (
            <section
              key={row.level}
              style={{ animationDelay: `${i * 45}ms` }}
              className="card-rise bg-paper rounded-[22px] overflow-hidden"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenLevel(isOpen ? null : row.level)}
                className="w-full grid grid-cols-[44px_1fr_auto] items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className={`font-display font-extrabold text-[40px] leading-[0.85] ${isCurrent ? "text-cobalt" : ""}`}>
                  {row.level + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-15">
                    Niveau {row.level + 1}
                    {isCurrent && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cobalt bg-cobalt-soft rounded-pill px-[7px] py-[3px]">
                        En cours
                      </span>
                    )}
                  </span>
                  <span className="block mt-[9px]">
                    <SeptTraits states={states} size="sm" />
                  </span>
                </span>
                <span className="font-mono text-[12px] text-graphite text-right tabular-nums">
                  <b className="font-display font-bold text-[22px] text-ink tracking-[0.02em]">{row.percentDone}</b> %
                </span>
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-[400ms] ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  {isOpen &&
                    row.days.map((d) => {
                      const isToday = isCurrent && currentHere!.dayIndex !== null && currentHere!.dayIndex === d.dayIndex;
                      const isRest = d.exerciseCount === 0;
                      const mark = states[d.dayIndex] ?? d.pastilleState;
                      return (
                        <button
                          key={d.dayIndex}
                          type="button"
                          disabled={isRest}
                          onClick={() => setSheetDay({ level: row.level, dayIndex: d.dayIndex })}
                          className="w-full grid grid-cols-[28px_1fr_auto] items-center gap-2.5 px-4 py-3 border-t border-hairline text-left min-h-[52px] disabled:cursor-default"
                        >
                          <span aria-hidden="true" className={`block w-[22px] rounded-pill ${MARK[mark]}`} />
                          <span>
                            <span className="block text-15">{d.title}</span>
                            <span className="block font-mono text-11 text-graphite mt-0.5">
                              {isRest ? "Repos" : `${d.exerciseCount} exercices · ${d.durationEstimateMinutes} min`}
                            </span>
                          </span>
                          {isToday ? (
                            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper bg-cobalt rounded-pill px-[7px] py-[3px]">
                              Aujourd&apos;hui
                            </span>
                          ) : isRest ? (
                            <span />
                          ) : (
                            <span aria-hidden="true" className="text-graphite">
                              ›
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {sheetDay && (
        <DaySheet parcours={parcours} level={sheetDay.level} dayIndex={sheetDay.dayIndex} onClose={() => setSheetDay(null)} />
      )}
    </div>
  );
}
