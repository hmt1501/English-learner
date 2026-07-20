"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dialogue } from "@/lib/content-schema";
import { playDialogueLine, stopAudio } from "@/lib/speech";
import { logActivity } from "@/lib/storage";
import { useProgress } from "@/stores/progress";
import { PageHeader } from "@/components/ui/PageHeader";
import { AudioButton } from "@/components/audio/AudioButton";

export function DialoguePlayer({ dialogue }: { dialogue: Dialogue }) {
  const [playing, setPlaying] = useState(false);
  const [playingLine, setPlayingLine] = useState(-1);
  const [playCount, setPlayCount] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(dialogue.questions.map(() => null));
  const [showTranscript, setShowTranscript] = useState(false);
  const [showVi, setShowVi] = useState(false);
  const [completed, setCompleted] = useState(false);
  const cancelled = useRef(false);
  const markDone = useProgress((s) => s.markDone);

  useEffect(() => {
    return () => {
      cancelled.current = true;
      stopAudio();
    };
  }, []);

  async function playAll() {
    if (playing) {
      cancelled.current = true;
      stopAudio();
      setPlaying(false);
      setPlayingLine(-1);
      return;
    }
    cancelled.current = false;
    setPlaying(true);
    for (let i = 0; i < dialogue.lines.length; i++) {
      if (cancelled.current) break;
      setPlayingLine(i);
      await playDialogueLine(dialogue.lines[i].audio, dialogue.lines[i].text);
      // nghỉ ngắn giữa các câu cho tự nhiên
      await new Promise((r) => setTimeout(r, 350));
    }
    setPlaying(false);
    setPlayingLine(-1);
    if (!cancelled.current) setPlayCount((c) => c + 1);
  }

  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === dialogue.questions.length;
  const correctCount = answers.filter((a, i) => a === dialogue.questions[i].answer).length;

  async function complete() {
    if (completed) return;
    setCompleted(true);
    await logActivity({ type: "listening", refId: dialogue.id });
    markDone(`listening:${dialogue.id}`);
  }

  return (
    <main>
      <PageHeader title={dialogue.titleVi} subtitle={`Bài nghe · ${dialogue.lines.length} câu · cấp độ ${dialogue.level}`} backHref="/listening" />

      {/* Trình phát */}
      <section className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void playAll()}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl text-white active:opacity-90 ${
              playing ? "bg-red-500" : "bg-primary"
            }`}
            aria-label={playing ? "Dừng" : "Phát toàn bộ"}
          >
            {playing ? "⏸" : "▶️"}
          </button>
          <div className="flex-1">
            <p className="font-semibold">{playing ? `Đang phát câu ${playingLine + 1}/${dialogue.lines.length}...` : "Nghe toàn bộ hội thoại"}</p>
            <p className="text-xs text-muted">
              {playCount === 0
                ? "Gợi ý: nghe 1–2 lần không nhìn chữ trước, rồi trả lời câu hỏi bên dưới."
                : `Đã nghe ${playCount} lần. Nghe lại bao nhiêu lần cũng được!`}
            </p>
          </div>
        </div>
      </section>

      {/* Câu hỏi hiểu bài — hiện ngay từ đầu */}
      <section className="mb-4">
        <h2 className="mb-2 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-muted">
          <span>❓ Câu hỏi ({answeredCount}/{dialogue.questions.length})</span>
          {allAnswered && (
            <span className="font-bold normal-case text-primary">Đúng {correctCount}/{dialogue.questions.length}</span>
          )}
        </h2>
        <div className="space-y-3">
          {dialogue.questions.map((q, qi) => (
            <div key={qi} className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 font-semibold">
                {qi + 1}. {q.qVi}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const chosen = answers[qi] === oi;
                  const isCorrect = oi === q.answer;
                  let cls = "border-border bg-background";
                  if (answers[qi] !== null) {
                    if (isCorrect) cls = "border-accent bg-accent-soft text-accent font-semibold";
                    else if (chosen) cls = "border-red-400 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300";
                  }
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={answers[qi] !== null}
                      onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${cls}`}
                    >
                      {opt}
                      {answers[qi] !== null && isCorrect && <span className="ml-1">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lời thoại — có thể mở bất cứ lúc nào */}
      <section className="mb-4">
        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          className="mb-2 flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3.5 active:opacity-80"
        >
          <span className="font-semibold">📜 Lời thoại {showTranscript ? "" : "(bấm để xem)"}</span>
          <span className="text-muted">{showTranscript ? "▲" : "▼"}</span>
        </button>
        {!showTranscript && !allAnswered && (
          <p className="px-1 text-xs text-muted">
            Mẹo: cố nghe hiểu trước khi mở lời thoại — nhưng nếu bí quá thì cứ mở, không sao cả!
          </p>
        )}
        {showTranscript && (
          <div>
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowVi((v) => !v)}
                className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary"
              >
                {showVi ? "Ẩn tiếng Việt" : "Hiện tiếng Việt"}
              </button>
            </div>
            <div className="space-y-2">
              {dialogue.lines.map((line, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border bg-card p-3 ${line.speaker === "B" ? "ml-6" : "mr-6"} ${
                    playingLine === i ? "border-primary" : "border-border"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase text-muted">Người {line.speaker}</p>
                  <p className="mt-0.5 text-sm font-medium">{line.text}</p>
                  {showVi && <p className="mt-0.5 text-xs text-muted">{line.textVi}</p>}
                  <div className="mt-2 flex gap-2">
                    <AudioButton audioId={line.audio} text={line.text} kind="dialogue" />
                    <AudioButton audioId={line.audio} text={line.text} kind="dialogue" slow />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Hoàn thành */}
      <div className="space-y-2 pb-4">
        {!completed ? (
          <button
            type="button"
            disabled={!allAnswered}
            onClick={() => void complete()}
            className="w-full rounded-2xl bg-accent py-3.5 font-bold text-white disabled:opacity-40 active:opacity-90"
          >
            {allAnswered ? "✓ Hoàn thành bài nghe" : `Trả lời đủ ${dialogue.questions.length} câu hỏi để hoàn thành`}
          </button>
        ) : (
          <p className="text-center font-semibold text-accent">✓ Đã hoàn thành!</p>
        )}
        <Link
          href={`/speaking/${dialogue.id}`}
          className="block w-full rounded-2xl border border-primary py-3 text-center font-semibold text-primary active:opacity-80"
        >
          🎤 Luyện nói theo bài này
        </Link>
      </div>
    </main>
  );
}
