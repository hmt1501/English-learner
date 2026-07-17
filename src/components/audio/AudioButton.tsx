"use client";

import { useState } from "react";
import { playVocab, playDialogueLine } from "@/lib/speech";

export function AudioButton({
  audioId,
  text,
  kind = "vocab",
  slow = false,
  className = "",
  label,
}: {
  audioId: string;
  text: string;
  kind?: "vocab" | "dialogue";
  slow?: boolean;
  className?: string;
  label?: string;
}) {
  const [playing, setPlaying] = useState(false);

  async function play() {
    if (playing) return;
    setPlaying(true);
    try {
      if (kind === "vocab") await playVocab(audioId, text);
      else await playDialogueLine(audioId, text, slow);
    } finally {
      setPlaying(false);
    }
  }

  return (
    <button
      type="button"
      onClick={play}
      className={`inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary active:opacity-70 ${className}`}
      aria-label={`Phát âm thanh: ${text}`}
    >
      <span>{playing ? "🔊" : slow ? "🐢" : "🔈"}</span>
      {label ?? (slow ? "Chậm" : "Nghe")}
    </button>
  );
}
