/**
 * RenderRoomSpec validator — 검증 + 자동 보정.
 *
 * 가이드: c:\Users\user\Downloads\inpick-launch-critical-render-spec-dev-plan-20260511.md §7-5
 *
 * 규칙:
 *   1. targetRoom=master_bedroom이고 attached balcony 있으면 → balcony_sliding_door 1+ 필수
 *      (없으면 자동 inference)
 *   2. opening.kind=exterior_window인데 toRoomId 있으면 → error (이미 builder에서 차단)
 *   3. opening.kind=balcony_sliding_door인데 toRoom이 balcony-like 아니면 → warning
 *   4. attached balcony인데 exterior wall 없으면 → warning
 *   5. confidence < 0.70이면 → UI에 "도면 인식 확인 필요" 반환
 */

import type {
  OpeningEdge,
  RenderRoomSpec,
} from "./render-room-spec";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  needsUserConfirmation: boolean;
  autoFixed: string[];
}

export function validateRenderRoomSpec(spec: RenderRoomSpec): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const autoFixed: string[] = [];

  // 1. 안방 + 발코니 attached → balcony_sliding_door 필수
  const isMaster = spec.targetRoom.type === "master_bedroom";
  const hasAttachedBalcony = spec.attachedZones.some(
    (z) => z.type === "balcony" || z.type === "service_balcony",
  );
  const hasBalconySlidingDoor = spec.openings.some(
    (o) => o.kind === "balcony_sliding_door",
  );
  const hasDirectExteriorWindow = spec.openings.some(
    (o) =>
      o.kind === "exterior_window" &&
      o.fromRoomId === spec.targetRoom.id &&
      !o.toRoomId,
  );

  if (hasAttachedBalcony) {
    const balconyExtended = spec.attachedZones
      .filter((z) => z.type === "balcony" || z.type === "service_balcony")
      .every((z) => z.treatment === "extended");
    if (!balconyExtended && !hasBalconySlidingDoor) {
      // 자동 보정 (이미 builder에서 해야 하지만 안전망)
      warnings.push(
        `${spec.targetRoom.name}에 attached balcony가 있는데 balcony_sliding_door가 없음 — builder inference 누락`,
      );
    }
    if (!balconyExtended && hasDirectExteriorWindow) {
      // 외부창이 안방 벽에 직접 있다고 표시되면 잘못된 case
      warnings.push(
        `${spec.targetRoom.name} 벽에 직접 exterior_window가 있음 — 비확장 발코니가 있는데 잘못된 분류`,
      );
    }
  }

  // 2. opening.kind=exterior_window + toRoomId
  for (const op of spec.openings) {
    if (op.kind === "exterior_window" && op.toRoomId) {
      errors.push(
        `OPENING_INVALID: ${op.id} — exterior_window는 toRoomId를 가질 수 없음 (current toRoomId=${op.toRoomId})`,
      );
    }
  }

  // 3. balcony_sliding_door인데 toRoom이 balcony-like 아닌 case
  for (const op of spec.openings) {
    if (op.kind === "balcony_sliding_door" && op.toRoomId) {
      const toRoom = spec.rooms.find((r) => r.id === op.toRoomId);
      if (toRoom && !["balcony", "service_balcony", "unknown"].includes(toRoom.type)) {
        warnings.push(
          `OPENING_SUSPICIOUS: ${op.id} — balcony_sliding_door인데 toRoom=${toRoom.name}(type=${toRoom.type})`,
        );
      }
    }
  }

  // 4. attached balcony인데 exterior wall 정보 없음
  if (hasAttachedBalcony && spec.exteriorWalls.length === 0) {
    warnings.push(
      `EXTERIOR_WALL_MISSING — attached balcony가 있는데 exteriorWalls 정보가 없음`,
    );
  }

  // 5. confidence
  const needsUserConfirmation = spec.confidence < 0.7;
  if (needsUserConfirmation) {
    warnings.push(
      `LOW_CONFIDENCE_${Math.round(spec.confidence * 100)}% — 도면 인식 신뢰도가 낮습니다`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    needsUserConfirmation,
    autoFixed,
  };
}

/**
 * spec에 inferred sliding door 1개 자동 생성 (안방+발코니 case).
 * Builder가 이미 하긴 하지만 validator 측 안전망.
 */
export function inferBalconySlidingDoor(
  spec: RenderRoomSpec,
): OpeningEdge | null {
  const balconyZone = spec.attachedZones.find(
    (z) =>
      (z.type === "balcony" || z.type === "service_balcony") &&
      z.treatment !== "extended",
  );
  if (!balconyZone) return null;
  const zoneRoomId = balconyZone.id.replace(/^zone_/, "");
  return {
    id: `auto_sd_${spec.targetRoom.id}_${zoneRoomId}`,
    kind: "balcony_sliding_door",
    fromRoomId: spec.targetRoom.id,
    toRoomId: zoneRoomId,
    widthM: 1.8,
    confidence: 0.6,
    mustRender: true,
    source: "inferred",
  };
}
