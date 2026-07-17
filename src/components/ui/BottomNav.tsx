"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Hôm nay", icon: "🏠" },
  { href: "/vocab", label: "Từ vựng", icon: "🃏" },
  { href: "/listening", label: "Nghe", icon: "🎧" },
  { href: "/chat", label: "Tin nhắn", icon: "💬" },
  { href: "/settings", label: "Cài đặt", icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                active ? "text-primary" : "text-muted"
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
