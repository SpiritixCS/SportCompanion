import { GlyphSvg } from "@/components/glyphs/ExerciseGlyph";
import type { MovementFamily } from "@/lib/trophies/movementFamily";

// ponytail: pont vers les nouveaux pictos le temps que Trophées passe à ExerciseGlyph (phase 4), puis à supprimer.
export function ExerciseFamilyIcon({ family, size }: { family: MovementFamily; size?: number; className?: string }) {
  return <GlyphSvg family={family} size={size} />;
}
