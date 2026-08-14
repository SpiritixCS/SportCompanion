import { Icon } from "../Icon";

export function IconFamilyPull({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M12 4v13" />
      <path d="M17 12l-5 5-5-5" />
      <path d="M5 4h14" />
    </Icon>
  );
}
