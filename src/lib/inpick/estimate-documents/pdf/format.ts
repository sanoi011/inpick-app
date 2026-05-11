/**
 * 견적서 PDF 공통 포맷.
 */

export const PAGE = {
  width: 297,    // A4 landscape mm
  height: 210,
  marginX: 12,
  marginY: 10,
};

export function fmtWon(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("ko-KR");
}

export function fmtQuantity(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

export function truncate(s: string | undefined | null, maxLen: number): string {
  if (!s) return "-";
  return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
}

/** jsPDF 한국어 폰트 설정 — 기존 estimate-pdf-generator.ts와 동일 패턴 (NanumGothic) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadNanumGothicFont(doc: any): Promise<void> {
  try {
    const regularRes = await fetch("/fonts/NanumGothic-Regular.ttf");
    const boldRes = await fetch("/fonts/NanumGothic-Bold.ttf");
    if (!regularRes.ok || !boldRes.ok) {
      console.warn("[estimate-pdf/format] NanumGothic font fetch failed");
      return;
    }
    const [regularBuf, boldBuf] = await Promise.all([
      regularRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ]);
    const toBase64 = (buf: ArrayBuffer): string => {
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    };
    doc.addFileToVFS("NanumGothic-Regular.ttf", toBase64(regularBuf));
    doc.addFileToVFS("NanumGothic-Bold.ttf", toBase64(boldBuf));
    doc.addFont("NanumGothic-Regular.ttf", "NanumGothic", "normal");
    doc.addFont("NanumGothic-Bold.ttf", "NanumGothic", "bold");
    doc.setFont("NanumGothic", "normal");
  } catch (e) {
    console.warn(`[estimate-pdf/format] font load fail: ${e instanceof Error ? e.message : String(e)}`);
  }
}
