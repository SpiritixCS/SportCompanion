import Link from "next/link";

export function BottomNav({
  items,
}: {
  items: { label: string; icon: React.ReactNode; active: boolean; href: string }[];
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around bg-paper border-t border-hairline py-2 pb-[env(safe-area-inset-bottom)] lg:static lg:flex-col lg:justify-start lg:border-t-0 lg:border-r lg:h-screen lg:w-20 lg:py-6 lg:gap-6">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex min-h-11 flex-col items-center justify-center gap-1 px-3 text-11 font-display uppercase tracking-wide ${
            item.active ? "text-ink" : "text-graphite"
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
