/**
 * INPICK Service Worker — V4 캐시 정리 단계 (self-destruct).
 *
 * 옛 sw.js(inpick-v1)가 _next/static·HTML을 Cache-First로 잡아 V4 코드를 못 받는 문제 해결을 위해,
 * 이 SW는 활성화 즉시 ① 모든 캐시 삭제, ② 자기 자신 unregister, ③ 모든 탭 1회 reload.
 * 다음 페이지 로드부터는 SW 없이 평소처럼 네트워크/HTTP 캐시만 사용.
 */

self.addEventListener("install", (event) => {
  // 즉시 활성화 (waiting 단계 스킵)
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1) 모든 cache 삭제
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));

      // 2) 자기 자신 unregister
      try {
        await self.registration.unregister();
      } catch (e) {
        // ignore
      }

      // 3) 모든 활성 탭에 reload 메시지 (1회만)
      const clients = await self.clients.matchAll({ type: "window" });
      for (const c of clients) {
        c.postMessage({ type: "SW_UPDATED", action: "self_destruct" });
      }
    })()
  );
});

// fetch 가로채기 없음 — 모든 요청을 네트워크/HTTP 캐시로 통과
