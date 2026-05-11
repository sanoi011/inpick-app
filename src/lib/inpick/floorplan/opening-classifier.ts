/**
 * Opening classifier — opening의 kind를 결정.
 *
 * 가이드: c:\Users\user\Downloads\inpick-launch-critical-render-spec-dev-plan-20260511.md §7-3
 *
 * **핵심 절대 규칙 (안방발코니 문제 fix)**:
 *   1. toRoomId가 있으면 exterior_window가 될 수 없다.
 *   2. toRoom이 balcony-like (발코니/베란다/대피공간/실외기실)면
 *      rawSymbolType이 window여도 → balcony_sliding_door로 분류.
 *   3. 안방과 안방발코니 사이 opening은 exterior_window로 분류하지 않는다.
 */

import type { OpeningKind, RoomNode } from "./render-room-spec";
import { isBalconyLike } from "./room-label-normalizer";

export interface ClassifyOpeningInput {
  fromRoom: RoomNode;
  toRoom?: RoomNode;
  /** 도면 인식으로 얻은 raw 심볼 종류 (없으면 unknown) */
  rawSymbolType?: "door" | "window" | "opening" | "sliding" | "unknown";
  /** 이 opening이 외벽에 있는지 (외부창 가능성) */
  isOnExteriorWall: boolean;
}

/**
 * Opening kind 결정.
 * 우선순위:
 *   1. toRoom이 balcony-like → balcony_sliding_door (raw가 window여도 강제)
 *   2. toRoom이 dress_room → sliding_door
 *   3. toRoom 있고 외벽 아님 → interior_door (raw=opening이면 open_passage, raw=sliding이면 sliding_door)
 *   4. toRoom 없고 외벽 → exterior_window
 *   5. 그 외 → unknown
 */
export function classifyOpeningKind(input: ClassifyOpeningInput): OpeningKind {
  // 1. balcony-like target → 가장 우선 (안방발코니 fix 핵심)
  if (input.toRoom && isBalconyLike(input.toRoom)) {
    return "balcony_sliding_door";
  }

  // 2. dress room → sliding door
  if (input.toRoom && input.toRoom.type === "dress_room") {
    return "sliding_door";
  }

  // 3. 내부 연결 (외벽 아님)
  if (input.toRoom && !input.isOnExteriorWall) {
    if (input.rawSymbolType === "opening") return "open_passage";
    if (input.rawSymbolType === "sliding") return "sliding_door";
    return "interior_door";
  }

  // 4. 외부 창 (toRoom 없음 + 외벽)
  if (input.isOnExteriorWall && !input.toRoom) {
    return "exterior_window";
  }

  // 5. closet (작은 수납/창고)
  if (input.toRoom && input.toRoom.type === "closet") {
    return "closet_door";
  }

  return "unknown";
}

/**
 * 절대 규칙 검증 — opening이 invalid한 경우 메시지 반환.
 *
 * 출시 v0 hard constraint:
 *   - kind=exterior_window인데 toRoomId가 있으면 invalid
 *   - 안방 → 안방발코니에 kind=exterior_window이면 invalid (절대 규칙 1, 3)
 */
export function validateOpeningKind(opening: {
  kind: OpeningKind;
  fromRoomId: string;
  toRoomId?: string;
}, rooms: RoomNode[]): { valid: boolean; reason?: string } {
  if (opening.kind === "exterior_window" && opening.toRoomId) {
    return {
      valid: false,
      reason: "EXTERIOR_WINDOW_HAS_TO_ROOM — exterior_window는 toRoomId를 가질 수 없음",
    };
  }
  if (opening.toRoomId && opening.kind !== "balcony_sliding_door") {
    const toRoom = rooms.find((r) => r.id === opening.toRoomId);
    if (toRoom && isBalconyLike(toRoom)) {
      return {
        valid: false,
        reason: `MISCLASSIFIED_BALCONY_OPENING — ${toRoom.name}는 balcony-like인데 kind=${opening.kind}`,
      };
    }
  }
  return { valid: true };
}
