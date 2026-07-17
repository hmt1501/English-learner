"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dialogue } from "@/lib/content-schema";
import { playDialogueLine, stopAudio } from "@/lib/speech";
import { logActivity } from "@/lib/storage";
import { useProgress } from "@/stores/progress";
import { PageHeader } from "@/components/ui/PageHeader";
import { AudioButton } from "@/components/audio/AudioButton";

type Stage = "listen" | "questions" | "transcript";

export function DialoguePlayer({ dialogue }: { dialogue: Dialogue }) {
  const [stage, setStage] = useState<Stage>("listen");
  const [playing, setPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(dialogue.questions.map(() => null));
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
      return;
    }
    cancelled.current = false;
    setPlaying(true);
    for (const line of dialogue.lines) {
      if (cancelled.current) break;
      await playDialogueLine(line.audio, line.text);
      // nghỉ ngắn giữa các câu cho tự nhiên
      await new Promise((r) => setTimeout(r, 350));
    }
    setPlaying(false);
    if (!cancelled.current) setPlayCount((c) => c + 1);
  }

  const allAnswered = answers.every((a) => a !== null);
  const correctCount = answers.filter((a, i) => a === dialogue.questions[i].answer).length;

  async function complete() {
    if (completed) return;
    setCompleted(true);
    await logActivity({ type: "listening", refId: dialogue.id });
    markDone(`listening:${dialogue.id}`);
  }

  return (
    <main>
      <PageHeader title={dialogue.titleVi} subtitle={`Bài nghe · ${dialogue.lines.length} câu`} backHref="/listening" />

      {/* Bước 1: nghe không nhìn */}
      {stage === "listen" && (
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center">
          <span className="text-5xl">🎧</span>
          <p className="text-sm text-muted">
            Nghe không nhìn chữ trước — cố hiểu ý chính. Nên nghe 1–2 lần rồi mới trả lời câu hỏi.
          </p>
          <button
            type="button"
            onClick={() => void playAll()}
            className="w-full rounded-2xl bg-primary py-3.5 font-bold text-white active:opacity-90"
          >
            {playing ? "⏸ Dừng" : playCount === 0 ? "▶️ Nghe lần 1" : `▶️ Nghe lại (đã nghe ${playCount} lần)`}
          </button>
          {playCount > 0 && !playing && (
            <button
              type="button"
              onClick={() => setStage("questions")}
              className="w-full rounded-2xl border border-primary py-3 font-semibold text-primary active:opacity-80"
            >
              Trả lời câu hỏi →
            </button>
          )}
        </div>
      )}

      {/* Bước 2: câu hỏi hiểu bài */}
      {stage === "questions" && (
        <div className="space-y-4">
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
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {allAnswered && (
            <div className="rounded-2xl bg-primary-soft p-4 text-center">
              <p className="font-bold text-primary">
                Đúng {correctCount}/{dialogue.questions.length} câu
              </p>
              <button
                type="button"
                onClick={() => setStage("transcript")}
                className="mt-3 w-full rounded-2xl bg-primary py-3 font-semibold text-white active:opacity-90"
              >
                Xem lời thoại →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bước 3: transcript */}
      {stage === "transcript" && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted">Bấm 🔈 để nghe lại từng câu</p>
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
                className={`rounded-2xl border border-border bg-card p-3 ${line.speaker === "B" ? "ml-6" : "mr-6"}`}
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
          <div className="mt-5 space-y-2 pb-4">
            {!completed ? (
              <button
                type="button"
                onClick={() => void complete()}
                className="w-full rounded-2xl bg-accent py-3.5 font-bold text-white active:opacity-90"
              >
                ✓ Hoàn thành bài nghe
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
        </div>
      )}
    </main>
  );
}
