"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { IconToday } from "@/components/icons/IconToday";
import { IconProgram } from "@/components/icons/IconProgram";
import { IconTracking } from "@/components/icons/IconTracking";
import { IconTrophy } from "@/components/icons/IconTrophy";

const ITEMS = [
  { label: "Aujourd'hui", href: "/", Icon: IconToday },
  { label: "Programme", href: "/programme", Icon: IconProgram },
  { label: "Tracking", href: "/tracking", Icon: IconTracking },
  { label: "Trophées", href: "/trophees", Icon: IconTrophy },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <BottomNav
      items={ITEMS.map((item) => {
        // Un onglet reste actif sur ses sous-pages (/trophees/push-ups…) ; « / » seulement en exact.
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return { label: item.label, href: item.href, active, icon: <item.Icon active={active} /> };
      })}
    />
  );
}
