"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true sau khi hydrate xong ở client — an toàn với SSR, không gây setState trong effect */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
