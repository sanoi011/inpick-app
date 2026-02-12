// src/lib/services/pdf-extractor.ts
// PDF → PNG 변환 (서버사이드, pdfjs-dist 사용)

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// 서버사이드에서는 worker 비활성화
if (typeof window === "undefined") {
  GlobalWorkerOptions.workerSrc = "";
}

export interface PdfPageResult {
  pageNumber: number;
  imageBase64: string;
  width: number;
  height: number;
}

export interface PdfExtractionResult {
  pages: PdfPageResult[];
  pageCount: number;
  bestFloorPlanPage: number; // 0-indexed
}

/**
 * PDF 파일을 PNG 이미지로 변환
 * @param pdfBuffer PDF 파일 ArrayBuffer
 * @param targetDpi 렌더링 DPI (기본 200, Gemini 최적)
 * @param maxPages 최대 처리 페이지 수
 */
export async function extractPagesFromPdf(
  pdfBuffer: ArrayBuffer,
  targetDpi = 200,
  maxPages = 10
): Promise<PdfExtractionResult> {
  const data = new Uint8Array(pdfBuffer);
  const pdf = await getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;

  const pageCount = pdf.numPages;
  const pagesToProcess = Math.min(pageCount, maxPages);
  const pages: PdfPageResult[] = [];

  for (let i = 1; i <= pagesToProcess; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: targetDpi / 72 }); // 72 DPI 기준 스케일

    // Node.js 환경에서 canvas 사용
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require("canvas");
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    // 배경 흰색
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const pngBuffer = canvas.toBuffer("image/png");
    const base64 = pngBuffer.toString("base64");

    pages.push({
      pageNumber: i,
      imageBase64: base64,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    });
  }

  // 도면 페이지 식별 (비-백색 픽셀 밀도가 높은 페이지)
  const bestPage = identifyFloorPlanPage(pages);

  return { pages, pageCount, bestFloorPlanPage: bestPage };
}

/**
 * 가장 도면일 가능성이 높은 페이지 식별
 * 비-백색 픽셀 밀도 기반
 */
function identifyFloorPlanPage(pages: PdfPageResult[]): number {
  if (pages.length <= 1) return 0;

  let bestIdx = 0;
  let bestDensity = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    try {
      // PNG 데이터 크기가 클수록 비-백색 컨텐츠가 많음 (크기 기반 추정)
      const dataSize = page.imageBase64.length;
      const pixelCount = page.width * page.height;
      const density = dataSize / pixelCount;

      if (density > bestDensity) {
        bestDensity = density;
        bestIdx = i;
      }
    } catch {
      // 분석 실패 시 스킵
    }
  }

  return bestIdx;
}

/**
 * 단일 페이지 PDF인지 확인하고, 단일이면 바로 이미지 반환
 */
export async function extractSinglePagePdf(
  pdfBuffer: ArrayBuffer,
  targetDpi = 200
): Promise<PdfPageResult | null> {
  const result = await extractPagesFromPdf(pdfBuffer, targetDpi, 1);
  return result.pages[0] || null;
}
