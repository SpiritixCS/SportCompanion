import { Icon } from "../Icon";

export function IconDos({ active, size, className }: { active: boolean; size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M4 8h16" strokeWidth={active ? 3 : 1.5} />
      <path d="M4 12h16" strokeWidth={active ? 3 : 1.5} />
      <path d="M4 16h16" strokeWidth={active ? 3 : 1.5} />
    </Icon>
  );
}
