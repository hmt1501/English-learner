"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { allCards, dialogues, scenarios, getDialogue, getScenario } from "@/lib/content";
import { getCardStates, countNewCardsToday, getLastDoneMap } from "@/lib/storage";
import { isDue } from "@/lib/srs";
import { composeSession, MODE_LABELS, type PlanItem, type SessionMode } from "@/lib/session";
import { useProgress } from "@/stores/progress";
import { useMounted } from "@/lib/useMounted";

function planKey(item: PlanItem): string {
  switch (item.type) {
    case "review":
      return "review";
    case "newCards":
      return "newCards";
    default:
      return `${item.type}:${item.id}`;
  }
}

function planMeta(item: PlanItem): { icon: string; title: string; desc: string; href: string; minutes: string } {
  switch (item.type) {
    case "review":
      return {
        icon: "🃏",
        title: "Ôn từ vựng",
        desc: `${item.dueCount} thẻ đến hạn`,
        href: "/vocab/review",
        minutes: "~10 phút",
      };
    case "newCards":
      return {
        icon: "✨",
        title: "Học cụm từ mới",
        desc: `${item.count} thẻ mới`,
        href: "/vocab/review",
        minutes: "~5 phút",
      };
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
  const { name, mode, streak, newPerDay, doneToday, setMode, rollDay, recordStreak, lastStreakDate, today } =
    useProgress();

  useEffect(() => {
    rollDay();
  }, [rollDay]);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const states = await getCardStates();
      const now = Date.now();
      const dueCount = allCards.filter((c) => states[c.id] && isDue(states[c.id], now)).length;
      const newDoneToday = await countNewCardsToday();
      const newAvailable = Math.max(0, newPerDay - newDoneToday);
      const lastDone = await getLastDoneMap(["listening", "shadowing", "chat"]);
      setPlan(
        composeSession({
          mode,
          dueCount,
          newAvailable,
          dialogueIds: dialogues.map((d) => d.id),
          scenarioIds: scenarios.map((s) => s.id),
          lastDone,
          dayIndex: Math.floor(now / 86_400_000),
        })
      );
    })();
  }, [mounted, mode, newPerDay, doneToday]);

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
      ) : plan.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <span className="text-4xl">🌱</span>
          <p className="mt-2 font-semibold">Bắt đầu từ bộ thẻ từ vựng nhé!</p>
          <Link href="/vocab" className="mt-3 inline-block rounded-full bg-primary px-6 py-2.5 font-semibold text-white">
            Học thẻ đầu tiên
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {plan.map((item) => {
            const meta = planMeta(item);
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
