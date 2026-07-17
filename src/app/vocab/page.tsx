"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { decks, getTopic } from "@/lib/content";
import { getCardStates, countNewCardsToday } from "@/lib/storage";
import { isDue } from "@/lib/srs";
import { useProgress } from "@/stores/progress";
import { PageHeader } from "@/components/ui/PageHeader";

type VocabInfo = {
  dueTotal: number;
  newAllowance: number;
  byDeck: Record<string, { learned: number; due: number }>;
};

export default function VocabPage() {
  const [info, setInfo] = useState<VocabInfo | null>(null);
  const newPerDay = useProgress((s) => s.newPerDay);

  useEffect(() => {
    (async () => {
      const states = await getCardStates();
      const newToday = await countNewCardsToday();
      const now = Date.now();
      const byDeck: VocabInfo["byDeck"] = {};
      let dueTotal = 0;
      for (const deck of decks) {
        let learned = 0;
        let due = 0;
        for (const c of deck.cards) {
          const s = states[c.id];
          if (s) {
            learned++;
            if (isDue(s, now)) due++;
          }
        }
        byDeck[deck.id] = { learned, due };
        dueTotal += due;
      }
      setInfo({ dueTotal, newAllowance: Math.max(0, newPerDay - newToday), byDeck });
    })();
  }, [newPerDay]);

  return (
    <main>
      <PageHeader title="Từ vựng" subtitle="Cụm từ công sở — học bằng lặp lại ngắt quãng" />

      <Link
        href="/vocab/review"
        className="mb-5 flex items-center justify-between rounded-2xl bg-primary p-4 text-white shadow-sm active:opacity-90"
      >
        <div>
          <div className="text-lg font-bold">Ôn tập ngay</div>
          <div className="text-sm opacity-90">
            {info === null
              ? "Đang tải..."
              : `${info.dueTotal} thẻ đến hạn · ${info.newAllowance} thẻ mới hôm nay`}
          </div>
        </div>
        <span className="text-2xl">▶️</span>
      </Link>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Bộ thẻ theo chủ đề</h2>
      <div className="space-y-2">
        {decks.map((deck) => {
          const topic = getTopic(deck.topic);
          const stats = info?.byDeck[deck.id];
          return (
            <Link
              key={deck.id}
              href={`/vocab/review?deck=${deck.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 active:opacity-80"
            >
              <span className="text-2xl">{topic?.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{deck.titleVi}</div>
                <div className="text-xs text-muted">
                  {stats?.learned ?? 0}/{deck.cards.length} thẻ đã học
                  {(stats?.due ?? 0) > 0 && (
                    <span className="ml-1 font-semibold text-primary">· {stats!.due} đến hạn</span>
                  )}
                </div>
              </div>
              <span className="text-muted">›</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
