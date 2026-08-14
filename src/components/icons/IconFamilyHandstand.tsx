import { Icon } from "../Icon";

export function IconFamilyHandstand({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="6" r="2" />
      <path d="M12 8v9" />
      <path d="M6 20h12" />
    </Icon>
  );
}
