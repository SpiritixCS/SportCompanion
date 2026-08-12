"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { IconToday } from "@/components/icons/IconToday";
import { IconProgram } from "@/components/icons/IconProgram";
import { IconDos } from "@/components/icons/IconDos";
import { IconTrophy } from "@/components/icons/IconTrophy";

const NAV_ITEMS = [
  { label: "Aujourd'hui", href: "/", Icon: IconToday },
  { label: "Programme", href: "/programme", Icon: IconProgram },
  { label: "Dos", href: "/dos", Icon: IconDos },
  { label: "Trophées", href: "/trophees", Icon: IconTrophy },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <BottomNav
      items={NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return { label: item.label, href: item.href, active, icon: <item.Icon active={active} /> };
      })}
    />
  );
}
