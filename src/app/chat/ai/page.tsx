"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { chatWithCoach, AI_SCENARIOS, AiError, type AiTurn, type CoachReply } from "@/lib/ai";
import { speakFallback } from "@/lib/speech";
import { logActivity } from "@/lib/storage";
import { useProgress } from "@/stores/progress";
import { useMounted } from "@/lib/useMounted";
import { PageHeader } from "@/components/ui/PageHeader";

type ChatMessage = {
  role: "user" | "model";
  text: string;
  /** Nhận xét tiếng Việt cho tin nhắn user NGAY TRƯỚC tin này */
  feedback?: string;
};

function KeySetup() {
  const setGeminiKey = useProgress((s) => s.setGeminiKey);
  const [draft, setDraft] = useState("");
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">🔑 Cài đặt AI (miễn phí, chỉ 1 lần)</h2>
      <p className="mt-2 text-sm text-muted">
        Tính năng chat dùng Google Gemini — miễn phí cho nhu cầu học hằng ngày. Bạn cần tạo một API key (mất ~2
        phút):
      </p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
        <li>
          Mở{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary underline"
          >
            aistudio.google.com/apikey
          </a>{" "}
          (đăng nhập Google)
        </li>
        <li>
          Bấm <b>Create API key</b>
        </li>
        <li>Copy key và dán vào ô dưới đây</li>
      </ol>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Dán API key vào đây (AIza...)"
        className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
      />
      <button
        type="button"
        disabled={draft.trim().length < 20}
        onClick={() => setGeminiKey(draft.trim())}
        className="mt-2 w-full rounded-xl bg-primary py-3 font-bold text-white disabled:opacity-40 active:opacity-90"
      >
        Lưu và bắt đầu chat
      </button>
      <p className="mt-2 text-xs text-muted">
        🔒 Key chỉ lưu trên máy này, không gửi đi đâu ngoài Google. Cả nhóm có thể dùng chung một key.
      </p>
    </div>
  );
}

export default function AiChatPage() {
  const mounted = useMounted();
  const { geminiKey } = useProgress();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const userMsgCount = useRef(0);
  const activityLogged = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scenario = AI_SCENARIOS.find((s) => s.id === scenarioId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const callAi = useCallback(
    async (history: AiTurn[], userMessage: string): Promise<CoachReply | null> => {
      if (!scenario) return null;
      setLoading(true);
      setError("");
      try {
        return await chatWithCoach({
          apiKey: geminiKey,
          scenarioPrompt: scenario.prompt,
          history,
          userMessage,
        });
      } catch (err) {
        setError(err instanceof AiError ? err.message : "Có lỗi xảy ra — thử lại nhé");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [geminiKey, scenario]
  );

  const startScenario = useCallback(
    async (id: string) => {
      setScenarioId(id);
      setMessages([]);
      userMsgCount.current = 0;
      activityLogged.current = false;
      const sc = AI_SCENARIOS.find((s) => s.id === id)!;
      setLoading(true);
      setError("");
      try {
        const result = await chatWithCoach({
          apiKey: geminiKey,
          scenarioPrompt: sc.prompt,
          history: [],
          userMessage: "",
        });
        setMessages([{ role: "model", text: result.reply }]);
      } catch (err) {
        setError(err instanceof AiError ? err.message : "Có lỗi xảy ra — thử lại nhé");
        setScenarioId(null);
      } finally {
        setLoading(false);
      }
    },
    [geminiKey]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);

    const history: AiTurn[] = messages.map((m) => ({ role: m.role, text: m.text }));
    const result = await callAi(history, text);
    if (result) {
      setMessages([...nextMessages, { role: "model", text: result.reply, feedback: result.feedback }]);
      userMsgCount.current += 1;
      if (userMsgCount.current >= 3 && !activityLogged.current) {
        activityLogged.current = true;
        await logActivity({ type: "chat", refId: "ai" });
      }
    }
  }, [input, loading, messages, callAi]);

  if (!mounted) return <main><PageHeader title="Chat với AI" backHref="/chat" /></main>;

  if (!geminiKey) {
    return (
      <main>
        <PageHeader title="Chat với AI" subtitle="Luyện giao tiếp với đồng nghiệp ảo" backHref="/chat" />
        <KeySetup />
      </main>
    );
  }

  // Chọn tình huống
  if (!scenarioId) {
    return (
      <main>
        <PageHeader
          title="Chat với AI 🤖"
          subtitle="Alex — đồng nghiệp ảo của bạn. Chat thoải mái, sai cũng không sao, AI sẽ nhận xét từng câu!"
          backHref="/chat"
        />
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Chọn tình huống</h2>
        <div className="grid grid-cols-2 gap-2">
          {AI_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={loading}
              onClick={() => void startScenario(s.id)}
              className="rounded-2xl border border-border bg-card p-4 text-left font-semibold active:opacity-80 disabled:opacity-50"
            >
              {s.labelVi}
            </button>
          ))}
        </div>
        {loading && <p className="mt-3 text-center text-sm text-muted">Alex đang vào chat... 💬</p>}
        {error && <p className="mt-3 text-center text-sm text-red-500">{error}</p>}
        <p className="mt-4 text-center text-xs text-muted">
          Đổi API key trong <Link href="/settings" className="text-primary underline">Cài đặt</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-[85vh] flex-col">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setScenarioId(null)} className="text-sm font-medium text-primary">
          ← Đổi tình huống
        </button>
        <span className="text-sm font-semibold">{scenario?.labelVi}</span>
      </div>

      {/* Luồng chat */}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-3.5">
        {messages.map((m, i) =>
          m.role === "model" ? (
            <div key={i}>
              <div className="flex flex-col items-start">
                <span className="mb-0.5 ml-1 text-[10px] font-semibold text-muted">Alex 🤖</span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-background px-3.5 py-2.5 text-sm shadow-sm">
                  {m.text}
                  <button
                    type="button"
                    onClick={() => void speakFallback(m.text)}
                    className="ml-1.5 align-middle text-xs"
                    aria-label="Nghe câu này"
                  >
                    🔈
                  </button>
                </div>
              </div>
              {m.feedback && (
                <div className="ml-2 mt-1.5 max-w-[85%] rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  📝 <b>Nhận xét:</b> {m.feedback}
                </div>
              )}
            </div>
          ) : (
            <div key={i} className="flex flex-col items-end">
              <span className="mb-0.5 mr-1 text-[10px] font-semibold text-muted">Bạn</span>
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-white shadow-sm">
                {m.text}
              </div>
            </div>
          )
        )}
        {loading && (
          <div className="flex items-center gap-1.5 text-sm text-muted">
            <span className="animate-pulse">Alex đang gõ...</span>
          </div>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Ô nhập */}
      <div className="mt-2 flex gap-2 pb-1">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="Trả lời bằng tiếng Anh... (sai cũng không sao!)"
          className="flex-1 rounded-xl border border-border bg-card p-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={!input.trim() || loading}
          onClick={() => void send()}
          className="self-end rounded-full bg-primary px-4 py-2.5 font-bold text-white disabled:opacity-40 active:opacity-90"
        >
          ➤
        </button>
      </div>
    </main>
  );
}
