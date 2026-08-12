"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { setStartDateAction } from "@/lib/dos/actions";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DosSetup({ onDone }: { onDone: () => void }) {
  const [date, setDate] = useState(today());

  return (
    <div className="p-5">
      <Card className="p-6">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
        <div className="font-archivo text-24 font-semibold mt-3 leading-[1.15]">Tu démarres aujourd&apos;hui ?</div>
        <div className="text-15 text-graphite mt-3">
          La date de départ sert à calculer ta semaine et ton bloc — elle ne se modifie pas ensuite.
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-5 w-full h-14 rounded-field border border-hairline px-4 text-15"
        />
        <div className="mt-6">
          <Button
            variant="primary"
            accent="sage"
            onClick={async () => {
              await setStartDateAction(date);
              onDone();
            }}
          >
            C&apos;est parti
          </Button>
        </div>
      </Card>
    </div>
  );
}
