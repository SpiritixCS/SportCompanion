import Link from "next/link";
import { ACCENT_BORDER, type Accent } from "@/components/Pastille";

const ACCENT_TEXT: Record<Accent, string> = {
  cobalt: "text-cobalt",
  sage: "text-sage",
  brass: "text-brass",
};

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
    <Link
      href={href}
      className={`w-full text-left bg-paper border ${ACCENT_BORDER[accent]} rounded-card p-4 flex items-center justify-between gap-4`}
    >
      <span>
        <span className={`block font-display text-11 font-medium uppercase tracking-[0.08em] ${ACCENT_TEXT[accent]}`}>
          Séance interrompue
        </span>
        <span className="block text-15 mt-1.5">Reprendre à {exerciseName}</span>
      </span>
      <span className={`font-display text-24 ${ACCENT_TEXT[accent]} flex-none`}>→</span>
    </Link>
  );
}
