/**
 * Segmentation provider 인터페이스.
 *
 * 가이드(InPick_STEP02_Workflow.md) 정책:
 *   - SAM 2.1은 별도 GPU 서버에서 직접 운영 (Replicate / 외부 SaaS 일체 금지)
 *   - GPU 서버 미준비 단계에서는 OpenAI frontier Vision provider를 사용
 *   - 추후 별도 GPU 서버 endpoint 만들면 sam-direct-provider.ts 추가
 */
import type { SegmentationData } from "@/types/segmentation";

export interface SegmentInput {
  imageUrl: string;
  imageBase64?: string;
  roomName?: string;
  realWorldAreaSqm?: number;
}

export interface SegmentationProvider {
  name: "gpt-4o-vision" | "sam-2.1-direct";
  segment(input: SegmentInput): Promise<SegmentationData>;
}

/** 하위 호환용 provider key는 유지하지만 실제 모델은 공통 frontier 정책을 따른다. */
export function pickProvider(): "gpt-4o-vision" {
  return "gpt-4o-vision";
}
