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
import {
  checkMeaning,
  checkTranslation,
  checkTranslationVi,
  VERDICT_LABEL,
  type Verdict,
} from "@/lib/check";
import { playVocab, speakFallback } from "@/lib/speech";
import { useProgress } from "@/stores/progress";
import { MODE_INFO, VOCAB_MODES, parseMode, statKey, type VocabMode } from "@/lib/vocab-modes";

type Phase = "preview" | "quiz" | "done";

function verdictClass(v: Verdict): string {
  return v === "correct"
    ? "bg-accent-soft text-accent"
    : v === "close"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}

function VocabHelp({ mode, onClose }: { mode: VocabMode; onClose: () => void }) {
  return (
    <div className="mb-3 rounded-2xl bg-primary-soft p-4 text-sm text-primary">
      <p className="font-bold">💡 {MODE_INFO[mode].title}</p>
      {mode === "word" ? (
        <ol className="mt-1.5 list-decimal space-y-1 pl-5">
          <li><b>Làm quen:</b> xem từ + nghĩa + câu ví dụ có dịch để nhớ trước.</li>
          <li><b>Kiểm tra:</b> nhìn cụm từ tiếng Anh, tự gõ nghĩa tiếng Việt, hệ thống chấm.</li>
        </ol>
      ) : (
        <p className="mt-1.5">
          {mode === "en2vi"
            ? "Đọc câu tiếng Anh rồi gõ bản dịch tiếng Việt của bạn — hệ thống chấm và hiện bản dịch mẫu."
            : "Đọc câu tiếng Việt rồi gõ câu tiếng Anh của bạn — hệ thống chấm và hiện câu mẫu."}
        </p>
      )}
      <p className="mt-1.5">Chấm khá thoáng (không cần đúng từng chữ) — cứ mạnh dạn gõ, sai cũng học được! Nếu máy chấm chưa đúng, bạn luôn có nút tự chấm lại.</p>
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

/** Màn hình chọn 1 trong 3 cách học của chủ đề, kèm tiến độ từng cách */
function ModePicker({ topicId }: { topicId: string }) {
  const deck = getDeck(topicId);
  const topic = getTopic(topicId);
  const [stats, setStats] = useState<WordStats | null>(null);

  useEffect(() => {
    (async () => {
      setStats(await getWordStats());
    })();
  }, []);

  if (!deck) return null;
  const total = deck.cards.length;
  const doneCount = (m: VocabMode) =>
    deck.cards.filter((c) => (stats?.[statKey(m, c.id)]?.correct ?? 0) > 0).length;

  return (
    <main className="flex min-h-[80vh] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/vocab" className="text-sm text-muted">✕</Link>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Chủ đề</p>
          <h1 className="text-lg font-bold">{topic?.emoji} {topic?.titleVi}</h1>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted">Chọn cách học cho buổi này (x/{total} = số từ đã trả lời đúng):</p>
      <div className="space-y-2.5">
        {VOCAB_MODES.map((m) => {
          const n = stats ? doneCount(m) : 0;
          return (
            <Link
              key={m}
              href={`/vocab/study?topic=${topicId}&mode=${m}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 active:opacity-80"
            >
              <span className="text-3xl">{MODE_INFO[m].emoji}</span>
              <div className="flex-1">
                <div className="font-bold">{MODE_INFO[m].title}</div>
                <div className="text-sm text-muted">{MODE_INFO[m].desc}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(n / Math.max(total, 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-muted">{n}/{total}</span>
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

/** Đọc query param, chọn màn hình; StudySession được remount (key) khi đổi topic/mode */
function StudyRouter() {
  const params = useSearchParams();
  const topicId = params.get("topic") ?? "";
  const mode = parseMode(params.get("mode"));
  const deck = getDeck(topicId);

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

  if (!mode) return <ModePicker topicId={topicId} />;

  return <StudySession key={`${topicId}:${mode}`} topicId={topicId} mode={mode} />;
}

function StudySession({ topicId, mode }: { topicId: string; mode: VocabMode }) {
  const deck = getDeck(topicId);
  const topic = getTopic(topicId);
  const { wordsPerSession, markDone, seenVocabHelp, setSeenVocabHelp } = useProgress();

  const statsRef = useRef<WordStats>({});
  const committed = useRef(false);
  /** verdict từng thẻ trong buổi (để tính số câu đúng khi ghi công) */
  const verdictsRef = useRef<Record<string, Verdict>>({});
  const [ready, setReady] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [phase, setPhase] = useState<Phase>(mode === "word" ? "preview" : "quiz");
  const [words, setWords] = useState<string[]>([]);

  // Bước làm quen (chỉ chế độ "word")
  const [pIndex, setPIndex] = useState(0);
  const [pRevealed, setPRevealed] = useState(false);

  // Phần kiểm tra (chung cho cả 3 chế độ)
  const [qIndex, setQIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Verdict | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    (async () => {
      const stats = await getWordStats();
      statsRef.current = stats;
      const cards = deck?.cards ?? [];
      // Ưu tiên từ chưa thuộc (trong chế độ này), cũ nhất trước
      const sorted = [...cards].sort((a, b) => {
        const sa = stats[statKey(mode, a.id)];
        const sb = stats[statKey(mode, b.id)];
        const ma = isMastered(sa) ? 1 : 0;
        const mb = isMastered(sb) ? 1 : 0;
        if (ma !== mb) return ma - mb;
        return (sa?.lastSeen ?? 0) - (sb?.lastSeen ?? 0);
      });
      setWords(sorted.slice(0, wordsPerSession).map((c) => c.id));
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardById = useCallback(
    (id: string | undefined): VocabCard | undefined => (id ? deck?.cards.find((c) => c.id === id) : undefined),
    [deck]
  );

  const previewCard = useMemo(() => cardById(words[pIndex]), [cardById, words, pIndex]);
  const currentCard = useMemo(() => cardById(words[qIndex]), [cardById, words, qIndex]);

  /** Lưu ngay tiến độ từ vựng để không mất khi thoát giữa chừng */
  const persistStats = useCallback(async () => {
    await saveWordStats(statsRef.current);
  }, []);

  /** Ghi nhận buổi học vào lịch sử + đánh dấu xong ở tab Hôm nay (chạy 1 lần) */
  const commitDaily = useCallback(async () => {
    await persistStats();
    if (committed.current) return;
    committed.current = true;
    const correct = Object.values(verdictsRef.current).filter((v) => v !== "wrong").length;
    await logActivity({ type: "vocab", refId: topicId, count: correct });
    markDone(`vocab:${topicId}`);
  }, [persistStats, topicId, markDone]);

  // ----- Làm quen (chỉ chế độ "word") -----
  const revealPreview = useCallback(() => {
    setPRevealed(true);
    if (previewCard) void playVocab(previewCard.audio, previewCard.chunk);
  }, [previewCard]);

  const nextPreview = useCallback(() => {
    if (pIndex + 1 >= words.length) {
      setPhase("quiz");
    } else {
      setPIndex((i) => i + 1);
      setPRevealed(false);
    }
  }, [pIndex, words.length]);

  // ----- Kiểm tra: gõ đáp án → chấm -----
  const submit = useCallback(() => {
    if (!mode || !currentCard || result !== null) return;
    const v =
      mode === "word"
        ? checkMeaning(answer, currentCard.meaningVi)
        : mode === "en2vi"
          ? checkTranslationVi(answer, currentCard.exampleVi)
          : checkTranslation(answer, currentCard.example);
    setResult(v);
    if (mode === "word") void playVocab(currentCard.audio, currentCard.chunk);
    else if (mode === "vi2en") void speakFallback(currentCard.example);
    verdictsRef.current[currentCard.id] = v;
    const key = statKey(mode, currentCard.id);
    statsRef.current[key] = applyResult(statsRef.current[key], v !== "wrong", Date.now());
    void persistStats(); // lưu ngay sau mỗi câu
    setDoneCount((n) => n + 1);
    if (v !== "wrong") setCorrectCount((n) => n + 1);
  }, [mode, currentCard, result, answer, persistStats]);

  /** Người học tự chấm lại khi máy chấm chưa đúng */
  const override = useCallback(
    (correct: boolean) => {
      if (!currentCard || result === null) return;
      const wasCorrect = result !== "wrong";
      if (wasCorrect === correct) return;
      setResult(correct ? "correct" : "wrong");
      verdictsRef.current[currentCard.id] = correct ? "correct" : "wrong";
      const key = statKey(mode, currentCard.id);
      statsRef.current[key] = applyResult(
        {
          correct: (statsRef.current[key]?.correct ?? 0) - (wasCorrect ? 1 : 0),
          wrong: (statsRef.current[key]?.wrong ?? 0) - (wasCorrect ? 0 : 1),
          lastSeen: 0,
        },
        correct,
        Date.now()
      );
      void persistStats();
      setCorrectCount((n) => n + (correct ? 1 : -1));
    },
    [currentCard, result, mode, persistStats]
  );

  const nextQuiz = useCallback(() => {
    setAnswer("");
    setResult(null);
    if (qIndex + 1 >= words.length) {
      void commitDaily();
      setPhase("done");
    } else {
      setQIndex((i) => i + 1);
    }
  }, [qIndex, words.length, commitDaily]);

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

  if (words.length === 0) {
    return (
      <main className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <span className="text-4xl">📭</span>
        <p className="text-muted">Chủ đề này chưa có từ để học.</p>
        <Link href="/vocab" className="rounded-full bg-primary px-6 py-2.5 font-semibold text-white">
          Chọn chủ đề khác
        </Link>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="flex h-[75vh] flex-col items-center justify-center gap-3 text-center">
        <span className="text-5xl">🎉</span>
        <h1 className="text-xl font-bold">Xong buổi học {topic?.titleVi}!</h1>
        <div className="rounded-2xl bg-accent-soft px-5 py-3 text-accent">
          <p className="font-semibold">
            {MODE_INFO[mode].title}: {correctCount}/{words.length} đúng
          </p>
        </div>
        <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
          <Link
            href={`/vocab/study?topic=${topicId}`}
            className="w-full rounded-full border-2 border-primary py-2.5 font-semibold text-primary active:opacity-80"
          >
            Học kiểu khác cùng chủ đề
          </Link>
          <Link href="/vocab" className="w-full rounded-full border-2 border-border py-2.5 font-semibold text-muted active:opacity-80">
            Chọn chủ đề khác
          </Link>
          <Link href="/" className="w-full rounded-full bg-primary px-6 py-2.5 font-semibold text-white active:opacity-90">
            Về trang Hôm nay
          </Link>
        </div>
      </main>
    );
  }

  // ---- Làm quen từ (chế độ "word") ----
  if (phase === "preview") {
    if (!previewCard) return null;
    const isLast = pIndex + 1 >= words.length;
    return (
      <main className="flex min-h-[80vh] flex-col">
        <StudyTopBar
          label={`${MODE_INFO.word.emoji} Làm quen từ`}
          done={pIndex}
          total={words.length}
          onHelp={() => setShowHelp((v) => !v)}
        />
        {(!seenVocabHelp || showHelp) && (
          <VocabHelp
            mode={mode}
            onClose={() => {
              setSeenVocabHelp(true);
              setShowHelp(false);
            }}
          />
        )}
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted">Từ mới — đọc và ghi nhớ:</p>
          <div className="mt-3 flex items-center gap-2">
            <p className="text-2xl font-bold leading-snug">{previewCard.chunk}</p>
            <button
              type="button"
              onClick={() => void playVocab(previewCard.audio, previewCard.chunk)}
              className="shrink-0 rounded-full bg-primary-soft px-3 py-1.5 text-sm text-primary"
              aria-label="Nghe"
            >
              🔈
            </button>
          </div>
          {pRevealed ? (
            <div className="mt-4 w-full">
              <p className="text-xl font-semibold">{previewCard.meaningVi}</p>
              <div className="mt-3 rounded-xl bg-background p-3 text-left text-sm">
                <p className="font-medium">📝 {previewCard.example}</p>
                <p className="mt-0.5 text-muted">{previewCard.exampleVi}</p>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">Thử đoán nghĩa trong đầu, rồi bấm nút bên dưới để xem.</p>
          )}
        </div>
        <div className="mt-4 pb-2">
          {!pRevealed ? (
            <button
              type="button"
              onClick={revealPreview}
              className="w-full rounded-2xl bg-primary py-3.5 text-base font-bold text-white active:opacity-90"
            >
              Xem nghĩa & ví dụ
            </button>
          ) : (
            <button
              type="button"
              onClick={nextPreview}
              className="w-full rounded-2xl bg-accent py-3.5 text-base font-bold text-white active:opacity-90"
            >
              {isLast ? "Bắt đầu kiểm tra nghĩa →" : "Từ tiếp theo →"}
            </button>
          )}
        </div>
      </main>
    );
  }

  // ---- Kiểm tra: gõ đáp án + chấm (chung cho 3 chế độ) ----
  if (!currentCard) return null;
  const revealed = result !== null;
  const isLastQuiz = qIndex + 1 >= words.length;

  return (
    <main className="flex min-h-[80vh] flex-col">
      <StudyTopBar
        label={`${MODE_INFO[mode].emoji} ${MODE_INFO[mode].title}`}
        done={doneCount}
        total={words.length}
        onHelp={() => setShowHelp((v) => !v)}
      />
      {(!seenVocabHelp || showHelp) && (
        <VocabHelp
          mode={mode}
          onClose={() => {
            setSeenVocabHelp(true);
            setShowHelp(false);
          }}
        />
      )}

      <div className="flex flex-1 flex-col rounded-2xl border border-border bg-card p-5">
        {mode === "word" && (
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
        )}
        {mode === "en2vi" && (
          <>
            <p className="text-sm text-muted">Dịch câu tiếng Anh này sang tiếng Việt:</p>
            <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary-soft px-4 py-3">
              <p className="text-center text-lg font-bold text-primary">{currentCard.example}</p>
              <button
                type="button"
                onClick={() => void speakFallback(currentCard.example)}
                className="shrink-0 rounded-full bg-card px-3 py-1.5 text-sm text-primary"
                aria-label="Nghe"
              >
                🔈
              </button>
            </div>
          </>
        )}
        {mode === "vi2en" && (
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
            placeholder={
              mode === "word"
                ? "Gõ nghĩa tiếng Việt..."
                : mode === "en2vi"
                  ? "Gõ bản dịch tiếng Việt..."
                  : "Gõ câu tiếng Anh..."
            }
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
              {mode === "word" ? (
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
                  <p className="text-xs uppercase text-muted">{mode === "en2vi" ? "Bản dịch mẫu:" : "Câu đúng:"}</p>
                  <p className="text-base font-bold text-primary">
                    {mode === "en2vi" ? currentCard.exampleVi : currentCard.example}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {mode === "en2vi" ? currentCard.example : currentCard.exampleVi}
                  </p>
                  <p className="mt-2 border-t border-border pt-2 text-sm">
                    <span className="font-bold text-primary">{currentCard.chunk}</span>
                    <span className="text-muted"> — {currentCard.meaningVi}</span>
                  </p>
                </>
              )}
            </div>
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
            onClick={nextQuiz}
            className="w-full rounded-2xl bg-accent py-3.5 text-base font-bold text-white active:opacity-90"
          >
            {isLastQuiz ? "✓ Hoàn thành" : mode === "word" ? "Từ tiếp theo →" : "Câu tiếp theo →"}
          </button>
        )}
      </div>
    </main>
  );
}

function StudyTopBar({
  label,
  done,
  total,
  onHelp,
}: {
  label: string;
  done: number;
  total: number;
  onHelp: () => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <Link href="/vocab" className="text-sm text-muted">✕</Link>
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <span>{label}</span>
          <span>{done}/{total}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(done / Math.max(total, 1)) * 100}%` }}
          />
        </div>
      </div>
      <button type="button" onClick={onHelp} aria-label="Hướng dẫn">ℹ️</button>
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<main className="flex h-[70vh] items-center justify-center text-muted">Đang tải...</main>}>
      <StudyRouter />
    </Suspense>
  );
}
