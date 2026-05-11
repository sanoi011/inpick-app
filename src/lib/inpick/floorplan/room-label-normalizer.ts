/**
 * Room label normalizer — 한국어 방 이름 → RoomType.
 *
 * 가이드: c:\Users\user\Downloads\inpick-launch-critical-render-spec-dev-plan-20260511.md §7-1
 *
 * 정책:
 *   - 안방 / 안방발코니 / 베란다 / 서비스발코니 / 대피공간 / 실외기실 등 한국 아파트 용어 정확 매핑
 *   - 발코니 계열은 isBalconyLike()로 통합 판정 (opening classifier에서 사용)
 */

import type { RoomNode, RoomType } from "./render-room-spec";

export function normalizeRoomType(name: string): RoomType {
  const text = (name || "").replace(/\s+/g, "").toLowerCase();

  if (/안방|부부침실|master/.test(text)) return "master_bedroom";
  if (/현관|entrance|entry/.test(text)) return "entrance";
  if (/거실|living/.test(text)) return "living_room";
  if (/주방|부엌|kitchen/.test(text)) return "kitchen";
  if (/욕실|화장실|bath|wc|toilet/.test(text)) return "bathroom";
  if (/드레스|dress|walkin|workclos/.test(text)) return "dress_room";
  if (/다용도|utility|세탁|laundry|pantry/.test(text)) return "utility";
  if (/실외기|기계실|mechanical/.test(text)) return "mechanical_room";
  if (/대피/.test(text)) return "evacuation_space";
  if (/발코니|베란다|balcony|veranda/.test(text)) {
    if (/서비스|주방|다용도|sub|service/.test(text)) return "service_balcony";
    return "balcony";
  }
  if (/복도|hall|corridor/.test(text)) return "corridor";
  if (/창고|수납|closet|storage/.test(text)) return "closet";
  // 침실 (안방 외) — 침실/방/bedroom
  if (/침실|방\d|작은방|bedroom/.test(text)) return "bedroom";

  return "unknown";
}

/**
 * 발코니/베란다/대피공간/실외기실 = 외기에 면한 attached zone.
 * opening classifier에서 이들로 향하는 opening은 절대 exterior_window가 아니라
 * balcony_sliding_door로 분류한다.
 */
export function isBalconyLike(room: Pick<RoomNode, "name" | "type">): boolean {
  const text = `${room.name || ""} ${room.type || ""}`.replace(/\s+/g, "").toLowerCase();
  return /발코니|베란다|balcony|veranda|서비스발코니|대피공간|실외기실/.test(text);
}

/**
 * 메인 거주공간에 부속된 서비스 공간 (발코니 + 다용도실 + 드레스룸 + 창고 + 대피공간 + 실외기실).
 * attachedZones 후보 결정용.
 */
export function isAttachedServiceZone(room: Pick<RoomNode, "name" | "type">): boolean {
  if (isBalconyLike(room)) return true;
  return [
    "utility",
    "service_balcony",
    "closet",
    "dress_room",
    "evacuation_space",
    "mechanical_room",
  ].includes(room.type);
}

/**
 * 안방발코니/거실발코니/주방다용도실 같은 "내부 명칭"을 본 방 type에 따라 추정.
 * 예: "안방발코니" → balcony (attached to master_bedroom)
 */
export function inferAttachedTargetType(zoneName: string): RoomType | null {
  const t = (zoneName || "").replace(/\s+/g, "").toLowerCase();
  if (/안방/.test(t) && /발코니|베란다/.test(t)) return "master_bedroom";
  if (/거실/.test(t) && /발코니|베란다/.test(t)) return "living_room";
  if (/주방|부엌/.test(t) && /다용도|발코니|베란다/.test(t)) return "kitchen";
  if (/침실/.test(t) && /발코니|베란다/.test(t)) return "bedroom";
  return null;
}

/**
 * UI 표시용 한국어 이름.
 */
export function roomTypeToKorean(type: RoomType): string {
  const map: Record<RoomType, string> = {
    living_room: "거실",
    master_bedroom: "안방",
    bedroom: "침실",
    kitchen: "주방",
    bathroom: "욕실",
    balcony: "발코니",
    service_balcony: "서비스발코니",
    utility: "다용도실",
    closet: "창고",
    corridor: "복도",
    dress_room: "드레스룸",
    evacuation_space: "대피공간",
    mechanical_room: "실외기실",
    entrance: "현관",
    unknown: "기타",
  };
  return map[type] || "기타";
}
