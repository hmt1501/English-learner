"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { decks, dialogues, scenarios, getDialogue, getScenario, getTopic } from "@/lib/content";
import { getWordStats, getLastDoneMap, isMastered } from "@/lib/storage";
import { composeSession, MODE_LABELS, type PlanItem, type SessionMode } from "@/lib/session";
import { useProgress } from "@/stores/progress";
import { useMounted } from "@/lib/useMounted";

type PlanMeta = { icon: string; title: string; desc: string; href: string; minutes: string };

function planKey(item: PlanItem): string {
  return item.type === "vocab" ? `vocab:${item.topicId}` : `${item.type}:${item.id}`;
}

function planMeta(item: PlanItem, remainingWords: Record<string, number>): PlanMeta {
  switch (item.type) {
    case "vocab": {
      const t = getTopic(item.topicId);
      const left = remainingWords[item.topicId] ?? 0;
      return {
        icon: t?.emoji ?? "🃏",
        title: "Học từ vựng",
        desc: `${t?.titleVi ?? ""}${left > 0 ? ` · còn ${left} từ chưa thuộc` : " · ôn lại"}`,
        href: `/vocab/study?topic=${item.topicId}`,
        minutes: "~15 phút",
      };
    }
    case "listening": {
      const d = getDialogue(item.id);
      return { icon: "🎧", title: "Nghe hội thoại", desc: d?.titleVi ?? "", href: `/listening/${item.id}`, minutes: "~10 phút" };
    }
    case "shadowing": {
      const d = getDialogue(item.id);
      return { icon: "🎤", title: "Nói theo", desc: d?.titleVi ?? "", href: `/speaking/${item.id}`, minutes: "~10 phút" };
    }
    case "chat": {
      const s = getScenario(item.id);
      return { icon: "💬", title: "Trả lời tin nhắn", desc: s?.titleVi ?? "", href: `/chat/${item.id}`, minutes: "~10 phút" };
    }
  }
}

export default function HomePage() {
  const mounted = useMounted();
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [remainingWords, setRemainingWords] = useState<Record<string, number>>({});
  const { name, mode, streak, doneToday, setMode, rollDay, recordStreak, lastStreakDate, today } = useProgress();

  useEffect(() => {
    rollDay();
  }, [rollDay]);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const stats = await getWordStats();
      const topicLastStudied = await getLastDoneMap(["vocab"]);
      const lastDone = await getLastDoneMap(["listening", "shadowing", "chat"]);
      const remaining: Record<string, number> = {};
      for (const deck of decks) {
        remaining[deck.id] = deck.cards.filter((c) => !isMastered(stats[c.id])).length;
      }
      setRemainingWords(remaining);
      setPlan(
        composeSession({
          mode,
          topicIds: decks.map((d) => d.topic),
          topicLastStudied,
          dialogueIds: dialogues.map((d) => d.id),
          scenarioIds: scenarios.map((s) => s.id),
          lastDone,
          dayIndex: Math.floor(Date.now() / 86_400_000),
        })
      );
    })();
  }, [mounted, mode, doneToday]);

  const allDone = useMemo(
    () => plan !== null && plan.length > 0 && plan.every((item) => doneToday.includes(planKey(item))),
    [plan, doneToday]
  );

  useEffect(() => {
    if (allDone) recordStreak();
  }, [allDone, recordStreak]);

  const streakDoneToday = lastStreakDate === today;

  return (
    <main>
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{mounted && name ? `Chào ${name}! 👋` : "Chào bạn! 👋"}</p>
          <h1 className="text-2xl font-bold">Hôm nay học gì?</h1>
        </div>
        <div
          className={`flex flex-col items-center rounded-2xl px-3 py-1.5 ${
            streakDoneToday ? "bg-accent-soft" : "bg-primary-soft"
          }`}
        >
          <span className="text-xl">🔥</span>
          <span className={`text-sm font-bold ${streakDoneToday ? "text-accent" : "text-primary"}`}>
            {mounted ? streak : 0} ngày
          </span>
        </div>
      </header>

      {/* Chọn quỹ thời gian */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(Object.keys(MODE_LABELS) as SessionMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-xl border py-2 text-center text-sm active:opacity-80 ${
              mounted && mode === m
                ? "border-primary bg-primary-soft font-bold text-primary"
                : "border-border bg-card text-muted"
            }`}
          >
            <div>{MODE_LABELS[m].label}</div>
            <div className="text-[10px]">{MODE_LABELS[m].minutes}</div>
          </button>
        ))}
      </div>

      {/* Phiên học hôm nay */}
      {plan === null ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted">Đang tải...</div>
      ) : (
        <div className="space-y-2.5">
          {plan.map((item) => {
            const meta = planMeta(item, remainingWords);
            const done = doneToday.includes(planKey(item));
            return (
              <Link
                key={planKey(item)}
                href={meta.href}
                className={`flex items-center gap-3 rounded-2xl border p-4 active:opacity-80 ${
                  done ? "border-accent bg-accent-soft opacity-70" : "border-border bg-card"
                }`}
              >
                <span className="text-2xl">{done ? "✅" : meta.icon}</span>
                <div className="flex-1">
                  <div className={`font-semibold ${done ? "line-through" : ""}`}>{meta.title}</div>
                  <div className="text-xs text-muted">{meta.desc}</div>
                </div>
                <span className="text-xs text-muted">{meta.minutes}</span>
              </Link>
            );
          })}
        </div>
      )}

      {allDone && (
        <div className="mt-5 rounded-2xl bg-accent-soft p-5 text-center">
          <span className="text-4xl">🎉</span>
          <p className="mt-1 font-bold text-accent">Tuyệt vời! Bạn đã hoàn thành phiên học hôm nay.</p>
          <p className="mt-0.5 text-sm text-accent">Chuỗi {streak} ngày — hẹn gặp lại ngày mai! 🔥</p>
        </div>
      )}
    </main>
  );
}
