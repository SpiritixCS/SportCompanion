import { Icon } from "../Icon";

export function IconFamilyCore({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="12" r="7" />
      <path d="M7.5 12h9" />
    </Icon>
  );
}
