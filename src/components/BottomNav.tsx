import Link from "next/link";

// Barre flottante Agrès : pilule sombre, pastille blanche qui glisse sous
// l'onglet actif. ≥ 1024 px : même pilule en rail vertical à gauche.
export function BottomNav({
  items,
}: {
  items: { label: string; icon: React.ReactNode; active: boolean; href: string }[];
}) {
  const activeIndex = Math.max(0, items.findIndex((item) => item.active));
  return (
    <nav
      className="fixed z-30 left-3.5 right-3.5 bottom-[calc(18px+env(safe-area-inset-bottom))] h-[66px] grid grid-cols-4 p-1.5 rounded-pill bg-ink/90 backdrop-blur-md lg:sticky lg:top-6 lg:self-start lg:mt-6 lg:ml-4 lg:h-[300px] lg:w-20 lg:grid-cols-1 lg:grid-rows-4"
    >
      <span
        aria-hidden="true"
        data-testid="nav-capsule"
        style={{ "--nav-index": String(activeIndex) } as React.CSSProperties}
        className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc((100%-12px)/4)] rounded-pill bg-paper transition-transform duration-500 ease-[cubic-bezier(.3,1.25,.4,1)] [transform:translateX(calc(var(--nav-index)*100%))] motion-reduce:transition-none lg:right-1.5 lg:bottom-auto lg:w-auto lg:h-[calc((100%-12px)/4)] lg:[transform:translateY(calc(var(--nav-index)*100%))]"
      />
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`relative z-10 flex min-h-11 flex-col items-center justify-center gap-[3px] font-mono text-[10px] uppercase tracking-[0.06em] transition-colors duration-300 ${
            item.active ? "text-ink" : "text-mist"
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
