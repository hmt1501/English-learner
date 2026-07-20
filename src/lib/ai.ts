// Gọi Google Gemini API (free tier) trực tiếp từ trình duyệt để luyện chat.
// API key do người dùng tự tạo (miễn phí tại aistudio.google.com/apikey) và lưu trên máy.

// Thử lần lượt. Bản "-lite" đặt trước vì hạn mức miễn phí theo ngày cao hơn hẳn
// bản thường (~1000 so với ~250 request/ngày) mà vẫn đủ tốt cho chat A2-B1 —
// quan trọng khi cả nhóm dùng chung một key.
const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

export type AiTurn = { role: "user" | "model"; text: string };

export type CoachReply = {
  /** Câu trả lời tiếng Anh của "đồng nghiệp ảo" */
  reply: string;
  /** Nhận xét tiếng Việt về câu của người học (rỗng nếu là lượt mở đầu) */
  feedback: string;
};

export const AI_SCENARIOS: { id: string; labelVi: string; prompt: string }[] = [
  { id: "free", labelVi: "💬 Tự do", prompt: "Casual chat between coworkers at a Vietnamese company. Pick any light workplace topic to start (weekend, lunch, work, weather...)." },
  { id: "small-talk", labelVi: "☕ Xã giao", prompt: "Small talk in the office pantry. You just ran into the learner while making coffee." },
  { id: "status", labelVi: "📊 Báo cáo tiến độ", prompt: "You are the learner's team lead asking for a status update on their current task. Ask follow-up questions about progress, blockers, and timing." },
  { id: "meeting", labelVi: "📅 Hẹn lịch họp", prompt: "You need to schedule a meeting with the learner this week. Negotiate a time that works for both of you." },
  { id: "help", labelVi: "🙋 Nhờ giúp đỡ", prompt: "You need the learner's help with a task (e.g. checking a document, sharing a file). Make the request and discuss details." },
  { id: "dayoff", labelVi: "🏖️ Xin nghỉ phép", prompt: "You are the learner's manager. The learner wants to ask for a day off — respond naturally, ask about handover plans." },
];

function systemPrompt(scenarioPrompt: string): string {
  return `You are "Alex", a friendly foreign colleague at a Vietnamese company, chatting with a Vietnamese coworker who is learning English (pre-intermediate level: knows basics, weak vocabulary, hesitates a lot).

ROLEPLAY SCENARIO: ${scenarioPrompt}

RULES:
1. Stay in character as a real colleague chatting on a messaging app. Be warm and natural.
2. Use SIMPLE English (A2-B1 level): short sentences, common words, no idioms unless very common.
3. Keep replies SHORT: 1-3 short sentences, like real chat messages.
4. ALWAYS end your reply with a question or prompt so the conversation keeps going.
5. After the learner's message, give brief feedback IN VIETNAMESE about their English: point out 1 grammar/word mistake and how to fix it, or suggest a more natural phrasing. If their message is good, say so briefly and mention one nice thing about it. Keep feedback under 40 Vietnamese words.
6. Never lecture. Never break character in the REPLY part.

OUTPUT FORMAT — respond with EXACTLY this structure, nothing else:
REPLY: <your English chat message>
FEEDBACK: <nhận xét ngắn bằng tiếng Việt, hoặc "-" nếu đây là tin nhắn mở đầu>`;
}

function parseCoachReply(raw: string): CoachReply {
  const feedbackMatch = raw.match(/FEEDBACK:\s*([\s\S]*)/i);
  let reply = raw;
  let feedback = "";
  if (feedbackMatch) {
    feedback = feedbackMatch[1].trim();
    reply = raw.slice(0, feedbackMatch.index).trim();
  }
  reply = reply.replace(/^REPLY:\s*/i, "").trim();
  if (feedback === "-" || feedback === "—") feedback = "";
  return { reply: reply || raw.trim(), feedback };
}

export class AiError extends Error {
  constructor(
    message: string,
    public kind: "no-key" | "bad-key" | "rate-limit" | "not-found" | "network" | "other",
    /** Thông báo gốc từ Google (sạch, để hiện cho người dùng) */
    public detail?: string,
    /** Toàn bộ chi tiết lỗi (message + status + details) — chỉ dùng để phân loại nội bộ */
    public raw?: string
  ) {
    super(message);
  }
}

async function callGemini(apiKey: string, model: string, body: unknown): Promise<string> {
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  } catch {
    throw new AiError("Không kết nối được — kiểm tra mạng rồi thử lại", "network");
  }

  if (!res.ok) {
    // Đọc lỗi gốc của Google. `message` để hiển thị; `raw` gộp cả status + details
    // (chứa quotaId như "...PerDay..."/"...PerMinute...") để phân loại 429 cho chuẩn.
    let googleMsg = "";
    let raw = "";
    try {
      const errData = await res.json();
      const e = errData?.error ?? {};
      googleMsg = e.message ?? "";
      raw = `${e.message ?? ""} ${e.status ?? ""} ${e.details ? JSON.stringify(e.details) : ""}`.trim();
    } catch {
      // body không phải JSON — bỏ qua
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new AiError("API key không hợp lệ hoặc chưa được kích hoạt", "bad-key", googleMsg, raw);
    }
    if (res.status === 429) {
      throw new AiError("rate-limit", "rate-limit", googleMsg, raw);
    }
    if (res.status === 404) {
      throw new AiError(`Model ${model} không khả dụng`, "not-found", googleMsg, raw);
    }
    throw new AiError(`Lỗi máy chủ Gemini (${res.status})`, "other", googleMsg, raw);
  }

  const data = await res.json();
  // Bị chặn bởi bộ lọc an toàn của Google?
  const blockReason: string | undefined = data?.promptFeedback?.blockReason;
  if (blockReason) throw new AiError("Nội dung bị Google chặn — thử câu khác nhé", "other", blockReason);
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new AiError("AI không trả lời được — thử lại nhé", "other");
  return text;
}

/**
 * Gửi hội thoại đến Gemini và nhận về câu trả lời + nhận xét.
 * history: các lượt trước; userMessage: rỗng nếu muốn AI mở đầu cuộc trò chuyện.
 */
export async function chatWithCoach(opts: {
  apiKey: string;
  scenarioPrompt: string;
  history: AiTurn[];
  userMessage: string;
}): Promise<CoachReply> {
  const { apiKey, scenarioPrompt, history, userMessage } = opts;
  if (!apiKey) throw new AiError("Chưa có API key", "no-key");

  const contents = [
    // Gemini yêu cầu lượt đầu là user
    ...(history.length === 0 && !userMessage
      ? [{ role: "user", parts: [{ text: "(Start the conversation — greet me and open the scenario.)" }] }]
      : []),
    ...history.slice(-20).map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    ...(userMessage ? [{ role: "user", parts: [{ text: userMessage }] }] : []),
  ];

  let lastError: AiError | undefined;
  for (const model of MODELS) {
    const body = {
      system_instruction: { parts: [{ text: systemPrompt(scenarioPrompt) }] },
      contents,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 600,
        // Dòng 2.5 mặc định bật "thinking" — tốn hàng trăm token ẩn mỗi câu và có thể
        // ngốn hết maxOutputTokens khiến trả về rỗng. Chat ngắn không cần → tắt hẳn.
        // (Dòng 2.0 không nhận thinkingConfig, gửi vào sẽ bị lỗi 400.)
        ...(model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    };
    try {
      const raw = await callGemini(apiKey, model, body);
      return parseCoachReply(raw);
    } catch (err) {
      if (!(err instanceof AiError)) throw err;
      lastError = err;
      // Key sai hoặc mất mạng thì đổi model cũng vô ích → dừng ngay.
      // Hết hạn mức (429) hoặc model không khả dụng (404) → thử model kế tiếp.
      if (err.kind !== "rate-limit" && err.kind !== "not-found") throw err;
    }
  }

  // Tất cả model đều thất bại. Phân loại 429 dựa trên quotaId trong error.details
  // (gộp sẵn vào `raw`): "...PerMinute..." = giới hạn tức thời (chờ chút là được);
  // còn lại (PerDay / FreeTier / limit 0) đều cùng cách xử lý nên gộp làm một —
  // KHÔNG cố tách "hết hạn ngày" với "chưa có free tier" vì chúng gần như giống hệt
  // nhau trong thông báo, tách ra chỉ gây báo nhầm.
  if (lastError?.kind === "rate-limit") {
    const g = (lastError.raw ?? lastError.detail ?? "").toLowerCase();
    // "limit: 0" = project KHÔNG có phần miễn phí nào (thường do đã bật billing hoặc là
    // project Google Cloud). Phải kiểm tra TRƯỚC per-minute vì retry không bao giờ giúp được.
    if (g.includes("limit: 0") || g.includes("limit:0")) {
      throw new AiError(
        "Key này thuộc một project KHÔNG có gói miễn phí (Google báo limit: 0), nên retry bao nhiêu cũng vô ích. " +
          "Thường do project đó đã BẬT THANH TOÁN (billing) hoặc là project Google Cloud, không phải project mặc định của AI Studio. " +
          "Cách xử lý: vào aistudio.google.com/apikey bằng một tài khoản Google CHƯA bật billing, " +
          'tạo key mới trong project mặc định (ví dụ "My First Project"), và ĐỪNG bật billing cho project đó.',
        "rate-limit",
        lastError.detail,
        lastError.raw
      );
    }
    if (g.includes("perminute") || g.includes("per minute")) {
      throw new AiError(
        "Gửi hơi nhanh, chạm giới hạn mỗi phút — chờ khoảng 1 phút rồi thử lại nhé (key vẫn tốt).",
        "rate-limit",
        lastError.detail,
        lastError.raw
      );
    }
    throw new AiError(
      "Key này đã hết lượt chat miễn phí trong ngày (hạn mức tính theo PROJECT, không theo từng key). " +
        "Vì thế tạo thêm key trong cùng project sẽ KHÔNG có thêm lượt. Cách xử lý: chờ tới ~14–15h " +
        "(giờ VN) hạn mức tự reset, HOẶC tạo key bằng một TÀI KHOẢN Google khác (hoặc một project khác).",
      "rate-limit",
      lastError.detail,
      lastError.raw
    );
  }
  throw lastError ?? new AiError("Không gọi được AI", "network");
}
