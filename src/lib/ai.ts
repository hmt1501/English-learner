// Gọi Google Gemini API (free tier) trực tiếp từ trình duyệt để luyện chat.
// API key do người dùng tự tạo (miễn phí tại aistudio.google.com/apikey) và lưu trên máy.

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

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
    public kind: "no-key" | "bad-key" | "rate-limit" | "network" | "other"
  ) {
    super(message);
  }
}

async function callGemini(apiKey: string, model: string, body: unknown): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new AiError("API key không hợp lệ hoặc hết hạn", "bad-key");
    }
    if (res.status === 429) {
      throw new AiError("Đã chạm giới hạn miễn phí — chờ 1 phút rồi thử lại nhé", "rate-limit");
    }
    if (res.status === 404) {
      throw new AiError(`Model ${model} không tồn tại`, "other");
    }
    throw new AiError(`Lỗi API (${res.status})`, "other");
  }
  const data = await res.json();
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

  const body = {
    system_instruction: { parts: [{ text: systemPrompt(scenarioPrompt) }] },
    contents,
    generationConfig: { temperature: 0.8, maxOutputTokens: 600 },
  };

  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const raw = await callGemini(apiKey, model, body);
      return parseCoachReply(raw);
    } catch (err) {
      lastError = err;
      // model không tồn tại → thử model kế; lỗi khác → dừng luôn
      if (!(err instanceof AiError && err.kind === "other" && err.message.includes("không tồn tại"))) {
        throw err;
      }
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new AiError("Không gọi được AI", "network");
}
