"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { IconToday } from "@/components/icons/IconToday";
import { IconProgram } from "@/components/icons/IconProgram";
import { IconDos } from "@/components/icons/IconDos";
import { IconTracking } from "@/components/icons/IconTracking";
import { IconTrophy } from "@/components/icons/IconTrophy";
import type { UserSlug } from "@/lib/auth/users";

const MATHIS_ITEMS = [
  { label: "Aujourd'hui", href: "/", Icon: IconToday },
  { label: "Programme", href: "/programme", Icon: IconProgram },
  { label: "Dos", href: "/dos", Icon: IconDos },
  { label: "Trophées", href: "/trophees", Icon: IconTrophy },
];

const CLEMENT_ITEMS = [
  { label: "Aujourd'hui", href: "/", Icon: IconToday },
  { label: "Programme", href: "/programme", Icon: IconProgram },
  { label: "Tracking", href: "/tracking", Icon: IconTracking },
  { label: "Trophées", href: "/trophees", Icon: IconTrophy },
];

export function AppNav({ userSlug }: { userSlug: UserSlug }) {
  const pathname = usePathname();
  const items = userSlug === "clement" ? CLEMENT_ITEMS : MATHIS_ITEMS;
  return (
    <BottomNav
      items={items.map((item) => {
        const active = pathname === item.href;
        return { label: item.label, href: item.href, active, icon: <item.Icon active={active} /> };
      })}
    />
  );
}
