import { Icon } from "../Icon";

export function IconFamilyDip({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M5 6v12" />
      <path d="M19 6v12" />
      <path d="M5 12h14" />
    </Icon>
  );
}
