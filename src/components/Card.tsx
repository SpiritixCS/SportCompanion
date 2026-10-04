export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-paper rounded-card ${className}`.trim()}>
      {children}
    </div>
  );
}
