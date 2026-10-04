// Exercice libre du Tracking : pas de picto, son initiale sur une pastille jade.
export function InitialTile({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span
      aria-hidden="true"
      data-testid="initial-tile"
      className={`bg-sage-soft text-sage-ink font-display font-extrabold grid place-items-center flex-none ${
        lg ? "w-[84px] h-[84px] rounded-[24px] text-44" : "w-9 h-9 rounded-[10px] text-[20px]"
      }`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
