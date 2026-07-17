// Lưu trữ tiến độ học trên thiết bị (IndexedDB qua idb-keyval).
// Chỉ gọi từ client component.
import { get, set, createStore } from "idb-keyval";
import type { CardState } from "./srs";

const store = typeof indexedDB !== "undefined" ? createStore("tacs-db", "tacs-store") : undefined;

const KEY_CARD_STATES = "cardStates";
const KEY_ACTIVITY_LOG = "activityLog";

export type CardStates = Record<string, CardState>;

export type ActivityType = "review" | "listening" | "shadowing" | "chat" | "newCards";

export type ActivityEntry = {
  /** YYYY-MM-DD theo giờ địa phương */
  date: string;
  type: ActivityType;
  /** id hội thoại / tình huống nếu có */
  refId?: string;
  /** số thẻ đã ôn với type=review/newCards */
  count?: number;
  at: number;
};

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getCardStates(): Promise<CardStates> {
  return (await get(KEY_CARD_STATES, store)) ?? {};
}

export async function saveCardStates(states: CardStates): Promise<void> {
  await set(KEY_CARD_STATES, states, store);
}

export async function updateCardState(id: string, state: CardState): Promise<void> {
  const states = await getCardStates();
  states[id] = state;
  await saveCardStates(states);
}

export async function getActivityLog(): Promise<ActivityEntry[]> {
  return (await get(KEY_ACTIVITY_LOG, store)) ?? [];
}

export async function logActivity(entry: Omit<ActivityEntry, "date" | "at">): Promise<void> {
  const log = await getActivityLog();
  log.push({ ...entry, date: todayStr(), at: Date.now() });
  await set(KEY_ACTIVITY_LOG, log, store);
}

/** Lần gần nhất hoàn thành mỗi hội thoại/tình huống — dùng để xoay vòng trong daily plan */
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

/** Số thẻ mới đã học hôm nay (để áp cap từ mới/ngày) */
export async function countNewCardsToday(): Promise<number> {
  const log = await getActivityLog();
  const today = todayStr();
  return log
    .filter((e) => e.date === today && e.type === "newCards")
    .reduce((sum, e) => sum + (e.count ?? 0), 0);
}

// ---- Sao lưu / khôi phục ----

export type BackupData = {
  version: 1;
  exportedAt: string;
  cardStates: CardStates;
  activityLog: ActivityEntry[];
  /** localStorage của zustand (streak, cài đặt) */
  progressStore: string | null;
};

export async function exportBackup(): Promise<BackupData> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    cardStates: await getCardStates(),
    activityLog: await getActivityLog(),
    progressStore: typeof localStorage !== "undefined" ? localStorage.getItem("tacs-progress") : null,
  };
}

export async function importBackup(data: BackupData): Promise<void> {
  if (data.version !== 1) throw new Error("Phiên bản file sao lưu không được hỗ trợ");
  await saveCardStates(data.cardStates ?? {});
  await set(KEY_ACTIVITY_LOG, data.activityLog ?? [], store);
  if (data.progressStore && typeof localStorage !== "undefined") {
    localStorage.setItem("tacs-progress", data.progressStore);
  }
}
