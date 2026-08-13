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
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite">
          {dateLabel}
        </span>
        <div className="font-archivo text-32 font-semibold leading-[1.05] mt-2">Salut {userLabel}.</div>
      </div>
      <button
        type="button"
        onClick={onOpenReglages}
        aria-label="Réglages"
        className="w-11 h-11 rounded-pill border border-hairline bg-paper flex items-center justify-center flex-none"
      >
        <IconSettings />
      </button>
    </div>
  );
}
