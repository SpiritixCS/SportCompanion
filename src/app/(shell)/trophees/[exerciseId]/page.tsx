import Link from "next/link";
import { notFound } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTrophyDetail } from "@/lib/trophies/loadTrophyDetail";
import { listExtraReps } from "@/lib/extraReps/db";
import { ExtraRepsSection } from "@/components/trophies/ExtraRepsSection";
import { TrophyMark } from "@/components/trophies/TrophyCard";
import { PalierLadder } from "@/components/trophies/PalierLadder";

export const dynamic = "force-dynamic";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );
}

export default async function TrophyDetailPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  const db = getDbForUser(await currentUser());
  const detail = loadTrophyDetail(db, exerciseId);

  if (!detail) notFound();

  const isReps = detail.unit === "reps";

  return (
    <div className="px-[18px] pt-5 pb-10">
      <Link
        href="/trophees"
        aria-label="Retour aux trophées"
        className="w-11 h-11 rounded-pill border border-hairline bg-paper grid place-items-center text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>

      <div className="mt-[18px]">
        <TrophyMark card={detail} size="lg" />
      </div>
      <h1 className="font-display font-extrabold text-44 uppercase leading-[0.9] mt-3.5 [text-wrap:balance]">{detail.name}</h1>
      <div className="font-display font-extrabold text-[96px] leading-[0.82] tabular-nums mt-3">
        {detail.total.toLocaleString("fr-FR")}
      </div>
      <div className="font-mono text-11 uppercase tracking-[0.14em] text-graphite mt-1.5">
        {isReps ? "reps" : "secondes"} au total
      </div>

      {isReps && <PalierLadder total={detail.total} />}

      <div className="bg-paper rounded-[22px] mt-2.5 px-4 py-0.5">
        <div className="flex justify-between gap-4 py-[13px] border-b border-hairline text-[14px]">
          <span className="text-graphite">Premier passage</span>
          <span className="tabular-nums">{formatDateFr(detail.firstAt)}</span>
        </div>
        <div className="flex justify-between gap-4 py-[13px] text-[14px]">
          <span className="text-graphite">Dernier passage</span>
          <span className="tabular-nums">{formatDateFr(detail.lastAt)}</span>
        </div>
      </div>

      <ExtraRepsSection cardId={detail.id} unit={detail.unit} entries={listExtraReps(db, detail.id)} />
    </div>
  );
}
