"use client";

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@/stores/progress";
import { exportBackup, importBackup, getActivityLog, type BackupData } from "@/lib/storage";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMounted } from "@/lib/useMounted";

export default function SettingsPage() {
  const mounted = useMounted();
  const { name, setName, newPerDay, reviewsPerDay, setCaps, streak, bestStreak } = useProgress();
  const [totalActivities, setTotalActivities] = useState(0);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getActivityLog().then((log) => setTotalActivities(log.length));
  }, []);

  async function handleExport() {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tieng-anh-cong-so-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("✓ Đã tải file sao lưu");
  }

  async function handleImport(file: File) {
    try {
      const data = JSON.parse(await file.text()) as BackupData;
      await importBackup(data);
      setMessage("✓ Đã khôi phục dữ liệu — tải lại trang để cập nhật");
      setTimeout(() => location.reload(), 1200);
    } catch {
      setMessage("✗ File sao lưu không hợp lệ");
    }
  }

  if (!mounted) return <main><PageHeader title="Cài đặt" /></main>;

  return (
    <main>
      <PageHeader title="Cài đặt" />

      <section className="mb-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">Hồ sơ</h2>
        <label className="block text-xs text-muted">Tên của bạn</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nhập tên để app chào bạn mỗi ngày"
          className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
        />
        <p className="mt-3 text-xs text-muted">
          🔥 Chuỗi hiện tại: <b>{streak} ngày</b> · Kỷ lục: <b>{bestStreak} ngày</b> · Tổng hoạt động đã học:{" "}
          <b>{totalActivities}</b>
        </p>
      </section>

      <section className="mb-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">Giới hạn học mỗi ngày</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted">Thẻ mới / ngày</label>
            <input
              type="number"
              min={0}
              max={50}
              value={newPerDay}
              onChange={(e) => setCaps(Number(e.target.value) || 0, reviewsPerDay)}
              className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted">Ôn tối đa / ngày</label>
            <input
              type="number"
              min={10}
              max={300}
              value={reviewsPerDay}
              onChange={(e) => setCaps(newPerDay, Number(e.target.value) || 10)}
              className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">Bận thì giảm thẻ mới xuống 5 — chuỗi ngày quan trọng hơn số lượng.</p>
      </section>

      <section className="mb-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">Sao lưu & khôi phục</h2>
        <p className="mb-3 text-xs text-muted">
          Dữ liệu học lưu ngay trên máy này. Hãy tải file sao lưu định kỳ để không mất tiến độ khi đổi máy.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-white active:opacity-90"
          >
            ⬇️ Tải sao lưu
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-primary py-2.5 text-sm font-semibold text-primary active:opacity-80"
          >
            ⬆️ Khôi phục
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImport(f);
          }}
        />
        {message && <p className="mt-2 text-center text-sm font-medium text-accent">{message}</p>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">📲 Cài app vào màn hình chính</h2>
        <p className="text-xs leading-relaxed text-muted">
          <b>iPhone (Safari):</b> bấm nút Chia sẻ <span className="font-mono">⎋</span> → &ldquo;Thêm vào MH chính&rdquo;.
          <br />
          <b>Android (Chrome):</b> menu ⋮ → &ldquo;Thêm vào màn hình chính&rdquo;.
          <br />
          Sau khi cài, app mở toàn màn hình và dùng được cả khi mạng yếu.
        </p>
      </section>
    </main>
  );
}
