import { Icon } from "../Icon";

// Icône de la barre de navigation (maquettes design/v1). L'onglet actif est
// signalé par la pastille blanche, pas par l'icône.
export function IconTrophy({ size = 22, className }: { active?: boolean; size?: number; className?: string }) {
  return (
    <Icon size={size} className={className} strokeWidth={1.7}>
      <path d="M7 4h10v5a5 5 0 01-10 0z" />
      <path d="M12 14v4M8 21h8M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3" />
    </Icon>
  );
}
