export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-paper border border-hairline rounded-card ${className}`.trim()}>
      {children}
    </div>
  );
}
