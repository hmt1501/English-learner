"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { ChatScenario } from "@/lib/content-schema";
import { getCard } from "@/lib/content";
import { getCardStates, saveCardStates, logActivity } from "@/lib/storage";
import { newCardState } from "@/lib/srs";
import { useProgress } from "@/stores/progress";
import { PageHeader } from "@/components/ui/PageHeader";

const STYLE_LABELS: Record<string, string> = {
  formal: "Trang trọng",
  neutral: "Trung tính",
  friendly: "Thân thiện",
};

export function ChatScenarioPlayer({ scenario }: { scenario: ChatScenario }) {
  const [reply, setReply] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [hintsShown, setHintsShown] = useState(0);
  const [rubricChecks, setRubricChecks] = useState<boolean[]>(scenario.rubricVi.map(() => false));
  const [addedCards, setAddedCards] = useState(false);
  const [completed, setCompleted] = useState(false);
  const markDone = useProgress((s) => s.markDone);

  const usefulCards = scenario.srsCards.map(getCard).filter((c) => c !== undefined);

  const addToSrs = useCallback(async () => {
    if (addedCards) return;
    const states = await getCardStates();
    const now = Date.now();
    for (const card of usefulCards) {
      if (!states[card.id]) states[card.id] = newCardState(now);
    }
    await saveCardStates(states);
    setAddedCards(true);
  }, [addedCards, usefulCards]);

  async function complete() {
    if (completed) return;
    setCompleted(true);
    await logActivity({ type: "chat", refId: scenario.id });
    markDone(`chat:${scenario.id}`);
  }

  return (
    <main>
      <PageHeader title={scenario.titleVi} backHref="/chat" />

      {/* Bối cảnh */}
      <div className="mb-3 rounded-2xl bg-primary-soft p-3.5 text-sm">
        <p className="text-primary">
          <span className="font-bold">Bối cảnh:</span> {scenario.contextVi}
        </p>
        <p className="mt-1.5 font-semibold text-primary">
          🎯 Nhiệm vụ: {scenario.taskVi}
        </p>
      </div>

      {/* Luồng chat kiểu Zalo */}
      <div className="rounded-2xl border border-border bg-card p-3.5">
        <div className="space-y-3">
          {scenario.thread.map((msg, i) => (
            <div key={i} className="flex flex-col items-start">
              <span className="mb-0.5 ml-1 text-[10px] font-semibold text-muted">{msg.from}</span>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-background px-3.5 py-2.5 text-sm shadow-sm">
                {msg.text}
              </div>
            </div>
          ))}
          {submitted && (
            <div className="flex flex-col items-end">
              <span className="mb-0.5 mr-1 text-[10px] font-semibold text-muted">Bạn</span>
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-white shadow-sm">
                {reply}
              </div>
            </div>
          )}
        </div>

        {/* Soạn tin */}
        {!submitted && (
          <div className="mt-4 border-t border-border pt-3">
            {hintsShown > 0 && (
              <div className="mb-2 space-y-1">
                {scenario.hints.slice(0, hintsShown).map((h, i) => (
                  <p key={i} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    💡 {h}
                  </p>
                ))}
              </div>
            )}
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              placeholder="Soạn câu trả lời bằng tiếng Anh... Cứ viết theo khả năng, sai cũng không sao!"
              className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-2 flex gap-2">
              {hintsShown < scenario.hints.length && (
                <button
                  type="button"
                  onClick={() => setHintsShown((h) => h + 1)}
                  className="rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-muted active:opacity-80"
                >
                  💡 Gợi ý ({scenario.hints.length - hintsShown})
                </button>
              )}
              <button
                type="button"
                disabled={reply.trim().length < 5}
                onClick={() => setSubmitted(true)}
                className="flex-1 rounded-full bg-primary py-2 text-sm font-bold text-white disabled:opacity-40 active:opacity-90"
              >
                Gửi ➤
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sau khi gửi: so với câu mẫu + tự chấm */}
      {submitted && (
        <div className="mt-4 space-y-4 pb-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Câu trả lời mẫu</h2>
            <div className="space-y-2">
              {scenario.modelAnswers.map((m, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-3.5">
                  <span className="mb-1 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                    {STYLE_LABELS[m.style] ?? m.style}
                  </span>
                  <p className="text-sm">{m.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3.5">
            <h2 className="mb-2 text-sm font-bold">Tự chấm câu trả lời của bạn:</h2>
            <div className="space-y-2">
              {scenario.rubricVi.map((r, i) => (
                <label key={i} className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={rubricChecks[i]}
                    onChange={() => setRubricChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
                    className="h-5 w-5 accent-emerald-600"
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          {usefulCards.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-3.5">
              <h2 className="mb-2 text-sm font-bold">Cụm từ hay trong tình huống này:</h2>
              <ul className="mb-3 space-y-1.5">
                {usefulCards.map((c) => (
                  <li key={c.id} className="text-sm">
                    <span className="font-semibold text-primary">{c.chunk}</span>
                    <span className="text-muted"> — {c.meaningVi}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void addToSrs()}
                disabled={addedCards}
                className="w-full rounded-xl border border-primary py-2.5 text-sm font-semibold text-primary disabled:opacity-60 active:opacity-80"
              >
                {addedCards ? "✓ Đã thêm vào bộ thẻ ôn tập" : "＋ Thêm vào bộ thẻ ôn tập"}
              </button>
            </div>
          )}

          {!completed ? (
            <button
              type="button"
              onClick={() => void complete()}
              className="w-full rounded-2xl bg-accent py-3.5 font-bold text-white active:opacity-90"
            >
              ✓ Hoàn thành tình huống
            </button>
          ) : (
            <div className="text-center">
              <p className="font-semibold text-accent">✓ Đã hoàn thành!</p>
              <Link href="/" className="mt-2 inline-block rounded-full bg-primary px-6 py-2.5 font-semibold text-white">
                Về trang Hôm nay
              </Link>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
