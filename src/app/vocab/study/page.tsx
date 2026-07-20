"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getDeck, getTopic } from "@/lib/content";
import type { VocabCard } from "@/lib/content-schema";
import {
  getWordStats,
  saveWordStats,
  applyResult,
  isMastered,
  logActivity,
  type WordStats,
} from "@/lib/storage";
import { checkMeaning, checkTranslation, VERDICT_LABEL, type Verdict } from "@/lib/check";
import { playVocab } from "@/lib/speech";
import { useProgress } from "@/stores/progress";

const TRANSLATE_COUNT = 5;

type Phase = "learn" | "translate" | "done";

function verdictClass(v: Verdict): string {
  return v === "correct"
    ? "bg-accent-soft text-accent"
    : v === "close"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}

function VocabHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="mb-3 rounded-2xl bg-primary-soft p-4 text-sm text-primary">
      <p className="font-bold">💡 Cách học</p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li>Nhìn cụm từ tiếng Anh → <b>tự gõ nghĩa tiếng Việt</b> ra.</li>
        <li>Hệ thống chấm và <b>hiện đáp án + câu ví dụ có dịch</b> để bạn hiểu rõ.</li>
        <li>Cuối buổi: hệ thống đưa <b>câu tiếng Việt</b>, bạn <b>dịch sang tiếng Anh</b>.</li>
      </ol>
      <p className="mt-1.5">Chấm khá thoáng (không cần đúng từng chữ) — cứ mạnh dạn gõ, sai cũng học được!</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-2.5 w-full rounded-xl bg-primary py-2 text-sm font-bold text-white active:opacity-90"
      >
        Bắt đầu học
      </button>
    </div>
  );
}

function StudySession() {
  const topicId = useSearchParams().get("topic") ?? "";
  const deck = getDeck(topicId);
  const topic = getTopic(topicId);
  const { wordsPerSession, markDone, seenVocabHelp, setSeenVocabHelp } = useProgress();

  const statsRef = useRef<WordStats>({});
  const [ready, setReady] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [phase, setPhase] = useState<Phase>("learn");
  const [learnQueue, setLearnQueue] = useState<string[]>([]);
  const learnVerdicts = useRef<Record<string, Verdict>>({});
  const [translateWords, setTranslateWords] = useState<string[]>([]);
  const [tIndex, setTIndex] = useState(0);

  // Ô nhập + kết quả cho câu hiện tại
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Verdict | null>(null);

  const [meaningCorrect, setMeaningCorrect] = useState(0);
  const [meaningTotal, setMeaningTotal] = useState(0);
  const [transCorrect, setTransCorrect] = useState(0);
  const doneLogged = useRef(false);

  useEffect(() => {
    (async () => {
      const stats = await getWordStats();
      statsRef.current = stats;
      const cards = deck?.cards ?? [];
      // Ưu tiên từ chưa thuộc, cũ nhất trước
      const sorted = [...cards].sort((a, b) => {
        const ma = isMastered(stats[a.id]) ? 1 : 0;
        const mb = isMastered(stats[b.id]) ? 1 : 0;
        if (ma !== mb) return ma - mb;
        return (stats[a.id]?.lastSeen ?? 0) - (stats[b.id]?.lastSeen ?? 0);
      });
      setLearnQueue(sorted.slice(0, wordsPerSession).map((c) => c.id));
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const currentCard: VocabCard | undefined = useMemo(() => {
    if (!deck) return undefined;
    const id = phase === "learn" ? learnQueue[0] : translateWords[tIndex];
    return deck.cards.find((c) => c.id === id);
  }, [deck, phase, learnQueue, translateWords, tIndex]);

  const submit = useCallback(() => {
    if (!currentCard || result !== null) return;
    const v =
      phase === "learn"
        ? checkMeaning(answer, currentCard.meaningVi)
        : checkTranslation(answer, currentCard.example);
    setResult(v);
    if (phase === "learn") {
      void playVocab(currentCard.audio, currentCard.chunk);
      learnVerdicts.current[currentCard.id] = v;
      statsRef.current[currentCard.id] = applyResult(statsRef.current[currentCard.id], v !== "wrong", Date.now());
      setMeaningTotal((n) => n + 1);
      if (v !== "wrong") setMeaningCorrect((n) => n + 1);
    } else if (v !== "wrong") {
      setTransCorrect((n) => n + 1);
    }
  }, [currentCard, result, phase, answer]);

  /** Ghi đè kết quả tự chấm (khi hệ thống chấm chưa chuẩn) */
  const override = useCallback(
    (correct: boolean) => {
      if (!currentCard || result === null) return;
      const wasCorrect = result !== "wrong";
      if (wasCorrect === correct) return;
      setResult(correct ? "correct" : "wrong");
      if (phase === "learn") {
        statsRef.current[currentCard.id] = applyResult(
          // gỡ kết quả cũ rồi áp lại
          {
            correct: (statsRef.current[currentCard.id]?.correct ?? 0) - (wasCorrect ? 1 : 0),
            wrong: (statsRef.current[currentCard.id]?.wrong ?? 0) - (wasCorrect ? 0 : 1),
            lastSeen: 0,
          },
          correct,
          Date.now()
        );
        learnVerdicts.current[currentCard.id] = correct ? "correct" : "wrong";
        setMeaningCorrect((n) => n + (correct ? 1 : -1));
      } else {
        setTransCorrect((n) => n + (correct ? 1 : -1));
      }
    },
    [currentCard, result, phase]
  );

  const beginTranslate = useCallback(() => {
    // Ưu tiên dịch lại các câu chứa từ vừa trả lời sai/gần đúng
    const studied = Object.keys(learnVerdicts.current);
    const rank = (id: string) => {
      const v = learnVerdicts.current[id];
      return v === "wrong" ? 0 : v === "close" ? 1 : 2;
    };
    const chosen = [...studied].sort((a, b) => rank(a) - rank(b)).slice(0, TRANSLATE_COUNT);
    setTranslateWords(chosen);
    setTIndex(0);
    setAnswer("");
    setResult(null);
    setPhase(chosen.length ? "translate" : "done");
  }, []);

  const finish = useCallback(async () => {
    setPhase("done");
    await saveWordStats(statsRef.current);
    if (!doneLogged.current) {
      doneLogged.current = true;
      await logActivity({ type: "vocab", refId: topicId, count: meaningCorrect });
      markDone(`vocab:${topicId}`);
    }
  }, [topicId, meaningCorrect, markDone]);

  const nextLearn = useCallback(() => {
    const rest = learnQueue.slice(1);
    setAnswer("");
    setResult(null);
    if (rest.length === 0) {
      beginTranslate();
    } else {
      setLearnQueue(rest);
    }
  }, [learnQueue, beginTranslate]);

  const nextTranslate = useCallback(() => {
    setAnswer("");
    setResult(null);
    if (tIndex + 1 >= translateWords.length) {
      void finish();
    } else {
      setTIndex((i) => i + 1);
    }
  }, [tIndex, translateWords.length, finish]);

  if (!deck) {
    return (
      <main className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted">Không tìm thấy chủ đề.</p>
        <Link href="/vocab" className="rounded-full bg-primary px-6 py-2.5 font-semibold text-white">
          Về danh sách chủ đề
        </Link>
      </main>
    );
  }

  if (!ready) return <main className="flex h-[70vh] items-center justify-center text-muted">Đang tải...</main>;

  if (phase === "done") {
    return (
      <main className="flex h-[75vh] flex-col items-center justify-center gap-3 text-center">
        <span className="text-5xl">🎉</span>
        <h1 className="text-xl font-bold">Xong buổi học {topic?.titleVi}!</h1>
        <div className="rounded-2xl bg-accent-soft px-5 py-3 text-accent">
          <p className="font-semibold">Nghĩa từ: {meaningCorrect}/{meaningTotal} đúng</p>
          {translateWords.length > 0 && (
            <p className="font-semibold">Dịch câu: {transCorrect}/{translateWords.length} đúng</p>
          )}
        </div>
        <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
          <Link href="/vocab" className="w-full rounded-full border-2 border-primary py-2.5 font-semibold text-primary active:opacity-80">
            Chọn chủ đề khác
          </Link>
          <Link href="/" className="w-full rounded-full bg-primary px-6 py-2.5 font-semibold text-white active:opacity-90">
            Về trang Hôm nay
          </Link>
        </div>
      </main>
    );
  }

  if (!currentCard) return null;

  const total = phase === "learn" ? meaningTotal + learnQueue.length : translateWords.length;
  const doneN = phase === "learn" ? meaningTotal : tIndex;
  const revealed = result !== null;

  return (
    <main className="flex min-h-[80vh] flex-col">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/vocab" className="text-sm text-muted">✕</Link>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs font-semibold text-muted">
            <span>{phase === "learn" ? "① Học nghĩa từ" : "② Dịch câu Việt → Anh"}</span>
            <span>{doneN}/{total}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneN / Math.max(total, 1)) * 100}%` }} />
          </div>
        </div>
        <button type="button" onClick={() => setShowHelp((v) => !v)} aria-label="Hướng dẫn">ℹ️</button>
      </div>

      {(!seenVocabHelp || showHelp) && (
        <VocabHelp
          onClose={() => {
            setSeenVocabHelp(true);
            setShowHelp(false);
          }}
        />
      )}

      <div className="flex flex-1 flex-col rounded-2xl border border-border bg-card p-5">
        {phase === "learn" ? (
          <>
            <p className="text-sm text-muted">Cụm từ này nghĩa là gì? Gõ nghĩa tiếng Việt:</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <p className="text-2xl font-bold leading-snug">{currentCard.chunk}</p>
              <button
                type="button"
                onClick={() => void playVocab(currentCard.audio, currentCard.chunk)}
                className="shrink-0 rounded-full bg-primary-soft px-3 py-1.5 text-sm text-primary"
                aria-label="Nghe"
              >
                🔈
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Dịch câu tiếng Việt này sang tiếng Anh:</p>
            <p className="mt-3 rounded-xl bg-primary-soft px-4 py-3 text-center text-lg font-bold text-primary">
              {currentCard.exampleVi}
            </p>
          </>
        )}

        {!revealed ? (
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            autoFocus
            placeholder={phase === "learn" ? "Gõ nghĩa tiếng Việt..." : "Gõ câu tiếng Anh..."}
            className="mt-4 w-full rounded-xl border border-border bg-background p-3 text-base outline-none focus:border-primary"
          />
        ) : (
          <div className="mt-4">
            <div className={`rounded-xl px-3 py-2 text-center text-sm font-bold ${verdictClass(result)}`}>
              {VERDICT_LABEL[result].emoji} {VERDICT_LABEL[result].text}
            </div>
            {answer.trim() && (
              <p className="mt-2 text-sm text-muted">
                Bạn viết: <span className="italic">&ldquo;{answer.trim()}&rdquo;</span>
              </p>
            )}
            <div className="mt-2 rounded-xl bg-background p-3">
              {phase === "learn" ? (
                <>
                  <p className="text-lg font-bold text-primary">{currentCard.chunk}</p>
                  <p className="text-base font-semibold">{currentCard.meaningVi}</p>
                  <div className="mt-2 border-t border-border pt-2 text-sm">
                    <p className="font-medium">📝 {currentCard.example}</p>
                    <p className="mt-0.5 text-muted">{currentCard.exampleVi}</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs uppercase text-muted">Câu đúng:</p>
                  <p className="text-base font-bold text-primary">{currentCard.example}</p>
                  <p className="mt-0.5 text-sm text-muted">{currentCard.exampleVi}</p>
                </>
              )}
            </div>
            {/* Tự chấm lại nếu hệ thống chấm chưa chuẩn */}
            <div className="mt-2 flex items-center justify-center gap-2 text-xs">
              <span className="text-muted">Hệ thống chấm chưa đúng?</span>
              {result === "wrong" ? (
                <button
                  type="button"
                  onClick={() => override(true)}
                  className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent"
                >
                  Tôi trả lời đúng
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => override(false)}
                  className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                  Thật ra tôi sai
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pb-2">
        {!revealed ? (
          <button
            type="button"
            disabled={!answer.trim()}
            onClick={submit}
            className="w-full rounded-2xl bg-primary py-3.5 text-base font-bold text-white disabled:opacity-40 active:opacity-90"
          >
            Kiểm tra
          </button>
        ) : (
          <button
            type="button"
            onClick={phase === "learn" ? nextLearn : nextTranslate}
            className="w-full rounded-2xl bg-accent py-3.5 text-base font-bold text-white active:opacity-90"
          >
            {phase === "learn"
              ? learnQueue.length > 1
                ? "Từ tiếp theo →"
                : "Sang phần dịch câu →"
              : tIndex + 1 >= translateWords.length
                ? "✓ Hoàn thành"
                : "Câu tiếp theo →"}
          </button>
        )}
      </div>
    </main>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<main className="flex h-[70vh] items-center justify-center text-muted">Đang tải...</main>}>
      <StudySession />
    </Suspense>
  );
}
