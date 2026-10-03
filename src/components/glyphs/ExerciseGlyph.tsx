import type { MovementFamily } from "@/lib/trophies/movementFamily";
import { EXERCISE_GLYPHS, FAMILY_GLYPHS } from "./glyphPaths";

export function glyphFor(exerciseId: string | null | undefined, family: MovementFamily | null | undefined): string {
  if (exerciseId && EXERCISE_GLYPHS[exerciseId]) return EXERCISE_GLYPHS[exerciseId]!;
  return (family && FAMILY_GLYPHS[family]) || FAMILY_GLYPHS.other;
}

// Le picto nu (sans pastille), pour les endroits qui ont déjà leur fond.
export function GlyphSvg({ exerciseId, family, size = 20 }: { exerciseId?: string | null; family?: MovementFamily | null; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // Chaînes constantes du dépôt (glyphPaths.ts), jamais de donnée utilisateur.
      dangerouslySetInnerHTML={{ __html: glyphFor(exerciseId, family) }}
    />
  );
}

const TILE = {
  cobalt: "bg-cobalt-soft text-cobalt",
  sage: "bg-sage-soft text-sage-ink",
};

export function ExerciseGlyph({
  exerciseId,
  family,
  accent = "cobalt",
  size = "md",
}: {
  exerciseId?: string | null;
  family?: MovementFamily | null;
  accent?: "cobalt" | "sage";
  size?: "md" | "lg";
}) {
  const lg = size === "lg";
  return (
    <span
      aria-hidden="true"
      className={`${TILE[accent]} ${lg ? "w-[84px] h-[84px] rounded-[24px]" : "w-9 h-9 rounded-[10px]"} grid place-items-center flex-none`}
    >
      <GlyphSvg exerciseId={exerciseId} family={family} size={lg ? 48 : 20} />
    </span>
  );
}
