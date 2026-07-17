"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { allCards, getDeck, getCard } from "@/lib/content";
import type { VocabCard } from "@/lib/content-schema";
import {
  getCardStates,
  saveCardStates,
  countNewCardsToday,
  logActivity,
  type CardStates,
} from "@/lib/storage";
import { isDue, newCardState, schedule, previewInterval, type CardState, type Rating } from "@/lib/srs";
import { playVocab } from "@/lib/speech";
import { useProgress } from "@/stores/progress";

type Exercise = "recognition" | "production" | "cloze";

function exerciseFor(card: VocabCard, state: CardState | undefined): Exercise {
  if (!state || state.state !== "review") return "recognition";
  if (card.cloze && state.reps % 2 === 1) return "cloze";
  return "production";
}

const RATING_BUTTONS: { rating: Rating; label: string; cls: string }[] = [
  { rating: "again", label: "Lại", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  { rating: "hard", label: "Khó", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { rating: "good", label: "Tốt", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { rating: "easy", label: "Dễ", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
];

/** Thẻ được coi là "còn trong phiên" nếu đến hạn lại trong vòng 15 phút */
const REQUEUE_WINDOW = 15 * 60_000;

function ReviewSession() {
  const deckId = useSearchParams().get("deck");
  const { newPerDay, reviewsPerDay, markDone } = useProgress();

  const newIds = useRef<Set<string>>(new Set());
  const [cardStates, setCardStates] = useState<CardStates | null>(null);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [revealedAt, setRevealedAt] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [counts, setCounts] = useState({ reviewed: 0, learned: 0 });
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    (async () => {
      const states = await getCardStates();
      const newDoneToday = await countNewCardsToday();
      const now = Date.now();
      const pool = deckId ? (getDeck(deckId)?.cards ?? []) : allCards;

      const due = pool
        .filter((c) => states[c.id] && isDue(states[c.id], now))
        .sort((a, b) => states[a.id].due - states[b.id].due)
        .slice(0, reviewsPerDay)
        .map((c) => c.id);

      const newAllowance = Math.max(0, newPerDay - newDoneToday);
      const fresh = pool.filter((c) => !states[c.id]).slice(0, newAllowance).map((c) => c.id);
      newIds.current = new Set(fresh);

      setCardStates(states);
      setQueue([...due, ...fresh]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  const currentId = queue?.[0];
  const card = currentId ? getCard(currentId) : undefined;
  const state = currentId && cardStates ? cardStates[currentId] : undefined;
  const exercise = card ? exerciseFor(card, state) : "recognition";

  const reveal = useCallback(() => {
    setRevealed(true);
    setRevealedAt(Date.now());
    if (card) void playVocab(card.audio, card.chunk);
  }, [card]);

  const finish = useCallback(
    async (finalCounts: { reviewed: number; learned: number }) => {
      setFinished(true);
      if (finalCounts.reviewed > 0) {
        await logActivity({ type: "review", count: finalCounts.reviewed });
        markDone("review");
      }
      if (finalCounts.learned > 0) {
        await logActivity({ type: "newCards", count: finalCounts.learned });
        markDone("newCards");
      }
    },
    [markDone]
  );

  const rate = useCallback(
    async (rating: Rating) => {
      if (!currentId || !queue || !cardStates) return;
      const now = Date.now();
      const prev = cardStates[currentId] ?? newCardState(now);
      const next = schedule(prev, rating, now);
      const nextStates = { ...cardStates, [currentId]: next };
      setCardStates(nextStates);
      await saveCardStates(nextStates);

      const isNew = newIds.current.has(currentId);
      if (isNew) newIds.current.delete(currentId);
      const nextCounts = {
        reviewed: counts.reviewed + (isNew ? 0 : 1),
        learned: counts.learned + (isNew ? 1 : 0),
      };
      setCounts(nextCounts);
      setDoneCount((d) => d + 1);
      setRevealed(false);

      const rest = queue.slice(1);
      // Thẻ chưa thuộc (đến hạn lại trong phiên) quay về cuối hàng đợi
      if (next.due <= now + REQUEUE_WINDOW) rest.push(currentId);
      setQueue(rest);
      if (rest.length === 0) await finish(nextCounts);
    },
    [currentId, queue, cardStates, counts, finish]
  );

  if (queue === null || cardStates === null) {
    return <main className="flex h-[70vh] items-center justify-center text-muted">Đang tải...</main>;
  }

  if (finished || queue.length === 0) {
    const nothingToDo = doneCount === 0;
    return (
      <main className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <span className="text-5xl">{nothingToDo ? "😊" : "🎉"}</span>
        <h1 className="text-xl font-bold">{nothingToDo ? "Không có thẻ nào đến hạn" : "Hoàn thành!"}</h1>
        {!nothingToDo && (
          <p className="text-muted">
            Đã ôn {counts.reviewed} thẻ · học mới {counts.learned} thẻ
          </p>
        )}
        {nothingToDo && <p className="text-sm text-muted">Quay lại sau nhé — thẻ sẽ đến hạn theo lịch ôn tập.</p>}
        <Link href="/" className="mt-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-white">
          Về trang Hôm nay
        </Link>
      </main>
    );
  }

  if (!card) return null;
  const total = doneCount + queue.length;
  const isNewCard = !state;

  return (
    <main className="flex min-h-[80vh] flex-col">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/vocab" className="text-sm text-muted">✕</Link>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted">{doneCount}/{total}</span>
      </div>

      <div className="flex flex-1 flex-col rounded-2xl border border-border bg-card p-5">
        {isNewCard && (
          <span className="mb-2 self-start rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
            Thẻ mới
          </span>
        )}

        {/* Mặt trước */}
        {exercise === "recognition" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-muted">Cụm này nghĩa là gì?</p>
            <p className="text-2xl font-bold leading-snug">{card.chunk}</p>
            <button
              type="button"
              onClick={() => void playVocab(card.audio, card.chunk)}
              className="rounded-full bg-primary-soft px-4 py-2 text-sm font-medium text-primary"
            >
              🔈 Nghe
            </button>
          </div>
        )}
        {exercise === "production" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-muted">Nói câu tiếng Anh cho tình huống này:</p>
            <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">{card.cue}</p>
            <p className="text-xl font-bold">{card.meaningVi}</p>
          </div>
        )}
        {exercise === "cloze" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-muted">Điền vào chỗ trống:</p>
            <p className="text-2xl font-bold leading-snug">{card.cloze}</p>
            <p className="text-base text-muted">{card.meaningVi}</p>
          </div>
        )}

        {/* Mặt sau */}
        {revealed && (
          <div className="mt-4 border-t border-border pt-4 text-center">
            <p className="text-xl font-bold text-primary">{card.chunk}</p>
            <p className="mt-1 text-base">{card.meaningVi}</p>
            <div className="mt-3 rounded-xl bg-background p-3 text-left text-sm">
              <p className="font-medium">{card.example}</p>
              <p className="mt-0.5 text-muted">{card.exampleVi}</p>
            </div>
          </div>
        )}
      </div>

      {/* Nút hành động */}
      <div className="mt-4 pb-2">
        {!revealed ? (
          <button
            type="button"
            onClick={reveal}
            className="w-full rounded-2xl bg-primary py-3.5 text-base font-bold text-white active:opacity-90"
          >
            Hiện đáp án
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {RATING_BUTTONS.map(({ rating, label, cls }) => (
              <button
                key={rating}
                type="button"
                onClick={() => void rate(rating)}
                className={`rounded-2xl py-2.5 text-center active:opacity-80 ${cls}`}
              >
                <div className="text-sm font-bold">{label}</div>
                <div className="text-[10px] opacity-80">
                  {previewInterval(state ?? newCardState(revealedAt), rating, revealedAt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<main className="flex h-[70vh] items-center justify-center text-muted">Đang tải...</main>}>
      <ReviewSession />
    </Suspense>
  );
}
