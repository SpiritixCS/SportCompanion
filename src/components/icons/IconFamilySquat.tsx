import { Icon } from "../Icon";

export function IconFamilySquat({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M5 7v5l7 6 7-6V7" />
    </Icon>
  );
}
