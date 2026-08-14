import type { ComponentType } from "react";
import { IconFamilyPush } from "@/components/icons/IconFamilyPush";
import { IconFamilyPull } from "@/components/icons/IconFamilyPull";
import { IconFamilySquat } from "@/components/icons/IconFamilySquat";
import { IconFamilyCore } from "@/components/icons/IconFamilyCore";
import { IconFamilyDip } from "@/components/icons/IconFamilyDip";
import { IconFamilyHandstand } from "@/components/icons/IconFamilyHandstand";
import { IconFamilyLever } from "@/components/icons/IconFamilyLever";
import { IconFamilyOther } from "@/components/icons/IconFamilyOther";
import type { MovementFamily } from "@/lib/trophies/movementFamily";

type FamilyIconProps = { size?: number; className?: string };

const ICONS_BY_FAMILY: Record<MovementFamily, ComponentType<FamilyIconProps>> = {
  core: IconFamilyCore,
  dip: IconFamilyDip,
  handstand: IconFamilyHandstand,
  lever: IconFamilyLever,
  other: IconFamilyOther,
  pull: IconFamilyPull,
  push: IconFamilyPush,
  squat: IconFamilySquat,
};

export function ExerciseFamilyIcon({ family, size, className }: { family: MovementFamily } & FamilyIconProps) {
  const IconComponent = ICONS_BY_FAMILY[family] ?? IconFamilyOther;
  return <IconComponent size={size} className={className} />;
}
