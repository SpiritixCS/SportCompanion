import { Icon } from "../Icon";

export function IconChevronRight({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  );
}
