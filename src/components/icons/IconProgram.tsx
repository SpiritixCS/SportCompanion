import { Icon } from "../Icon";

// Icône de la barre de navigation (maquettes design/v1). L'onglet actif est
// signalé par la pastille blanche, pas par l'icône.
export function IconProgram({ size = 22, className }: { active?: boolean; size?: number; className?: string }) {
  return (
    <Icon size={size} className={className} strokeWidth={1.7}>
      <circle cx="8" cy="9" r="4" />
      <circle cx="16" cy="9" r="4" />
      <path d="M8 13v7M16 13v7" />
    </Icon>
  );
}
