import { Icon } from "../Icon";

// Icône de la barre de navigation (maquettes design/v1). L'onglet actif est
// signalé par la pastille blanche, pas par l'icône.
export function IconToday({ size = 22, className }: { active?: boolean; size?: number; className?: string }) {
  return (
    <Icon size={size} className={className} strokeWidth={1.7}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}
