import { Icon } from "../Icon";

// Icône de la barre de navigation (maquettes design/v1). L'onglet actif est
// signalé par la pastille blanche, pas par l'icône.
export function IconTracking({ size = 22, className }: { active?: boolean; size?: number; className?: string }) {
  return (
    <Icon size={size} className={className} strokeWidth={1.7}>
      <path d="M4 18l5-6 4 3 7-9" />
      <path d="M4 21h16" />
    </Icon>
  );
}
