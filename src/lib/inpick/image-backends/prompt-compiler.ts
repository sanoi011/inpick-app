/**
 * Prompt compiler — RenderRoomSpec → OpenAI/RunPod prompt.
 *
 * 가이드: c:\Users\user\Downloads\inpick-launch-critical-render-spec-dev-plan-20260511.md §7-6
 *
 * 정책:
 *   - ARCHITECTURAL FACTS를 style보다 앞에 둠 (모델이 무시하기 어렵게)
 *   - MUST NOT SHOW 명시 (특히 안방 벽 직접 창 금지)
 *   - wallLayout 자연어 < RenderRoomSpec 구조화 우선
 *   - OpenAI와 RunPod 동일 compiler 사용
 */

import type {
  RenderRoomSpec,
  OpeningEdge,
  AttachedZone,
} from "@/lib/inpick/floorplan/render-room-spec";

export interface CompilePromptInput {
  /** 사용자 자유 입력 prompt (style/mood) */
  userPrompt?: string;
  /** Step1/2에서 결정된 style preset */
  stylePrompt?: string;
  /** 타겟 방 한국어 이름 */
  roomName: string;
  /** RenderRoomSpec (있으면 hard constraint 적용) */
  renderRoomSpec?: RenderRoomSpec;
  /** legacy wallLayout 자연어 (renderRoomSpec 없을 때만 사용) */
  wallLayout?: string;
}

/**
 * 컴파일된 prompt 반환.
 *
 * 구조:
 *   1. SYSTEM intro
 *   2. ARCHITECTURAL FACTS (RenderRoomSpec 기반)
 *   3. MUST SHOW
 *   4. MUST NOT SHOW
 *   5. STYLE
 *   6. QUALITY
 */
export function compileRenderPrompt(input: CompilePromptInput): string {
  const lines: string[] = [];

  // ─── 1. SYSTEM intro ───
  lines.push(
    "You are generating a realistic Korean apartment interior render.",
    "",
  );

  // ─── 2. ARCHITECTURAL FACTS ───
  const spec = input.renderRoomSpec;
  if (spec) {
    lines.push("ARCHITECTURAL FACTS — FOLLOW THESE BEFORE STYLE:");
    lines.push(
      `- Target room: ${spec.targetRoom.name} / ${spec.targetRoom.type}.`,
    );
    if (spec.targetRoom.bbox) {
      lines.push(
        `- Target room measured box: x=${spec.targetRoom.bbox.x.toFixed(2)}m, y=${spec.targetRoom.bbox.y.toFixed(2)}m, width=${spec.targetRoom.bbox.width.toFixed(2)}m, depth=${spec.targetRoom.bbox.height.toFixed(2)}m.`,
      );
    }
    if (spec.targetRoom.areaM2) {
      lines.push(`- Target room floor area: ${spec.targetRoom.areaM2.toFixed(2)}m².`);
    }
    const mappedRooms = spec.rooms.filter(
      (room) => room.bbox || room.polygon || room.areaM2,
    );
    if (mappedRooms.length > 0) {
      lines.push("- Selected unit room map (do not replace with a standard apartment):");
      for (const room of mappedRooms) {
        const box = room.bbox
          ? ` bbox=(${room.bbox.x.toFixed(2)},${room.bbox.y.toFixed(2)}) ${room.bbox.width.toFixed(2)}×${room.bbox.height.toFixed(2)}m`
          : "";
        const polygon = room.polygon?.length
          ? ` polygon=${room.polygon.length} vertices`
          : "";
        const area = room.areaM2 ? ` area=${room.areaM2.toFixed(2)}m²` : "";
        lines.push(`  - ${room.name} / ${room.type}:${box}${polygon}${area}`);
      }
    }

    // attachedZones
    for (const zone of spec.attachedZones) {
      lines.push(
        `- Attached zone: ${zone.name} / ${zone.type} (${zone.treatment}).`,
      );
    }

    // openings — interior balcony sliding door 강조
    const balconyDoors = spec.openings.filter(
      (o) => o.kind === "balcony_sliding_door",
    );
    for (const op of balconyDoors) {
      const toRoom = spec.rooms.find((r) => r.id === op.toRoomId);
      lines.push(
        `- The opening between ${spec.targetRoom.name} and ${toRoom?.name || "balcony"} is an INTERIOR sliding glass balcony door.`,
      );
      lines.push(`- This opening is NOT an exterior window.`);
    }

    // exterior walls (발코니 외벽에 외부창)
    const balconyExtWalls = spec.exteriorWalls.filter(
      (w) => w.hasExteriorWindow && w.roomId !== spec.targetRoom.id,
    );
    for (const w of balconyExtWalls) {
      const room = spec.rooms.find((r) => r.id === w.roomId);
      if (room) {
        lines.push(
          `- The exterior window belongs to the outer wall of ${room.name} (not ${spec.targetRoom.name}).`,
        );
      }
    }

    lines.push("");

    // ─── 3. MUST SHOW ───
    if (spec.renderConstraints.mustShow.length > 0) {
      lines.push("MUST SHOW:");
      spec.renderConstraints.mustShow.forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    // ─── 4. MUST NOT SHOW ───
    if (spec.renderConstraints.mustNotShow.length > 0) {
      lines.push("MUST NOT SHOW:");
      spec.renderConstraints.mustNotShow.forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    // ─── camera ───
    if (
      spec.renderConstraints.cameraFacing &&
      spec.renderConstraints.cameraFacing !== "unknown"
    ) {
      lines.push(
        `CAMERA: facing ${spec.renderConstraints.cameraFacing} of the room.`,
      );
      lines.push("");
    }
  } else if (input.wallLayout) {
    // legacy fallback — wallLayout 자연어 그대로
    lines.push("WALL LAYOUT (legacy):");
    lines.push(input.wallLayout);
    lines.push("");
  }

  // ─── 5. STYLE ───
  if (input.userPrompt || input.stylePrompt) {
    lines.push("STYLE:");
    if (input.stylePrompt) lines.push(`- ${input.stylePrompt}`);
    if (input.userPrompt) lines.push(`- ${input.userPrompt}`);
    lines.push("");
  }

  // ─── 6. QUALITY ───
  lines.push("QUALITY:");
  lines.push("- Photorealistic Korean apartment interior");
  lines.push("- Realistic proportions and ceiling height ~2400mm");
  lines.push("- No extra rooms, no impossible windows");
  lines.push("- Natural daylight, eye-level wide angle");
  lines.push("- Clear visible floor, walls, ceiling (for segmentation accuracy)");

  return lines.join("\n");
}

/**
 * 디버그/로깅용 — spec 요약 한 줄.
 */
export function renderSpecToBriefSummary(spec: RenderRoomSpec): string {
  const parts: string[] = [];
  parts.push(`target=${spec.targetRoom.name}`);
  if (spec.attachedZones.length > 0) {
    parts.push(
      `attached=[${spec.attachedZones.map((z) => `${z.name}:${z.treatment}`).join(", ")}]`,
    );
  }
  const openings = spec.openings.map((o) => o.kind).join("/");
  parts.push(`openings=[${openings}]`);
  parts.push(`conf=${Math.round(spec.confidence * 100)}%`);
  return parts.join(" ");
}
