"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BilanDos } from "./BilanDos";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { ArbreId } from "@/lib/backpain/arbres";
import type { Reserve } from "@/lib/dos/bilan";

type Result = { arbre: ArbreId; nom: string; message: string };

export function BilanDosClient({
  seanceId,
  arbres,
  completeAction,
}: {
  seanceId: number;
  arbres: { arbre: ArbreId; nom: string }[];
  completeAction: (
    seanceId: number,
    genePendant: number,
    reserves: Partial<Record<ArbreId, Reserve>>,
  ) => Promise<Result[]>;
}) {
  const router = useRouter();
  const [results, setResults] = useState<Result[] | null>(null);

  if (results) {
    return (
      <div className="min-h-dvh flex flex-col bg-canvas">
        <div className="flex-1 overflow-y-auto px-5 pt-10 pb-6">
          <h1 className="font-archivo text-32 font-semibold">Résultat</h1>
          <div className="flex flex-col gap-3 mt-6">
            {results.map((r) => (
              <Card key={r.arbre} className="p-4">
                <div className="text-15 font-medium">{r.nom}</div>
                <div className="text-15 text-graphite mt-1">{r.message}</div>
              </Card>
            ))}
          </div>
        </div>
        <div className="flex-none px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-paper border-t border-hairline shadow-[0_-12px_24px_rgba(17,19,16,0.04)]">
          <Button variant="primary" accent="sage" onClick={() => router.push("/")}>
            Terminer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <BilanDos
      arbres={arbres}
      onValidate={async (reserves, genePendant) => {
        const outcome = await completeAction(seanceId, genePendant, reserves);
        setResults(outcome);
      }}
    />
  );
}
