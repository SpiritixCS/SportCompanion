import Link from "next/link";
import path from "node:path";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { loadTrophyDetail } from "@/lib/trophies/loadTrophyDetail";
import { Card } from "@/components/Card";
import { IconClose } from "@/components/icons/IconClose";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

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
  const db = getDb(dbPath());
  const detail = loadTrophyDetail(db, exerciseId);

  if (!detail) notFound();

  return (
    <div className="pb-10">
      <div className="p-5">
        <Link
          href="/trophees"
          aria-label="Retour aux trophées"
          className="w-11 h-11 rounded-pill border border-hairline bg-paper flex items-center justify-center text-ink"
        >
          <IconClose size={18} />
        </Link>
      </div>

      <div className="px-5">
        {detail.module === "programme" && (
          <div className="aspect-[4/3] rounded-card border border-hairline bg-paper overflow-hidden mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/exercises/${detail.id}.jpg`}
              alt={detail.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <h1 className="font-archivo text-32 font-semibold">{detail.name}</h1>
        <div className="font-archivo text-44 font-semibold tabular-nums mt-3">{detail.total}</div>

        <Card className="mt-6 p-4">
          <div className="flex justify-between py-2">
            <span className="text-15 text-graphite">Premier passage</span>
            <span className="text-15 tabular-nums">{formatDateFr(detail.firstAt)}</span>
          </div>
          <div className="flex justify-between py-2 border-t border-hairline">
            <span className="text-15 text-graphite">Dernier passage</span>
            <span className="text-15 tabular-nums">{formatDateFr(detail.lastAt)}</span>
          </div>
          <div className="flex justify-between py-2 border-t border-hairline">
            <span className="text-15 text-graphite">Prochain palier</span>
            <span className="text-15 tabular-nums">
              {detail.prochainPalier === null
                ? "Tous les paliers atteints"
                : `${detail.resteAParcourir} restants pour atteindre ${detail.prochainPalier}`}
            </span>
          </div>
        </Card>

        {detail.byCran && detail.byCran.length > 0 && (
          <Card className="mt-4 overflow-hidden">
            {detail.byCran.map((row, i) => (
              <div
                key={row.cran}
                className={`flex justify-between items-center gap-4 px-4 py-3 ${
                  i > 0 ? "border-t border-hairline" : ""
                }`}
              >
                <span className="text-15">{row.nom}</span>
                <span className="font-archivo text-15 font-semibold tabular-nums flex-none">{row.total}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
