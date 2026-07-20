// Chấm câu trả lời của người học một cách linh hoạt, hoạt động hoàn toàn offline.
// Không đòi đúng từng chữ: bỏ dấu, bỏ dấu câu, chấp nhận thiếu/thừa từ phụ.
// Trả về "correct" (đúng), "close" (gần đúng) hoặc "wrong" (chưa đúng).
// Người học vẫn luôn thấy đáp án mẫu và có thể tự chấm lại.

export type Verdict = "correct" | "close" | "wrong";

// Từ phụ tiếng Việt/tiếng Anh thường không mang nghĩa cốt lõi
const VI_STOP = new Set(["là", "và", "của", "một", "các", "những", "cái", "sự", "việc", "cho", "được", "thì", "rằng"]);
const EN_STOP = new Set([
  "the", "a", "an", "to", "of", "and", "is", "are", "am", "i", "you", "it", "that", "this",
  "for", "in", "on", "at", "with", "my", "your", "will", "ll", "be", "do", "does", "please",
]);

function stripAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Chuẩn hoá: thường hoá, bỏ dấu câu, gộp khoảng trắng */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string, stop: Set<string>): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t && !stop.has(t));
}

/** Tỉ lệ từ cốt lõi của đáp án được người học nhắc tới */
function coverage(user: string, expected: string, stop: Set<string>, stripUser = false): number {
  const norm = (t: string) => (stripUser ? stripAccents(t) : t);
  const et = tokens(expected, stop).map(norm);
  if (et.length === 0) return 0;
  const ut = new Set(tokens(user, stop).map(norm));
  return et.filter((t) => ut.has(t)).length / et.length;
}

/** Chấm phần gõ NGHĨA TIẾNG VIỆT của một từ tiếng Anh */
export function checkMeaning(user: string, expected: string): Verdict {
  const nu = normalize(user);
  const ne = normalize(expected);
  if (!nu) return "wrong";
  if (nu === ne || stripAccents(nu) === stripAccents(ne)) return "correct";
  // Người học viết một phần đúng của nghĩa (hoặc ngược lại)
  const su = stripAccents(nu);
  const se = stripAccents(ne);
  if (se.includes(su) || su.includes(se)) return "correct";
  // Nghĩa chấm rộng tay: nắm được ý cốt lõi là chấp nhận (vẫn hiện đáp án đầy đủ)
  const cov = coverage(user, expected, VI_STOP, true);
  return cov >= 0.5 ? "correct" : cov >= 0.3 ? "close" : "wrong";
}

/** Chấm phần DỊCH TIẾNG ANH của một câu tiếng Việt */
export function checkTranslation(user: string, expected: string): Verdict {
  const nu = normalize(user);
  const ne = normalize(expected);
  if (!nu) return "wrong";
  if (nu === ne) return "correct";
  // Dịch chấm chặt hơn: thiếu từ nội dung là "gần đúng"
  const cov = coverage(user, expected, EN_STOP);
  return cov >= 0.8 ? "correct" : cov >= 0.5 ? "close" : "wrong";
}

export const VERDICT_LABEL: Record<Verdict, { text: string; emoji: string }> = {
  correct: { text: "Chính xác!", emoji: "✅" },
  close: { text: "Gần đúng rồi", emoji: "🟡" },
  wrong: { text: "Chưa đúng", emoji: "🔴" },
};
