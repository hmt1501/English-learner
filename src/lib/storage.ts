// Lưu trữ tiến độ học trên thiết bị (IndexedDB qua idb-keyval).
// Chỉ gọi từ client component.
import { get, set, createStore } from "idb-keyval";

const store = typeof indexedDB !== "undefined" ? createStore("tacs-db", "tacs-store") : undefined;

const KEY_WORD_STATS = "wordStats";
const KEY_ACTIVITY_LOG = "activityLog";

/** Số lần trả lời đúng để coi một từ là "đã thuộc" */
export const MASTER_THRESHOLD = 2;

export type WordStat = {
  correct: number;
  wrong: number;
  /** Thời điểm học gần nhất (epoch ms) */
  lastSeen: number;
};

export type WordStats = Record<string, WordStat>;

export type ActivityType = "vocab" | "listening" | "shadowing" | "chat";

export type ActivityEntry = {
  /** YYYY-MM-DD theo giờ địa phương */
  date: string;
  type: ActivityType;
  /** id chủ đề / hội thoại / tình huống nếu có */
  refId?: string;
  /** số từ đúng với type=vocab */
  count?: number;
  at: number;
};

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getWordStats(): Promise<WordStats> {
  return (await get(KEY_WORD_STATS, store)) ?? {};
}

export async function saveWordStats(stats: WordStats): Promise<void> {
  await set(KEY_WORD_STATS, stats, store);
}

/** Cập nhật thuần: trả về stat mới sau một lần trả lời (dùng được cả khi gộp lô) */
export function applyResult(stat: WordStat | undefined, correct: boolean, now: number): WordStat {
  const cur = stat ?? { correct: 0, wrong: 0, lastSeen: 0 };
  return {
    correct: cur.correct + (correct ? 1 : 0),
    wrong: cur.wrong + (correct ? 0 : 1),
    lastSeen: now,
  };
}

export function isMastered(stat: WordStat | undefined): boolean {
  return (stat?.correct ?? 0) >= MASTER_THRESHOLD;
}

export async function getActivityLog(): Promise<ActivityEntry[]> {
  return (await get(KEY_ACTIVITY_LOG, store)) ?? [];
}

export async function logActivity(entry: Omit<ActivityEntry, "date" | "at">): Promise<void> {
  const log = await getActivityLog();
  log.push({ ...entry, date: todayStr(), at: Date.now() });
  await set(KEY_ACTIVITY_LOG, log, store);
}

/** Lần gần nhất hoàn thành mỗi chủ đề/hội thoại/tình huống — dùng để xoay vòng trong daily plan */
export async function getLastDoneMap(types: ActivityType[]): Promise<Record<string, number>> {
  const log = await getActivityLog();
  const map: Record<string, number> = {};
  for (const e of log) {
    if (e.refId && types.includes(e.type)) {
      map[e.refId] = Math.max(map[e.refId] ?? 0, e.at);
    }
  }
  return map;
}

// ---- Sao lưu / khôi phục ----

export type BackupData = {
  version: 1 | 2;
  exportedAt: string;
  wordStats?: WordStats;
  activityLog: ActivityEntry[];
  /** localStorage của zustand (streak, cài đặt) */
  progressStore: string | null;
};

export async function exportBackup(): Promise<BackupData> {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    wordStats: await getWordStats(),
    activityLog: await getActivityLog(),
    progressStore: typeof localStorage !== "undefined" ? localStorage.getItem("tacs-progress") : null,
  };
}

export async function importBackup(data: BackupData): Promise<void> {
  if (!data || typeof data !== "object") throw new Error("File sao lưu không hợp lệ");
  const wordStats =
    data.wordStats && typeof data.wordStats === "object" && !Array.isArray(data.wordStats) ? data.wordStats : {};
  const activityLog = Array.isArray(data.activityLog) ? data.activityLog : [];
  await saveWordStats(wordStats);
  await set(KEY_ACTIVITY_LOG, activityLog, store);
  if (typeof data.progressStore === "string" && typeof localStorage !== "undefined") {
    localStorage.setItem("tacs-progress", data.progressStore);
  }
}
