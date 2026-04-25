// INPICK Service Worker — V4 랜딩/워크플로우 출시로 캐시 정책 갱신
// CACHE_NAME bump → activate 시 옛 캐시 전부 무효화 + 모든 탭 즉시 새로고침
const CACHE_NAME = "inpick-v4-landing";

// 캐시할 정적 자산 (HTML 페이지는 캐시하지 않음)
const APP_SHELL = [
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

// 이전 캐시 전부 정리 + 클라이언트에 reload 메시지 전송
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const c of clients) {
        c.postMessage({ type: "SW_UPDATED", cache: CACHE_NAME });
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML(navigate)는 항상 네트워크
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/manifest.json")));
    return;
  }
});
