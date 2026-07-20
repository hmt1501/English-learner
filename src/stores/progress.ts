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
  /** Khóa của TẤT CẢ mục trong phiên hôm nay (do trang Hôm nay ghi lại) — dùng để
   * biết khi nào đã xong hết và cộng chuỗi ngày, dù đang ở màn hình khác */
  todayPlanKeys: string[];

  /** Đã xem hướng dẫn cách học từ vựng chưa */
  seenVocabHelp: boolean;
  /** API key Gemini cho tính năng chat AI (lưu trên máy này) */
  geminiKey: string;

  setSeenVocabHelp: (seen: boolean) => void;
  setGeminiKey: (key: string) => void;
  setName: (name: string) => void;
  setMode: (mode: SessionMode) => void;
  setWordsPerSession: (n: number) => void;
  /** Trang Hôm nay ghi lại danh sách khóa mục của phiên hôm nay */
  setTodayPlan: (keys: string[]) => void;
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
      todayPlanKeys: [],
      seenVocabHelp: false,
      geminiKey: "",

      setSeenVocabHelp: (seenVocabHelp) => set({ seenVocabHelp }),
      setGeminiKey: (geminiKey) => set({ geminiKey }),
      setName: (name) => set({ name }),
      setMode: (mode) => set({ mode }),
      setWordsPerSession: (wordsPerSession) => set({ wordsPerSession }),

      setTodayPlan: (keys) => {
        get().rollDay();
        set({ todayPlanKeys: keys });
        // Nếu (vì lý do nào đó) đã xong hết từ trước → cộng chuỗi luôn
        const { doneToday } = get();
        if (keys.length > 0 && keys.every((k) => doneToday.includes(k))) get().recordStreak();
      },

      markDone: (key) => {
        get().rollDay();
        const { doneToday, todayPlanKeys } = get();
        const nextDone = doneToday.includes(key) ? doneToday : [...doneToday, key];
        set({ doneToday: nextDone });
        // Xong mục cuối cùng của phiên → cộng chuỗi ngay, không cần quay lại tab Hôm nay
        if (todayPlanKeys.length > 0 && todayPlanKeys.every((k) => nextDone.includes(k))) {
          get().recordStreak();
        }
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
        if (get().today !== today) set({ today, doneToday: [], todayPlanKeys: [] });
      },
    }),
    { name: "tacs-progress" }
  )
);
