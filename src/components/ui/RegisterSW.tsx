"use client";

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {
        // không có SW cũng không sao — app vẫn chạy online
      });
    }
  }, []);
  return null;
}
