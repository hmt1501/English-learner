// Bộ ghép phiên học hằng ngày — pure function, dễ unit test.
// Nhận trạng thái hiện tại (chủ đề đã học, lịch sử hoàn thành) và trả về
// danh sách hoạt động cho hôm nay theo quỹ thời gian người dùng chọn.

export type SessionMode = "quick" | "full" | "deep";

export type PlanItem =
  | { type: "vocab"; topicId: string }
  | { type: "listening"; id: string }
  | { type: "shadowing"; id: string }
  | { type: "chat"; id: string };

export type ComposeInput = {
  mode: SessionMode;
  topicIds: string[];
  /** topicId → epoch ms lần học gần nhất */
  topicLastStudied: Record<string, number>;
  dialogueIds: string[];
  scenarioIds: string[];
  /** refId → epoch ms lần hoàn thành gần nhất (nghe/nói/chat) */
  lastDone: Record<string, number>;
  /** Số ngày từ epoch — dùng xác định "hôm nay" và xoay vòng kỹ năng */
  dayIndex: number;
};

const DAY = 86_400_000;

/** Chọn chủ đề cho hôm nay: ưu tiên chủ đề chưa học hôm nay, cũ nhất trước */
export function pickTodayTopic(
  topicIds: string[],
  topicLastStudied: Record<string, number>,
  dayIndex: number
): string | undefined {
  if (topicIds.length === 0) return undefined;
  const notToday = topicIds.filter((id) => Math.floor((topicLastStudied[id] ?? 0) / DAY) !== dayIndex);
  const pool = notToday.length ? notToday : topicIds;
  return [...pool].sort((a, b) => (topicLastStudied[a] ?? 0) - (topicLastStudied[b] ?? 0))[0];
}

/** Chọn phần tử "cũ nhất" (chưa làm bao giờ ưu tiên trước, rồi đến làm lâu nhất) */
export function pickLeastRecent(ids: string[], lastDone: Record<string, number>, exclude: string[] = []): string | undefined {
  const candidates = ids.filter((id) => !exclude.includes(id));
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => (lastDone[a] ?? 0) - (lastDone[b] ?? 0))[0];
}

export function composeSession(input: ComposeInput): PlanItem[] {
  const { mode, topicIds, topicLastStudied, dialogueIds, scenarioIds, lastDone, dayIndex } = input;
  const items: PlanItem[] = [];

  const topic = pickTodayTopic(topicIds, topicLastStudied, dayIndex);
  if (topic) items.push({ type: "vocab", topicId: topic });

  const dialogue = pickLeastRecent(dialogueIds, lastDone);

  if (mode === "quick") {
    // ~20 phút: học từ vựng chủ đề + 1 kỹ năng xoay vòng theo ngày
    if (dialogue) {
      items.push(dayIndex % 2 === 0 ? { type: "listening", id: dialogue } : { type: "shadowing", id: dialogue });
    }
    return items;
  }

  if (mode === "full") {
    // ~40 phút: học từ vựng + kỹ năng xoay vòng + tình huống chat
    if (dialogue) {
      items.push(dayIndex % 2 === 0 ? { type: "listening", id: dialogue } : { type: "shadowing", id: dialogue });
    }
    const scenario = pickLeastRecent(scenarioIds, lastDone);
    if (scenario) items.push({ type: "chat", id: scenario });
    return items;
  }

  // deep ~60 phút: học từ vựng + nghe + nói theo (2 bài) + chat
  if (dialogue) items.push({ type: "listening", id: dialogue });
  const shadowDialogue = pickLeastRecent(dialogueIds, lastDone, dialogue ? [dialogue] : []) ?? dialogue;
  if (shadowDialogue) items.push({ type: "shadowing", id: shadowDialogue });
  const scenario = pickLeastRecent(scenarioIds, lastDone);
  if (scenario) items.push({ type: "chat", id: scenario });
  return items;
}

export const MODE_LABELS: Record<SessionMode, { label: string; minutes: string }> = {
  quick: { label: "Nhanh", minutes: "~20 phút" },
  full: { label: "Đủ", minutes: "~40 phút" },
  deep: { label: "Sâu", minutes: "~60 phút" },
};
