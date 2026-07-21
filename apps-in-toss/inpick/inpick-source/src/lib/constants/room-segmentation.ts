/**
 * 방 세그멘테이션 색상 팔레트
 * Gemini가 생성하는 마스크 이미지에서 각 방에 할당하는 고정 RGB 값
 * 색상 간 거리를 최대화하여 픽셀 매칭 정확도 보장
 */

export const ROOM_TYPE_COLORS = {
  living:     { hex: "#FF0000", rgb: [255, 0, 0] as const,     label: "거실" },
  bedroom1:   { hex: "#00FF00", rgb: [0, 255, 0] as const,     label: "침실1" },
  bedroom2:   { hex: "#0000FF", rgb: [0, 0, 255] as const,     label: "침실2" },
  bedroom3:   { hex: "#FFFF00", rgb: [255, 255, 0] as const,   label: "침실3" },
  kitchen:    { hex: "#FF00FF", rgb: [255, 0, 255] as const,   label: "주방" },
  bathroom1:  { hex: "#00FFFF", rgb: [0, 255, 255] as const,   label: "욕실1" },
  bathroom2:  { hex: "#FF8000", rgb: [255, 128, 0] as const,   label: "욕실2" },
  entrance:   { hex: "#8000FF", rgb: [128, 0, 255] as const,   label: "현관" },
  balcony1:   { hex: "#00FF80", rgb: [0, 255, 128] as const,   label: "발코니1" },
  balcony2:   { hex: "#FF0080", rgb: [255, 0, 128] as const,   label: "발코니2" },
  utility:    { hex: "#80FF00", rgb: [128, 255, 0] as const,   label: "다용도실" },
  dressroom:  { hex: "#0080FF", rgb: [0, 128, 255] as const,   label: "드레스룸" },
  hallway:    { hex: "#808080", rgb: [128, 128, 128] as const, label: "복도" },
} as const;

export type RoomTypeKey = keyof typeof ROOM_TYPE_COLORS;

/** 세그멘테이션 마스크에서 식별된 방 하나 */
export interface SegmentedRoom {
  type: RoomTypeKey;
  color: string;
  label: string;
}

/** DB room_color_map JSONB에 저장되는 구조 */
export interface RoomColorMap {
  rooms: SegmentedRoom[];
  maskWidth: number;
  maskHeight: number;
}

/**
 * 방 타입 → 자재 카테고리 매핑
 * 바닥재 오버레이를 위한 매핑: 각 방 타입에 어떤 카테고리 자재를 입힐지 결정
 */
export const ROOM_FLOOR_CATEGORY: Record<RoomTypeKey, string | null> = {
  living:    "FLOORING",
  bedroom1:  "FLOORING",
  bedroom2:  "FLOORING",
  bedroom3:  "FLOORING",
  kitchen:   "FLOORING",
  bathroom1: "BATH_TILE",
  bathroom2: "BATH_TILE",
  entrance:  "FLOORING",
  balcony1:  null,
  balcony2:  null,
  utility:   null,
  dressroom: "FLOORING",
  hallway:   "FLOORING",
};

/** hex 문자열을 [R, G, B] 튜플로 변환 */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
