"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { decks, getTopic } from "@/lib/content";
import { getWordStats, getLastDoneMap, type WordStats } from "@/lib/storage";
import { pickTodayTopic } from "@/lib/session";
import { MODE_INFO, VOCAB_MODES, statKey, type VocabMode } from "@/lib/vocab-modes";
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
      const dayIndex = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);
      const todayTopic = pickTodayTopic(decks.map((d) => d.topic), lastStudied, dayIndex);
      setInfo({ stats, todayTopic });
    })();
  }, []);

  // Số từ đã trả lời đúng (≥1 lần) theo từng chế độ học của mỗi chủ đề
  const perDeck = useMemo(() => {
    const map: Record<string, Record<VocabMode, number>> = {};
    for (const deck of decks) {
      const counts: Record<VocabMode, number> = { word: 0, en2vi: 0, vi2en: 0 };
      for (const c of deck.cards) {
        for (const m of VOCAB_MODES) {
          if ((info?.stats[statKey(m, c.id)]?.correct ?? 0) > 0) counts[m]++;
        }
      }
      map[deck.id] = counts;
    }
    return map;
  }, [info]);

  return (
    <main>
      <PageHeader title="Từ vựng" subtitle="Chọn chủ đề, rồi chọn cách học: từ vựng, dịch câu Anh–Việt hoặc Việt–Anh" />

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

      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Tất cả chủ đề</h2>
      <p className="mb-2 text-xs text-muted">
        Tiến độ = số từ đã trả lời đúng theo từng cách học: {VOCAB_MODES.map((m) => `${MODE_INFO[m].emoji} ${MODE_INFO[m].title}`).join(" · ")}
      </p>
      <div className="space-y-2">
        {decks.map((deck) => {
          const topic = getTopic(deck.topic);
          const counts = perDeck[deck.id];
          const total = deck.cards.length;
          return (
            <Link
              key={deck.id}
              href={`/vocab/study?topic=${deck.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 active:opacity-80"
            >
              <span className="text-2xl">{topic?.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{deck.titleVi}</div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                  {VOCAB_MODES.map((m) => (
                    <span key={m} title={MODE_INFO[m].title} className={counts?.[m] ? "font-semibold text-accent" : ""}>
                      {MODE_INFO[m].emoji} {counts?.[m] ?? 0}/{total}
                    </span>
                  ))}
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
