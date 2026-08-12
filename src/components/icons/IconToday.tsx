import { Icon } from "../Icon";

export function IconToday({ active, size, className }: { active: boolean; size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      {active ? (
        <circle cx="12" cy="12" r="7" fill="currentColor" stroke="none" />
      ) : (
        <circle cx="12" cy="12" r="7" />
      )}
    </Icon>
  );
}
