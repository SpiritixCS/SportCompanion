import { Icon } from "../Icon";

const DOTS = [
  [7, 7], [12, 7], [17, 7],
  [7, 12], [12, 12], [17, 12],
  [7, 17], [12, 17], [17, 17],
];

export function IconProgram({ active, size, className }: { active: boolean; size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      {DOTS.map(([cx, cy]) =>
        active ? (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="currentColor" stroke="none" />
        ) : (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.1" fill="currentColor" stroke="none" opacity="0.6" />
        ),
      )}
    </Icon>
  );
}
