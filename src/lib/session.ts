// Bộ ghép phiên học hằng ngày — pure function, dễ unit test.
// Nhận trạng thái hiện tại (số thẻ đến hạn, lịch sử hoàn thành) và trả về
// danh sách hoạt động cho hôm nay theo quỹ thời gian người dùng chọn.

export type SessionMode = "quick" | "full" | "deep";

export type PlanItem =
  | { type: "review"; dueCount: number }
  | { type: "newCards"; count: number }
  | { type: "listening"; id: string }
  | { type: "shadowing"; id: string }
  | { type: "chat"; id: string };

export type ComposeInput = {
  mode: SessionMode;
  /** Số thẻ SRS đến hạn */
  dueCount: number;
  /** Số thẻ mới còn được học hôm nay (đã trừ cap) */
  newAvailable: number;
  dialogueIds: string[];
  scenarioIds: string[];
  /** refId → epoch ms lần hoàn thành gần nhất (không có = chưa từng làm) */
  lastDone: Record<string, number>;
  /** Số ngày từ epoch — dùng xoay vòng kỹ năng, truyền vào để test được */
  dayIndex: number;
};

/** Chọn phần tử "cũ nhất" (chưa làm bao giờ ưu tiên trước, rồi đến làm lâu nhất) */
export function pickLeastRecent(ids: string[], lastDone: Record<string, number>, exclude: string[] = []): string | undefined {
  const candidates = ids.filter((id) => !exclude.includes(id));
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => (lastDone[a] ?? 0) - (lastDone[b] ?? 0))[0];
}

export function composeSession(input: ComposeInput): PlanItem[] {
  const { mode, dueCount, newAvailable, dialogueIds, scenarioIds, lastDone, dayIndex } = input;
  const items: PlanItem[] = [];

  if (dueCount > 0) items.push({ type: "review", dueCount });

  const dialogue = pickLeastRecent(dialogueIds, lastDone);

  if (mode === "quick") {
    // ~20 phút: ôn tập + 1 kỹ năng xoay vòng theo ngày (nghe / nói theo)
    if (dialogue) {
      items.push(dayIndex % 2 === 0 ? { type: "listening", id: dialogue } : { type: "shadowing", id: dialogue });
    }
    if (newAvailable > 0) items.push({ type: "newCards", count: Math.min(newAvailable, 5) });
    return items;
  }

  if (mode === "full") {
    // ~40 phút: ôn tập + kỹ năng xoay vòng + tình huống chat + từ mới
    if (dialogue) {
      items.push(dayIndex % 2 === 0 ? { type: "listening", id: dialogue } : { type: "shadowing", id: dialogue });
    }
    const scenario = pickLeastRecent(scenarioIds, lastDone);
    if (scenario) items.push({ type: "chat", id: scenario });
    if (newAvailable > 0) items.push({ type: "newCards", count: newAvailable });
    return items;
  }

  // deep ~60 phút: đủ cả nghe + nói theo (2 bài khác nhau) + chat + từ mới
  if (dialogue) items.push({ type: "listening", id: dialogue });
  const shadowDialogue = pickLeastRecent(dialogueIds, lastDone, dialogue ? [dialogue] : []) ?? dialogue;
  if (shadowDialogue) items.push({ type: "shadowing", id: shadowDialogue });
  const scenario = pickLeastRecent(scenarioIds, lastDone);
  if (scenario) items.push({ type: "chat", id: scenario });
  if (newAvailable > 0) items.push({ type: "newCards", count: newAvailable });
  return items;
}

export const MODE_LABELS: Record<SessionMode, { label: string; minutes: string }> = {
  quick: { label: "Nhanh", minutes: "~20 phút" },
  full: { label: "Đủ", minutes: "~40 phút" },
  deep: { label: "Sâu", minutes: "~60 phút" },
};
