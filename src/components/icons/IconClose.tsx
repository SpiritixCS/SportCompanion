import { Icon } from "../Icon";

export function IconClose({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M18 6L6 18M6 6l12 12" />
    </Icon>
  );
}
