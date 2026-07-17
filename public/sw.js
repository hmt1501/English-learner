// Service worker thuần — offline sau lần truy cập đầu:
// - Trang: network-first, rơi về cache khi mất mạng
// - Audio + asset build (_next/static): cache-first
// Tự nhận base path từ scope (chạy được cả ở "/" lẫn "/English-learner/").
const VERSION = "v1";
const PAGE_CACHE = `tacs-pages-${VERSION}`;
const ASSET_CACHE = "tacs-assets";
const AUDIO_CACHE = "tacs-audio";
const KEEP = [PAGE_CACHE, ASSET_CACHE, AUDIO_CACHE];

const BASE = new URL(self.registration.scope).pathname; // "/" hoặc "/English-learner/"

const PRECACHE_PAGES = ["", "vocab/", "vocab/review/", "listening/", "chat/", "settings/", "manifest.json"].map(
  (p) => BASE + p
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(PRECACHE_PAGES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // offline mà trang chưa từng mở → về trang chủ đã precache
    const home = await cache.match(BASE);
    if (home) return home;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(BASE + "audio/")) {
    event.respondWith(cacheFirst(request, AUDIO_CACHE));
  } else if (url.pathname.startsWith(BASE + "_next/static/") || url.pathname.startsWith(BASE + "icons/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  } else {
    event.respondWith(networkFirst(request, PAGE_CACHE));
  }
});
