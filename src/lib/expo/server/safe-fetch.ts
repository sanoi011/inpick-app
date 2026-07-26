import {
  assertSafeRemoteImageUrl,
} from "@/lib/inpick/storage/image-storage";

/**
 * INPICK EXPO — 서버 전용 안전 원격 fetch.
 * 리다이렉트 홉마다 SSRF 가드(https 전용·사설망 차단)를 다시 통과시키고,
 * 응답 크기를 바운드로 읽는다. brand-import / brand-logo-store 공용.
 */

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8_000;

export async function fetchSafe(
  startUrl: string,
  accept: string,
  maxBytes: number,
): Promise<{ buffer: Buffer; finalUrl: string; contentType: string }> {
  let current = (await assertSafeRemoteImageUrl(startUrl)).toString();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        headers: { Accept: accept, "User-Agent": "INPICK-EXPO-BrandImporter/1.0" },
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("REDIRECT_WITHOUT_LOCATION");
        current = (
          await assertSafeRemoteImageUrl(new URL(location, current).toString())
        ).toString();
        continue;
      }
      if (!response.ok) throw new Error(`FETCH_${response.status}`);
      const declared = Number(response.headers.get("content-length") ?? "0");
      if (declared > maxBytes) throw new Error("RESPONSE_TOO_LARGE");
      if (!response.body) throw new Error("EMPTY_RESPONSE");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error("RESPONSE_TOO_LARGE");
        }
        chunks.push(value);
      }
      return {
        buffer: Buffer.concat(chunks),
        finalUrl: current,
        contentType: (response.headers.get("content-type") ?? "").toLowerCase(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error("TOO_MANY_REDIRECTS");
}
