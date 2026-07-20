// 3 cách học từ vựng dùng chung cho trang danh sách chủ đề và trang học.
// Thống kê từng thẻ được lưu riêng theo chế độ trong cùng WordStats (storage.ts):
// chế độ "word" giữ khoá là cardId trần (tương thích dữ liệu cũ),
// hai chế độ dịch câu dùng khoá "<mode>:<cardId>".

export type VocabMode = "word" | "en2vi" | "vi2en";

export const VOCAB_MODES: VocabMode[] = ["word", "en2vi", "vi2en"];

export const MODE_INFO: Record<VocabMode, { emoji: string; title: string; desc: string }> = {
  word: {
    emoji: "🔤",
    title: "Học từ vựng",
    desc: "Xem cụm từ tiếng Anh, gõ nghĩa tiếng Việt",
  },
  en2vi: {
    emoji: "📖",
    title: "Dịch câu Anh → Việt",
    desc: "Đọc câu tiếng Anh, gõ bản dịch tiếng Việt",
  },
  vi2en: {
    emoji: "✍️",
    title: "Dịch câu Việt → Anh",
    desc: "Đọc câu tiếng Việt, gõ câu tiếng Anh",
  },
};

export function parseMode(raw: string | null): VocabMode | null {
  return raw === "word" || raw === "en2vi" || raw === "vi2en" ? raw : null;
}

/** Khoá lưu WordStat của một thẻ theo chế độ học */
export function statKey(mode: VocabMode, cardId: string): string {
  return mode === "word" ? cardId : `${mode}:${cardId}`;
}
