import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/ui/BottomNav";
import { RegisterSW } from "@/components/ui/RegisterSW";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Tiếng Anh Công Sở",
  description: "Học tiếng Anh giao tiếp công sở mỗi ngày — từ vựng, nghe, nói, trả lời tin nhắn",
  manifest: `${BASE}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TA Công Sở",
  },
  icons: {
    apple: `${BASE}/icons/icon-192.png`,
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-4">{children}</div>
        <BottomNav />
        <RegisterSW />
      </body>
    </html>
  );
}
