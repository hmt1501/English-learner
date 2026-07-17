"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dialogues, getTopic } from "@/lib/content";
import { getLastDoneMap } from "@/lib/storage";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ListeningPage() {
  const [lastDone, setLastDone] = useState<Record<string, number>>({});

  useEffect(() => {
    getLastDoneMap(["listening"]).then(setLastDone);
  }, []);

  return (
    <main>
      <PageHeader title="Nghe" subtitle="Hội thoại công sở — nghe trước, đọc sau" />
      <div className="space-y-2">
        {dialogues.map((d) => {
          const topic = getTopic(d.topic);
          const done = !!lastDone[d.id];
          return (
            <Link
              key={d.id}
              href={`/listening/${d.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 active:opacity-80"
            >
              <span className="text-2xl">{topic?.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{d.titleVi}</div>
                <div className="text-xs text-muted">
                  {d.lines.length} câu · cấp độ {d.level}
                  {done && <span className="ml-1 text-accent">· ✓ đã nghe</span>}
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
