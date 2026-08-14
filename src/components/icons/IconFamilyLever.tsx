import { Icon } from "../Icon";

export function IconFamilyLever({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <circle cx="6" cy="16" r="2" />
      <path d="M6 16L19 6" />
    </Icon>
  );
}
