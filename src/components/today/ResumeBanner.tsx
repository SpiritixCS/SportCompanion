import Link from "next/link";
import type { Accent } from "@/components/Pastille";

const DOT: Record<Accent, string> = { cobalt: "bg-cobalt", sage: "bg-sage", brass: "bg-brass" };
const RING: Record<Accent, string> = { cobalt: "border-cobalt", sage: "border-sage", brass: "border-brass" };

export function ResumeBanner({
  exerciseName,
  href,
  accent = "cobalt",
}: {
  exerciseName: string;
  href: string;
  accent?: Accent;
}) {
  return (
    <Link href={href} className="w-full flex items-center gap-3 rounded-[16px] bg-ink text-paper px-3.5 py-3">
      <span aria-hidden="true" data-testid="resume-dot" className={`relative w-2.5 h-2.5 rounded-pill flex-none ${DOT[accent]}`}>
        <span className={`absolute -inset-1.5 rounded-pill border-2 ${RING[accent]} animate-ping motion-reduce:animate-none`} />
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10px] uppercase tracking-[0.12em] opacity-60 mb-0.5">Séance interrompue</span>
        <span className="block text-15 leading-snug">Reprendre à {exerciseName}</span>
      </span>
      <span aria-hidden="true" className="ml-auto font-display text-[22px]">→</span>
    </Link>
  );
}
