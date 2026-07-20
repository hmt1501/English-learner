"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { decks, getTopic } from "@/lib/content";
import { getWordStats, getLastDoneMap, isMastered, type WordStats } from "@/lib/storage";
import { pickTodayTopic } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";

type Info = {
  stats: WordStats;
  todayTopic: string | undefined;
};

export default function VocabPage() {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    (async () => {
      const stats = await getWordStats();
      const lastStudied = await getLastDoneMap(["vocab"]);
      const dayIndex = Math.floor(Date.now() / 86_400_000);
      const todayTopic = pickTodayTopic(decks.map((d) => d.topic), lastStudied, dayIndex);
      setInfo({ stats, todayTopic });
    })();
  }, []);

  const perDeck = useMemo(() => {
    const map: Record<string, { learned: number; mastered: number; total: number }> = {};
    for (const deck of decks) {
      let learned = 0;
      let mastered = 0;
      for (const c of deck.cards) {
        const s = info?.stats[c.id];
        if (s && (s.correct > 0 || s.wrong > 0)) learned++;
        if (isMastered(s)) mastered++;
      }
      map[deck.id] = { learned, mastered, total: deck.cards.length };
    }
    return map;
  }, [info]);

  return (
    <main>
      <PageHeader title="Từ vựng" subtitle="Học theo chủ đề — gõ nghĩa, xem câu ví dụ, rồi luyện dịch câu" />

      {info?.todayTopic && (
        <Link
          href={`/vocab/study?topic=${info.todayTopic}`}
          className="mb-5 flex items-center gap-3 rounded-2xl bg-primary p-4 text-white shadow-sm active:opacity-90"
        >
          <span className="text-3xl">{getTopic(info.todayTopic)?.emoji}</span>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide opacity-80">Chủ đề gợi ý hôm nay</div>
            <div className="text-lg font-bold">{getTopic(info.todayTopic)?.titleVi}</div>
          </div>
          <span className="text-2xl">▶️</span>
        </Link>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Tất cả chủ đề</h2>
      <div className="space-y-2">
        {decks.map((deck) => {
          const topic = getTopic(deck.topic);
          const stats = perDeck[deck.id];
          const pct = stats ? Math.round((stats.mastered / stats.total) * 100) : 0;
          return (
            <Link
              key={deck.id}
              href={`/vocab/study?topic=${deck.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 active:opacity-80"
            >
              <span className="text-2xl">{topic?.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{deck.titleVi}</div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted">
                    {stats?.mastered ?? 0}/{stats?.total ?? deck.cards.length} thuộc
                  </span>
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
