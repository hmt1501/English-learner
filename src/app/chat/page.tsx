"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { scenarios, getTopic } from "@/lib/content";
import { getLastDoneMap } from "@/lib/storage";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ChatListPage() {
  const [lastDone, setLastDone] = useState<Record<string, number>>({});

  useEffect(() => {
    getLastDoneMap(["chat"]).then(setLastDone);
  }, []);

  return (
    <main>
      <PageHeader title="Trả lời tin nhắn" subtitle="Tình huống thật — bạn tự soạn câu trả lời" />

      <Link
        href="/chat/ai"
        className="mb-5 flex items-center gap-3 rounded-2xl bg-primary p-4 text-white shadow-sm active:opacity-90"
      >
        <span className="text-3xl">🤖</span>
        <div className="flex-1">
          <div className="text-lg font-bold">Chat với AI</div>
          <div className="text-sm opacity-90">Trò chuyện thật với đồng nghiệp ảo — AI nhận xét từng câu của bạn</div>
        </div>
        <span className="text-2xl">›</span>
      </Link>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Tình huống có sẵn</h2>
      <div className="space-y-2">
        {scenarios.map((s) => {
          const topic = getTopic(s.topic);
          const done = !!lastDone[s.id];
          return (
            <Link
              key={s.id}
              href={`/chat/${s.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 active:opacity-80"
            >
              <span className="text-2xl">{topic?.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{s.titleVi}</div>
                <div className="text-xs text-muted">
                  {topic?.titleVi}
                  {done && <span className="ml-1 text-accent">· ✓ đã làm</span>}
                </div>
              </div>
              <span className="text-muted">›</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
