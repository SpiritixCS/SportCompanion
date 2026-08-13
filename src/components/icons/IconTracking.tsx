import { Icon } from "../Icon";

export function IconTracking({ active, size, className }: { active: boolean; size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" strokeWidth={active ? 3 : 1.5} />
      <path d="M9 9h6" strokeWidth={active ? 3 : 1.5} />
      <path d="M9 13h6" strokeWidth={active ? 3 : 1.5} />
      <path d="M9 17h3" strokeWidth={active ? 3 : 1.5} />
    </Icon>
  );
}
