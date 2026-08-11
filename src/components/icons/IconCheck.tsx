import { Icon } from "../Icon";

export function IconCheck({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M5 13l4 4L19 7" />
    </Icon>
  );
}
