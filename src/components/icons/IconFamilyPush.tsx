import { Icon } from "../Icon";

export function IconFamilyPush({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M12 20V7" />
      <path d="M7 12l5-5 5 5" />
      <path d="M5 20h14" />
    </Icon>
  );
}
