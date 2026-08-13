"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/Card";
import { useCountUp } from "./useCountUp";
import { palierAtteint } from "@/lib/trophies/paliers";
import type { TrophyCard as TrophyCardData } from "@/lib/trophies/computeTrophies";

export function TrophyCard({ card, index }: { card: TrophyCardData; index: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const total = useCountUp(card.total, index * 40);
  const palier = card.unit === "seconds" ? null : palierAtteint(card.total);
  const hasImage = card.module === "programme" && !imageFailed;

  return (
    <Link href={`/trophees/${card.id}`} className="block">
      <Card className="overflow-hidden h-full">
        {hasImage && (
          <div className="aspect-square bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/exercises/${card.id}.jpg`}
              alt={card.name}
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        <div className="p-4">
          <div className="text-15">{card.name}</div>
          <div className="font-archivo text-24 font-semibold tabular-nums mt-2">
            {total}
            {card.unit === "seconds" && <span className="text-15 font-medium"> s</span>}
          </div>
          {palier !== null && (
            <div className="mt-2 pt-2 border-t border-brass/30">
              <span className="font-archivo text-11 font-medium text-brass">
                Palier {palier.toLocaleString("fr-FR")}
              </span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
