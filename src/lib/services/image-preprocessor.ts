// src/lib/services/image-preprocessor.ts
// 이미지 전처리 (서버사이드, Gemini 입력 최적화)

export type ImageSource = "pdf" | "photo" | "scan";

export interface PreprocessResult {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

const MAX_DIMENSION = 2048; // Gemini Vision 최적 크기

/**
 * 도면 이미지 전처리
 * - PDF 출력: 리사이즈만 (벡터 렌더링이라 깨끗)
 * - 사진/스캔: 그레이스케일 + 대비 강화 + 리사이즈
 */
export async function preprocessFloorPlanImage(
  imageBuffer: Buffer,
  source: ImageSource = "pdf"
): Promise<PreprocessResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas, loadImage } = require("canvas");

  // Buffer → Image
  const img = await loadImage(imageBuffer);
  const origW = img.width;
  const origH = img.height;

  // 리사이즈 비율 계산
  let scale = 1;
  if (origW > MAX_DIMENSION || origH > MAX_DIMENSION) {
    scale = Math.min(MAX_DIMENSION / origW, MAX_DIMENSION / origH);
  }

  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);

  const canvas = createCanvas(newW, newH);
  const ctx = canvas.getContext("2d");

  // 배경 흰색
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, newW, newH);

  // 이미지 그리기
  ctx.drawImage(img, 0, 0, newW, newH);

  // 사진/스캔 소스면 그레이스케일 + 대비 강화
  if (source === "photo" || source === "scan") {
    const imageData = ctx.getImageData(0, 0, newW, newH);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // 그레이스케일 변환
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

      // 대비 강화 (contrast stretch)
      const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));

      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  const pngBuffer = canvas.toBuffer("image/png");

  return {
    base64: pngBuffer.toString("base64"),
    mimeType: "image/png",
    width: newW,
    height: newH,
  };
}

/**
 * base64 이미지가 Gemini 크기 제한 이내인지 확인
 * Gemini 최대 입력: ~20MB (base64 인코딩 후)
 */
export function isImageSizeValid(base64: string): boolean {
  const sizeBytes = (base64.length * 3) / 4;
  return sizeBytes < 20 * 1024 * 1024; // 20MB
}

/**
 * 파일 확장자 → MIME 타입 매핑
 */
export function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "pdf":
      return "application/pdf";
    default:
      return "image/png";
  }
}
