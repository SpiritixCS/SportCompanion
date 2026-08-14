"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Pastille } from "@/components/Pastille";
import { BackPainCard } from "@/components/today/BackPainCard";
import { DosSetup } from "./DosSetup";
import type { DosScreenState } from "@/lib/dos/loadDosScreenState";

export function DosScreen({ state }: { state: DosScreenState }) {
  const router = useRouter();

  if (state.phase === "no-start-date") {
    return <DosSetup onDone={() => router.refresh()} />;
  }

  return (
    <div className="p-5 flex flex-col gap-8">
      <div>
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
        <div className="text-15 text-graphite mt-1">
          Semaine {state.semaine} · Bloc {state.bloc}
        </div>
      </div>

      {state.today.phase === "rest" ? (
        <Card className="p-5">
          <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
          <div className="font-archivo text-18 font-semibold mt-3">Repos</div>
        </Card>
      ) : state.today.phase === "normal" ? (
        <BackPainCard
          jourLabel={state.today.jourLabel}
          intitule={state.today.intitule}
          exercises={state.today.exercises}
          done={state.today.done}
          doneReps={state.today.doneReps}
          href="/player/dos"
        />
      ) : null}

      <div>
        <div className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
          Semaine en cours
        </div>
        <div className="flex gap-2">
          {state.weekPastilles.map((pastilleState, i) => (
            <Pastille key={i} state={pastilleState} accent="sage" />
          ))}
        </div>
      </div>

      <div>
        <div className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
          Progression des arbres
        </div>
        <Card className="overflow-hidden">
          {state.arbresProgress.map((row, i) => (
            <div
              key={row.arbre}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 border-hairline ${i > 0 ? "border-t" : ""}`}
            >
              <div>
                <div className="text-15 font-medium">{row.nom}</div>
                <div className="text-13 text-graphite mt-0.5">{row.cranNom}</div>
              </div>
              <div className="flex gap-1 flex-none">
                {Array.from({ length: row.totalCrans }, (_, cranIndex) => (
                  <span
                    key={cranIndex}
                    className={`w-1.5 h-1.5 rounded-pill ${cranIndex < row.cranCourant ? "bg-sage" : "bg-hairline"}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
