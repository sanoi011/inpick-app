/**
 * RenderRoomSpec 테스트 (launch-critical).
 *
 * 가이드: docs/launch/LAUNCH_ERROR_AUDIT_20260511.md
 *
 * 케이스:
 *   1. 안방 + 안방발코니 비확장 → balcony_sliding_door 분류 + exterior_window 금지
 *   2. 안방 + 안방발코니 확장 → 미닫이문 없음 + 확장된 공간 mustShow
 *   3. 일반 침실 + 외벽 창 → attachedZones 없음 + exterior_window 분류
 *   4. 주방 + 다용도실 → attachedZones에 utility + interior_door/sliding_door
 *   5. 거실 + 거실발코니 → balcony_sliding_door
 *
 * 실행: npx jest render-room-spec.test.ts
 * 또는: npx vitest run render-room-spec.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  buildRenderRoomSpec,
  type ParsedFloorPlanLike,
} from "../render-room-spec-builder";
import { validateRenderRoomSpec } from "../render-spec-validator";
import { compileRenderPrompt } from "@/lib/inpick/image-backends/prompt-compiler";

// ─── Fixture 헬퍼 ───
function makeFloorPlan(rooms: Array<{ id: string; name: string }>): ParsedFloorPlanLike {
  return {
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      // 간단 polygon — 일렬로 배치해서 인접 판정
      polygon: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    })),
    doors: [],
    windows: [],
    openings: [],
  };
}

describe("RenderRoomSpec — 안방 + 안방발코니 비확장", () => {
  it("attached balcony 감지 + balcony_sliding_door inferred + exterior_window 금지", () => {
    const fp = makeFloorPlan([
      { id: "r1", name: "안방" },
      { id: "r2", name: "안방발코니" },
    ]);
    const spec = buildRenderRoomSpec({
      parsedFloorPlan: fp,
      targetRoomName: "안방",
      extensionOptions: { masterBedroomBalcony: "unextended" },
    });

    // attached zone 존재
    expect(spec.attachedZones.length).toBeGreaterThan(0);
    expect(
      spec.attachedZones.some(
        (z) => z.name.includes("안방발코니") && z.type === "balcony",
      ),
    ).toBe(true);

    // treatment = unextended
    const zone = spec.attachedZones.find((z) => z.name.includes("안방발코니"));
    expect(zone?.treatment).toBe("unextended");

    // balcony_sliding_door 자동 생성됨
    const slidingDoors = spec.openings.filter(
      (o) => o.kind === "balcony_sliding_door",
    );
    expect(slidingDoors.length).toBeGreaterThan(0);

    // 타겟 방에 direct exterior_window 없음
    const directExtWin = spec.openings.find(
      (o) =>
        o.kind === "exterior_window" &&
        o.fromRoomId === spec.targetRoom.id &&
        !o.toRoomId,
    );
    expect(directExtWin).toBeUndefined();

    // mustShow에 미닫이문 + 발코니 공간 포함
    const mustShowJoined = spec.renderConstraints.mustShow.join(" ");
    expect(mustShowJoined).toContain("미닫이");
    expect(mustShowJoined).toContain("발코니");

    // mustNotShow에 안방 벽 직접 창문 금지
    const mustNotJoined = spec.renderConstraints.mustNotShow.join(" ");
    expect(mustNotJoined.toLowerCase()).toContain("balcony");
  });

  it("validator pass", () => {
    const fp = makeFloorPlan([
      { id: "r1", name: "안방" },
      { id: "r2", name: "안방발코니" },
    ]);
    const spec = buildRenderRoomSpec({
      parsedFloorPlan: fp,
      targetRoomName: "안방",
      extensionOptions: { masterBedroomBalcony: "unextended" },
    });
    const v = validateRenderRoomSpec(spec);
    expect(v.errors.length).toBe(0);
  });

  it("prompt compiler — ARCHITECTURAL FACTS 포함", () => {
    const fp = makeFloorPlan([
      { id: "r1", name: "안방" },
      { id: "r2", name: "안방발코니" },
    ]);
    const spec = buildRenderRoomSpec({
      parsedFloorPlan: fp,
      targetRoomName: "안방",
      extensionOptions: { masterBedroomBalcony: "unextended" },
    });
    const prompt = compileRenderPrompt({
      userPrompt: "modern minimal",
      roomName: "안방",
      renderRoomSpec: spec,
    });
    expect(prompt).toContain("ARCHITECTURAL FACTS");
    expect(prompt).toContain("MUST SHOW");
    expect(prompt).toContain("MUST NOT SHOW");
    expect(prompt).toContain("INTERIOR sliding glass balcony door");
    expect(prompt).toContain("NOT an exterior window");
  });
});

describe("RenderRoomSpec — 안방 + 안방발코니 확장", () => {
  it("미닫이문 없음 + 확장된 공간 mustShow", () => {
    const fp = makeFloorPlan([
      { id: "r1", name: "안방" },
      { id: "r2", name: "안방발코니" },
    ]);
    const spec = buildRenderRoomSpec({
      parsedFloorPlan: fp,
      targetRoomName: "안방",
      extensionOptions: { masterBedroomBalcony: "extended" },
    });

    const zone = spec.attachedZones.find((z) => z.name.includes("안방발코니"));
    expect(zone?.treatment).toBe("extended");

    // 확장이면 sliding door inference 안 함
    const sd = spec.openings.find((o) => o.kind === "balcony_sliding_door");
    expect(sd).toBeUndefined();

    const mustShowJoined = spec.renderConstraints.mustShow.join(" ");
    expect(mustShowJoined).toContain("확장");
  });
});

describe("RenderRoomSpec — 일반 침실 (attached balcony 없음)", () => {
  it("attached zone 없음 + 외부 창 분류", () => {
    const fp: ParsedFloorPlanLike = {
      rooms: [
        {
          id: "r1",
          name: "침실1",
          polygon: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
        },
        {
          id: "r2",
          name: "거실",
          polygon: [
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 1 },
            { x: 1, y: 1 },
          ],
        },
      ],
      windows: [
        {
          id: "w1",
          roomId: "r1",
          isOnExteriorWall: true,
        },
      ],
    };
    const spec = buildRenderRoomSpec({
      parsedFloorPlan: fp,
      targetRoomName: "침실1",
    });

    expect(spec.attachedZones).toHaveLength(0);
    // 외부 창 1개
    const extWin = spec.openings.find((o) => o.kind === "exterior_window");
    expect(extWin).toBeDefined();
  });
});

describe("RenderRoomSpec — 주방 + 다용도실", () => {
  it("attached utility zone 감지", () => {
    const fp = makeFloorPlan([
      { id: "r1", name: "주방" },
      { id: "r2", name: "다용도실" },
    ]);
    const spec = buildRenderRoomSpec({
      parsedFloorPlan: fp,
      targetRoomName: "주방",
    });
    expect(
      spec.attachedZones.some((z) => z.type === "utility"),
    ).toBe(true);
  });
});

describe("RenderRoomSpec — 거실 + 거실발코니", () => {
  it("balcony_sliding_door 자동 생성", () => {
    const fp = makeFloorPlan([
      { id: "r1", name: "거실" },
      { id: "r2", name: "거실발코니" },
    ]);
    const spec = buildRenderRoomSpec({
      parsedFloorPlan: fp,
      targetRoomName: "거실",
      extensionOptions: { livingRoomBalcony: "unextended" },
    });
    const sd = spec.openings.find((o) => o.kind === "balcony_sliding_door");
    expect(sd).toBeDefined();
  });
});
