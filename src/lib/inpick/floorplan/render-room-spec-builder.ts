/**
 * RenderRoomSpec builder — 도면/방 정보 → 구조화된 spec.
 *
 * 가이드: c:\Users\user\Downloads\inpick-launch-critical-render-spec-dev-plan-20260511.md §7-4
 *
 * 흐름:
 *   1. target room 찾기 (name 또는 id)
 *   2. buildRoomGraph로 인접 그래프
 *   3. findAttachedZones로 부속 zone (안방발코니 등)
 *   4. opening 재분류 (classifyOpeningKind)
 *   5. extensionOptions resolve
 *   6. renderConstraints 생성 (mustShow / mustNotShow / camera)
 *   7. validator 실행 → 자동 inference 보정
 *   8. confidence/warnings 반환
 */

import type {
  AttachedZone,
  ExtensionOptions,
  OpeningEdge,
  OpeningKind,
  Point,
  RenderConstraints,
  RenderRoomSpec,
  RoomNode,
} from "./render-room-spec";
import {
  buildRoomGraph,
  findAttachedZones,
  type RoomGraphInputRoom,
} from "./room-graph";
import { classifyOpeningKind, validateOpeningKind } from "./opening-classifier";
import { isBalconyLike, normalizeRoomType } from "./room-label-normalizer";

// ─── 입력 ───
export interface ParsedFloorPlanLike {
  rooms?: RoomGraphInputRoom[];
  walls?: Array<{ id?: string; from?: Point; to?: Point }>;
  doors?: Array<{
    id?: string;
    fromRoomId?: string;
    toRoomId?: string;
    wallId?: string;
    rawSymbolType?: "door" | "sliding";
    widthMm?: number;
    isOnExteriorWall?: boolean;
  }>;
  windows?: Array<{
    id?: string;
    roomId?: string;
    wallId?: string;
    widthMm?: number;
    /** 외벽 창인지 — 미지정 시 true (모든 윈도우 외벽 가정) */
    isOnExteriorWall?: boolean;
    /** toRoom (만약 알 수 있다면 — 인접한 발코니 등 자동 추론) */
    toRoomId?: string;
  }>;
  openings?: Array<{
    id?: string;
    fromRoomId?: string;
    toRoomId?: string;
    wallId?: string;
    rawSymbolType?: "opening";
  }>;
}

export interface BuildRenderRoomSpecInput {
  parsedFloorPlan: ParsedFloorPlanLike;
  targetRoomName?: string;
  targetRoomId?: string;
  extensionOptions?: ExtensionOptions;
  /** 단일 expansion boolean (호환) */
  expansion?: boolean;
}

// ─── 메인 빌더 ───
export function buildRenderRoomSpec(input: BuildRenderRoomSpecInput): RenderRoomSpec {
  const warnings: string[] = [];
  const fpRooms = input.parsedFloorPlan?.rooms || [];

  // 1. RoomGraph 구축
  const graph = buildRoomGraph(fpRooms);

  // 2. target room 찾기
  let targetRoom: RoomNode | undefined;
  if (input.targetRoomId) {
    targetRoom = graph.rooms.find((r) => r.id === input.targetRoomId);
  }
  if (!targetRoom && input.targetRoomName) {
    const tn = input.targetRoomName.replace(/\s+/g, "").toLowerCase();
    targetRoom = graph.rooms.find(
      (r) =>
        r.name.replace(/\s+/g, "").toLowerCase() === tn ||
        r.name.replace(/\s+/g, "").toLowerCase().includes(tn),
    );
  }
  if (!targetRoom) {
    // 방 없으면 minimal spec (fallback)
    targetRoom = {
      id: "target_unknown",
      name: input.targetRoomName || "방",
      type: normalizeRoomType(input.targetRoomName || ""),
      confidence: 0.3,
    };
    warnings.push(`TARGET_ROOM_NOT_FOUND_IN_GRAPH: ${input.targetRoomName || "unknown"}`);
  }

  // 3. attachedZones (안방발코니 등)
  const attachedZones = findAttachedZones(targetRoom.id, graph);

  // 4. extensionOptions resolve
  const extensionOptions = resolveExtensionOptions({
    targetRoom,
    attachedZones,
    extensionOptions: input.extensionOptions,
    expansion: input.expansion,
  });

  // 5. attachedZones에 treatment 적용
  for (const zone of attachedZones) {
    zone.treatment = decideZoneTreatment(zone, targetRoom, extensionOptions);
  }

  // 6. opening 수집 + 재분류
  const openings = collectAndClassifyOpenings({
    parsedFloorPlan: input.parsedFloorPlan,
    targetRoom,
    attachedZones,
    rooms: graph.rooms,
  });

  // 7. exteriorWalls — 일단 비워둠 (후속 향상)
  const exteriorWalls = computeExteriorWalls({
    targetRoom,
    attachedZones,
    openings,
  });

  // 8. renderConstraints 생성 (안방발코니 hard constraint 포함)
  const renderConstraints = buildRenderConstraints({
    targetRoom,
    attachedZones,
    openings,
    extensionOptions,
  });

  // 9. confidence 계산
  const confidence = computeOverallConfidence({
    targetRoom,
    attachedZones,
    openings,
    warnings,
  });

  // 10. opening validation warnings 추가
  for (const op of openings) {
    const v = validateOpeningKind(op, graph.rooms);
    if (!v.valid) warnings.push(`OPENING_INVALID: ${op.id} — ${v.reason}`);
  }

  return {
    targetRoom,
    rooms: graph.rooms,
    attachedZones,
    openings,
    exteriorWalls,
    extensionOptions,
    renderConstraints,
    confidence,
    warnings,
  };
}

// ─── helpers ───

/**
 * extensionOptions resolve.
 * input.expansion (boolean)이 있으면 living/master에 적용.
 */
function resolveExtensionOptions(input: {
  targetRoom: RoomNode;
  attachedZones: AttachedZone[];
  extensionOptions?: ExtensionOptions;
  expansion?: boolean;
}): ExtensionOptions {
  const out: ExtensionOptions = { ...input.extensionOptions };
  // expansion boolean fallback
  if (input.expansion === true) {
    if (!out.livingRoomBalcony) out.livingRoomBalcony = "extended";
    if (!out.masterBedroomBalcony) out.masterBedroomBalcony = "extended";
  } else if (input.expansion === false) {
    if (!out.livingRoomBalcony) out.livingRoomBalcony = "unextended";
    if (!out.masterBedroomBalcony) out.masterBedroomBalcony = "unextended";
  }
  return out;
}

/**
 * attached zone treatment 결정.
 */
function decideZoneTreatment(
  zone: AttachedZone,
  targetRoom: RoomNode,
  ext: ExtensionOptions,
): AttachedZone["treatment"] {
  if (zone.type !== "balcony" && zone.type !== "service_balcony") return "unknown";
  if (targetRoom.type === "living_room") {
    return ext.livingRoomBalcony || "unknown";
  }
  if (targetRoom.type === "master_bedroom") {
    return ext.masterBedroomBalcony || "unknown";
  }
  if (targetRoom.type === "kitchen" && zone.type === "service_balcony") {
    return ext.kitchenServiceBalcony || "unknown";
  }
  if (targetRoom.type === "bedroom") {
    const map = ext.bedroomBalconies || {};
    return map[targetRoom.id] || map[targetRoom.name] || "unknown";
  }
  return "unknown";
}

/**
 * Opening 수집 + 재분류.
 *
 * 절대 규칙 (안방발코니 fix):
 *   - target + attached balcony 사이 opening 없으면 inferred sliding door 자동 생성
 *   - extension이 "extended"이면 sliding door 생성 X (벽 자체가 사라진 상태)
 */
function collectAndClassifyOpenings(input: {
  parsedFloorPlan: ParsedFloorPlanLike;
  targetRoom: RoomNode;
  attachedZones: AttachedZone[];
  rooms: RoomNode[];
}): OpeningEdge[] {
  const out: OpeningEdge[] = [];
  const fp = input.parsedFloorPlan;
  const target = input.targetRoom;
  const zoneIds = new Set(input.attachedZones.map((z) => z.attachedToRoomId === target.id ? z.id : null).filter(Boolean) as string[]);
  // attached zone room IDs (zone_xxx 형식이라 실제 room.id는 zone.id에서 prefix 제거)
  const zoneRoomIds = new Set(
    input.attachedZones.map((z) => z.id.replace(/^zone_/, "")),
  );

  // 1. doors (raw)
  for (const d of fp.doors || []) {
    const fromRoom = input.rooms.find((r) => r.id === d.fromRoomId);
    const toRoom = input.rooms.find((r) => r.id === d.toRoomId);
    if (!fromRoom) continue;
    // 타겟 또는 attached zone 관련만
    if (fromRoom.id !== target.id && !zoneRoomIds.has(fromRoom.id)) continue;

    const kind = classifyOpeningKind({
      fromRoom,
      toRoom,
      rawSymbolType: d.rawSymbolType || "door",
      isOnExteriorWall: d.isOnExteriorWall === true,
    });
    out.push({
      id: d.id || `door_${out.length}`,
      kind,
      fromRoomId: fromRoom.id,
      toRoomId: toRoom?.id,
      wallId: d.wallId,
      widthM: typeof d.widthMm === "number" ? d.widthMm / 1000 : undefined,
      confidence: 0.8,
      mustRender: true,
      source: "detected",
    });
  }

  // 2. windows (raw) — toRoom 추론 시도 (인접 발코니에 가까운 창은 발코니용 sliding door로 분류)
  for (const w of fp.windows || []) {
    const fromRoom = input.rooms.find((r) => r.id === w.roomId);
    if (!fromRoom) continue;
    if (fromRoom.id !== target.id && !zoneRoomIds.has(fromRoom.id)) continue;

    const toRoom = w.toRoomId ? input.rooms.find((r) => r.id === w.toRoomId) : undefined;
    const onExterior = w.isOnExteriorWall === undefined ? true : w.isOnExteriorWall;

    const kind = classifyOpeningKind({
      fromRoom,
      toRoom,
      rawSymbolType: "window",
      isOnExteriorWall: onExterior,
    });
    out.push({
      id: w.id || `window_${out.length}`,
      kind,
      fromRoomId: fromRoom.id,
      toRoomId: toRoom?.id,
      toExterior: !toRoom && onExterior,
      wallId: w.wallId,
      widthM: typeof w.widthMm === "number" ? w.widthMm / 1000 : undefined,
      confidence: 0.8,
      mustRender: true,
      source: "detected",
    });
  }

  // 3. raw openings (open passage 등)
  for (const o of fp.openings || []) {
    const fromRoom = input.rooms.find((r) => r.id === o.fromRoomId);
    const toRoom = input.rooms.find((r) => r.id === o.toRoomId);
    if (!fromRoom) continue;
    if (fromRoom.id !== target.id && !zoneRoomIds.has(fromRoom.id)) continue;
    const kind = classifyOpeningKind({
      fromRoom,
      toRoom,
      rawSymbolType: "opening",
      isOnExteriorWall: false,
    });
    out.push({
      id: o.id || `open_${out.length}`,
      kind,
      fromRoomId: fromRoom.id,
      toRoomId: toRoom?.id,
      wallId: o.wallId,
      confidence: 0.7,
      mustRender: true,
      source: "detected",
    });
  }

  // 4. 자동 inference — attached balcony zone 있는데 opening 없으면 sliding door 만들기
  for (const zone of input.attachedZones) {
    if (zone.type !== "balcony" && zone.type !== "service_balcony") continue;
    if (zone.treatment === "extended") continue; // 확장 — 벽/문 없음
    const zoneRoomId = zone.id.replace(/^zone_/, "");
    const hasOpening = out.some(
      (op) =>
        ((op.fromRoomId === target.id && op.toRoomId === zoneRoomId) ||
          (op.fromRoomId === zoneRoomId && op.toRoomId === target.id)) &&
        op.kind === "balcony_sliding_door",
    );
    if (!hasOpening) {
      out.push({
        id: `inferred_sd_${target.id}_${zoneRoomId}`,
        kind: "balcony_sliding_door",
        fromRoomId: target.id,
        toRoomId: zoneRoomId,
        widthM: 1.8, // 표준 거실/안방 발코니 미닫이문
        confidence: 0.65,
        mustRender: true,
        source: "inferred",
      });
      // 발코니 zone에 access opening 연결
      zone.accessOpeningId = `inferred_sd_${target.id}_${zoneRoomId}`;
    }
  }

  return out;
}

/**
 * exteriorWalls — 발코니 외벽에 외부창이 있다고 명시.
 */
function computeExteriorWalls(input: {
  targetRoom: RoomNode;
  attachedZones: AttachedZone[];
  openings: OpeningEdge[];
}): RenderRoomSpec["exteriorWalls"] {
  const out: RenderRoomSpec["exteriorWalls"] = [];
  // attached balcony → 외벽에 창 있음
  for (const zone of input.attachedZones) {
    if (zone.type !== "balcony" && zone.type !== "service_balcony") continue;
    if (zone.treatment === "extended") {
      // 확장이면 발코니 외벽이 → 안방 외벽 역할
      out.push({
        wallId: `exterior_of_${zone.id}_now_${input.targetRoom.id}`,
        roomId: input.targetRoom.id,
        hasExteriorWindow: true,
        confidence: 0.7,
      });
    } else {
      // 비확장 — 발코니 외벽에 창
      out.push({
        wallId: `exterior_of_${zone.id}`,
        roomId: zone.id.replace(/^zone_/, ""),
        hasExteriorWindow: true,
        confidence: 0.8,
      });
    }
  }
  return out;
}

/**
 * renderConstraints 생성 — 안방발코니 hard constraint 포함.
 */
function buildRenderConstraints(input: {
  targetRoom: RoomNode;
  attachedZones: AttachedZone[];
  openings: OpeningEdge[];
  extensionOptions: ExtensionOptions;
}): RenderConstraints {
  const mustShow: string[] = [];
  const mustNotShow: string[] = [];
  const target = input.targetRoom;

  const attachedBalcony = input.attachedZones.find(
    (z) => z.type === "balcony" || z.type === "service_balcony",
  );

  // 일반 case
  mustShow.push(`Target room: ${target.name} / ${target.type}`);

  // 안방발코니 (또는 거실발코니 등) attached + 비확장
  if (attachedBalcony && attachedBalcony.treatment !== "extended") {
    mustShow.push(
      `${target.name}와 ${attachedBalcony.name} 사이의 내부 미닫이 유리문 (interior sliding glass balcony door)`,
    );
    mustShow.push(
      `미닫이문 너머의 분리된 발코니 공간 (narrow enclosed balcony beyond the sliding door)`,
    );
    mustShow.push(
      `외부 창은 ${target.name} 벽이 아니라 ${attachedBalcony.name} 바깥쪽 벽에 위치`,
    );

    mustNotShow.push(
      `Do not render a direct exterior bedroom window on the ${target.name} wall.`,
    );
    mustNotShow.push(
      `Do not collapse the balcony into a simple window.`,
    );
    mustNotShow.push(
      `Do not remove the balcony space.`,
    );
    mustNotShow.push(
      `${target.name} 벽에 외부 창문이 직접 붙은 것처럼 표현하지 말 것.`,
    );
  }

  // 확장 case
  if (attachedBalcony && attachedBalcony.treatment === "extended") {
    mustShow.push(
      `확장된 ${target.name} 공간 — 원래 ${attachedBalcony.name} 영역이 ${target.name}에 편입됨`,
    );
    mustShow.push(
      `외부 창은 확장된 영역의 외벽에 위치 (exterior window on the extended outer wall)`,
    );
    mustNotShow.push(
      `Do not render an interior sliding door between ${target.name} and the former balcony.`,
    );
    mustNotShow.push(
      `Do not render a separate balcony space behind a door.`,
    );
  }

  const cameraFacing: RenderConstraints["cameraFacing"] = attachedBalcony
    ? "balcony_wall"
    : "main_wall";

  // 한국어 설명 (UI 표시용)
  let explanationKo = `${target.name} 렌더링 기준입니다.`;
  if (attachedBalcony) {
    if (attachedBalcony.treatment === "extended") {
      explanationKo = `${target.name}에 ${attachedBalcony.name}이 확장된 상태로 인식했습니다. 외부 창은 확장된 외벽에 위치합니다.`;
    } else if (attachedBalcony.treatment === "unextended") {
      explanationKo = `${target.name}에 ${attachedBalcony.name}이 비확장 상태로 인식했습니다. ${target.name}과 ${attachedBalcony.name} 사이의 미닫이문과 분리된 발코니 공간이 반영됩니다.`;
    } else {
      explanationKo = `${target.name}에 ${attachedBalcony.name}이 연결된 것으로 인식했습니다. 확장 여부 확인이 필요합니다.`;
    }
  }

  return {
    mustShow,
    mustNotShow,
    cameraFacing,
    explanationKo,
  };
}

/**
 * 전체 confidence — target + attached + opening 평균.
 */
function computeOverallConfidence(input: {
  targetRoom: RoomNode;
  attachedZones: AttachedZone[];
  openings: OpeningEdge[];
  warnings: string[];
}): number {
  const scores: number[] = [];
  if (input.targetRoom.confidence) scores.push(input.targetRoom.confidence);
  for (const z of input.attachedZones) scores.push(z.confidence);
  for (const o of input.openings) scores.push(o.confidence);
  if (scores.length === 0) return 0.5;
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  // warnings 있으면 confidence 감소
  const penalty = Math.min(0.3, input.warnings.length * 0.1);
  return Math.max(0, Math.min(1, avg - penalty));
}
