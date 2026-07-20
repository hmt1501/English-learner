// Trạng thái nhẹ lưu ở localStorage: tên người dùng, cài đặt, chuỗi ngày học,
// và tiến độ các mục trong phiên học hôm nay.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionMode } from "@/lib/session";
import { todayStr } from "@/lib/storage";

type ProgressState = {
  name: string;
  mode: SessionMode;
  /** Số từ vựng học mỗi buổi cho một chủ đề */
  wordsPerSession: number;

  streak: number;
  bestStreak: number;
  /** Ngày gần nhất được tính chuỗi (YYYY-MM-DD) */
  lastStreakDate: string | null;

  /** Ngày của doneToday — khác hôm nay thì reset */
  today: string;
  /** Khóa các mục đã xong hôm nay, ví dụ "vocab:meetings", "listening:meetings-01" */
  doneToday: string[];

  /** Đã xem hướng dẫn cách học từ vựng chưa */
  seenVocabHelp: boolean;
  /** API key Gemini cho tính năng chat AI (lưu trên máy này) */
  geminiKey: string;

  setSeenVocabHelp: (seen: boolean) => void;
  setGeminiKey: (key: string) => void;
  setName: (name: string) => void;
  setMode: (mode: SessionMode) => void;
  setWordsPerSession: (n: number) => void;
  /** Đánh dấu 1 mục trong phiên hôm nay đã xong */
  markDone: (key: string) => void;
  /** Ghi nhận hôm nay đã học đủ — cộng chuỗi ngày (idempotent theo ngày) */
  recordStreak: () => void;
  /** Gọi khi mở app để reset tiến độ nếu đã sang ngày mới */
  rollDay: () => void;
};

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayStr(d);
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      name: "",
      mode: "full",
      wordsPerSession: 10,
      streak: 0,
      bestStreak: 0,
      lastStreakDate: null,
      today: todayStr(),
      doneToday: [],
      seenVocabHelp: false,
      geminiKey: "",

      setSeenVocabHelp: (seenVocabHelp) => set({ seenVocabHelp }),
      setGeminiKey: (geminiKey) => set({ geminiKey }),
      setName: (name) => set({ name }),
      setMode: (mode) => set({ mode }),
      setWordsPerSession: (wordsPerSession) => set({ wordsPerSession }),

      markDone: (key) => {
        get().rollDay();
        const { doneToday } = get();
        if (!doneToday.includes(key)) set({ doneToday: [...doneToday, key] });
      },

      recordStreak: () => {
        const today = todayStr();
        const { lastStreakDate, streak, bestStreak } = get();
        if (lastStreakDate === today) return;
        const next = lastStreakDate === yesterdayStr() ? streak + 1 : 1;
        set({ streak: next, bestStreak: Math.max(bestStreak, next), lastStreakDate: today });
      },

      rollDay: () => {
        const today = todayStr();
        if (get().today !== today) set({ today, doneToday: [] });
      },
    }),
    { name: "tacs-progress" }
  )
);
