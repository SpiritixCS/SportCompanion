"use client";

import { useEffect, useState } from "react";
import { IconSettings } from "@/components/icons/IconSettings";

function formatTodayLabel(): string {
  const raw = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(),
  );
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Filled in an effect, not at render time: the server render (VM, likely
// UTC) and the client hydration pass (browser, Europe/Paris) can disagree
// on "today" right around local midnight — same class of bug as the
// trophies UTC/local day mix noted in this project's migration history.
// Seeding blank and filling client-side avoids both the hydration
// mismatch and a wrong date.
export function AujourdhuiHeader({
  userLabel,
  onOpenReglages,
}: {
  userLabel: string;
  onOpenReglages: () => void;
}) {
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    setDateLabel(formatTodayLabel());
  }, []);

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="block font-mono text-11 uppercase tracking-[0.14em] text-graphite min-h-[1em]">{dateLabel}</span>
        <h1 className="font-display font-extrabold text-44 uppercase leading-[0.95] tracking-[0.01em] mt-2 max-w-[8ch]">
          Salut {userLabel}.
        </h1>
      </div>
      <button
        type="button"
        onClick={onOpenReglages}
        aria-label="Réglages"
        className="w-11 h-11 rounded-pill border border-hairline bg-paper flex items-center justify-center flex-none transition-transform duration-500 hover:rotate-90 motion-reduce:transition-none"
      >
        <IconSettings />
      </button>
    </div>
  );
}
