import Link from "next/link";

export function ResumeBanner({ exerciseName, href }: { exerciseName: string; href: string }) {
  return (
    <Link
      href={href}
      className="w-full text-left bg-paper border border-cobalt rounded-card p-4 flex items-center justify-between gap-4"
    >
      <span>
        <span className="block font-archivo text-11 font-medium uppercase tracking-[0.08em] text-cobalt">
          Séance interrompue
        </span>
        <span className="block text-15 mt-1.5">Reprendre à {exerciseName}</span>
      </span>
      <span className="font-archivo text-24 text-cobalt flex-none">→</span>
    </Link>
  );
}
