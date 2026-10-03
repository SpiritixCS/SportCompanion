"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Pastille, type PastilleState, type Accent } from "@/components/Pastille";
import { LigneNiveau } from "@/components/LigneNiveau";
import { Button } from "@/components/Button";
import { BottomNav } from "@/components/BottomNav";
import { Sheet } from "@/components/Sheet";
import { IconCheck } from "@/components/icons/IconCheck";
import { IconSettings } from "@/components/icons/IconSettings";
import { IconChevronRight } from "@/components/icons/IconChevronRight";

const ACCENTS: Accent[] = ["cobalt", "sage", "brass"];
const STATES: PastilleState[] = ["upcoming", "today", "done", "skipped", "restOrWalk"];

export default function DesignSystemPage() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <main className="p-5 flex flex-col gap-10 pb-32">
      <section>
        <h2 className="font-archivo text-24 font-semibold mb-3">Card</h2>
        <Card className="p-5">Contenu de carte</Card>
      </section>

      <section>
        <h2 className="font-archivo text-24 font-semibold mb-3">Pastille</h2>
        {ACCENTS.map((accent) => (
          <div key={accent} className="flex gap-3 mb-2">
            {STATES.map((state) => (
              <Pastille key={state} state={state} accent={accent} />
            ))}
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-archivo text-24 font-semibold mb-3">LigneNiveau</h2>
        {ACCENTS.map((accent) => (
          <LigneNiveau
            key={accent}
            level={3}
            accent={accent}
            days={["done", "done", "today", "upcoming", "upcoming", "upcoming", "upcoming"]}
          />
        ))}
      </section>

      <section>
        <h2 className="font-archivo text-24 font-semibold mb-3">Button</h2>
        <div className="flex flex-col gap-2 max-w-xs">
          {ACCENTS.map((accent) => (
            <Button key={accent} variant="primary" accent={accent}>
              Primaire {accent}
            </Button>
          ))}
          <Button variant="secondary">Secondaire</Button>
          <Button variant="primary" accent="cobalt" disabled>
            Désactivé
          </Button>
        </div>
      </section>

      <section>
        <h2 className="font-archivo text-24 font-semibold mb-3">BottomNav</h2>
        <BottomNav
          items={[
            { label: "Aujourd'hui", icon: <IconCheck size={20} />, active: true, href: "/today" },
            { label: "Programme", icon: <IconChevronRight size={20} />, active: false, href: "/program" },
            { label: "Tracking", icon: <IconSettings size={20} />, active: false, href: "/tracking" },
            { label: "Trophées", icon: <IconCheck size={20} />, active: false, href: "/trophies" },
          ]}
        />
      </section>

      <section>
        <h2 className="font-archivo text-24 font-semibold mb-3">Sheet</h2>
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Ouvrir la feuille
        </Button>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Ajuster les reps">
          <p className="text-15">Contenu de la feuille modale.</p>
        </Sheet>
      </section>
    </main>
  );
}
