/**
 * Segmentation provider 인터페이스 — 가이드 §3 Tech Stack과 일관.
 * 두 구현체:
 *   - gpt-4o-vision: GPT-4o가 polygon 좌표를 JSON으로 직접 출력 (인프라 없음, 정확도 낮음)
 *   - sam-2.1: Replicate.com SAM 2 API → mask → contour tracing → polygon (정확도 높음)
 *
 * 환경변수 SEGMENTATION_PROVIDER 로 swap. 기본값은 gpt-4o-vision.
 */
import type { SegmentationData } from "@/types/segmentation";

export interface SegmentInput {
  imageUrl: string;
  imageBase64?: string;
  roomName?: string;
  realWorldAreaSqm?: number;
}

export interface SegmentationProvider {
  name: "gpt-4o-vision" | "sam-2.1" | "sam-3";
  segment(input: SegmentInput): Promise<SegmentationData>;
}

export function pickProvider(): "gpt-4o-vision" | "sam-2.1" {
  const v = (process.env.SEGMENTATION_PROVIDER || "").toLowerCase().trim();
  if (v === "sam-2.1" || v === "sam2" || v === "sam") {
    if (!process.env.REPLICATE_API_TOKEN) {
      console.warn("[seg] SEGMENTATION_PROVIDER=sam-2.1 but REPLICATE_API_TOKEN missing — falling back to gpt-4o-vision");
      return "gpt-4o-vision";
    }
    return "sam-2.1";
  }
  return "gpt-4o-vision";
}
