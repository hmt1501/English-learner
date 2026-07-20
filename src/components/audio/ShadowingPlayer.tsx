"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dialogue } from "@/lib/content-schema";
import { playDialogueLine, stopAudio, canRecord, startRecording, type Recorder } from "@/lib/speech";
import { logActivity } from "@/lib/storage";
import { useProgress } from "@/stores/progress";
import { PageHeader } from "@/components/ui/PageHeader";
import { AudioButton } from "@/components/audio/AudioButton";

export function ShadowingPlayer({ dialogue }: { dialogue: Dialogue }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState(false);
  const [finished, setFinished] = useState(false);
  const recorderRef = useRef<Recorder | null>(null);
  const urlRef = useRef<string | null>(null); // để dọn dẹp URL cuối cùng khi rời trang
  const markDone = useProgress((s) => s.markDone);
  const recordSupported = canRecord();

  const line = dialogue.lines[lineIdx];
  const isLast = lineIdx === dialogue.lines.length - 1;

  useEffect(() => {
    return () => {
      stopAudio();
      recorderRef.current?.cancel();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function setRecordingUrlTracked(url: string | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setRecordingUrl(url);
  }

  async function toggleRecord() {
    if (recording) {
      const blob = await recorderRef.current!.stop();
      recorderRef.current = null;
      setRecording(false);
      setRecordingUrlTracked(URL.createObjectURL(blob));
      return;
    }
    try {
      recorderRef.current = await startRecording();
      setMicError(false);
      setRecording(true);
    } catch {
      setMicError(true);
    }
  }

  function playMine() {
    if (!recordingUrl) return;
    const audio = new Audio(recordingUrl);
    void audio.play();
  }

  async function compare() {
    // nghe mẫu rồi nghe bản ghi của mình ngay sau đó
    await playDialogueLine(line.audio, line.text);
    await new Promise((r) => setTimeout(r, 300));
    playMine();
  }

  function next() {
    setRecordingUrlTracked(null);
    if (isLast) {
      void (async () => {
        setFinished(true);
        await logActivity({ type: "shadowing", refId: dialogue.id });
        markDone(`shadowing:${dialogue.id}`);
      })();
    } else {
      setLineIdx((i) => i + 1);
    }
  }

  if (finished) {
    return (
      <main className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <span className="text-5xl">🎉</span>
        <h1 className="text-xl font-bold">Hoàn thành bài nói theo!</h1>
        <p className="text-muted">Bạn đã luyện {dialogue.lines.length} câu.</p>
        <Link href="/" className="mt-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-white">
          Về trang Hôm nay
        </Link>
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        title={`Nói theo: ${dialogue.titleVi}`}
        subtitle={`Câu ${lineIdx + 1}/${dialogue.lines.length} — nghe mẫu, ghi âm, so sánh`}
        backHref={`/listening/${dialogue.id}`}
      />

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(lineIdx / dialogue.lines.length) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[10px] font-bold uppercase text-muted">Người {line.speaker}</p>
        <p className="mt-1 text-lg font-bold leading-snug">{line.text}</p>
        <p className="mt-1 text-sm text-muted">{line.textVi}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <AudioButton audioId={line.audio} text={line.text} kind="dialogue" label="Nghe mẫu" />
          <AudioButton audioId={line.audio} text={line.text} kind="dialogue" slow />
        </div>

        {recordSupported ? (
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => void toggleRecord()}
              className={`w-full rounded-2xl py-3.5 font-bold text-white active:opacity-90 ${
                recording ? "animate-pulse bg-red-500" : "bg-primary"
              }`}
            >
              {recording ? "⏹ Dừng ghi âm" : "🎤 Ghi âm giọng của bạn"}
            </button>
            {micError && (
              <p className="text-center text-xs text-red-500">
                Không truy cập được micro. Hãy cho phép quyền micro trong trình duyệt.
              </p>
            )}
            {recordingUrl && !recording && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={playMine}
                  className="rounded-2xl border border-border bg-background py-3 text-sm font-semibold active:opacity-80"
                >
                  ▶️ Nghe bản của bạn
                </button>
                <button
                  type="button"
                  onClick={() => void compare()}
                  className="rounded-2xl border border-primary py-3 text-sm font-semibold text-primary active:opacity-80"
                >
                  🔁 So sánh với mẫu
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-5 rounded-xl bg-primary-soft p-3 text-xs text-primary">
            Thiết bị không hỗ trợ ghi âm — hãy nghe mẫu rồi nói theo thành tiếng, tự so sánh nhé.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={next}
        className="mt-4 w-full rounded-2xl bg-accent py-3.5 font-bold text-white active:opacity-90"
      >
        {isLast ? "✓ Hoàn thành" : "Câu tiếp theo →"}
      </button>
    </main>
  );
}
