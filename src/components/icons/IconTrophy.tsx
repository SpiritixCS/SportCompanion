import { Icon } from "../Icon";

export function IconTrophy({ active, size, className }: { active: boolean; size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      {active ? (
        <path d="M12 3l6 6-6 6-6-6z" fill="currentColor" stroke="none" />
      ) : (
        <path d="M12 3l6 6-6 6-6-6z" />
      )}
    </Icon>
  );
}
