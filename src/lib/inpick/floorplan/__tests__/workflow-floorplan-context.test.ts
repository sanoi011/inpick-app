import assert from "node:assert/strict";
import test from "node:test";

import {
  buildParsedFloorPlanFromWorkflow,
  buildWorkflowFloorplanEvidence,
  findWorkflowFloorplanRoom,
  type WorkflowNormalizedFloorplan,
} from "../workflow-floorplan-context";

const floorplan: WorkflowNormalizedFloorplan = {
  pyeong: "34평 A형",
  totalWidthMm: 11_000,
  totalDepthMm: 8_000,
  notes: "거실과 주방이 분리된 비정형 세대",
  rooms: [
    {
      name: "거실",
      xMm: 0,
      yMm: 0,
      widthMm: 5_200,
      depthMm: 4_100,
      heightMm: 2_400,
      source: "vision",
    },
    {
      name: "주방",
      xMm: 5_200,
      yMm: 0,
      widthMm: 3_100,
      depthMm: 3_400,
      heightMm: 2_400,
      shape: "l_shaped",
      polygonMm: [
        { x: 5_200, y: 0 },
        { x: 8_300, y: 0 },
        { x: 8_300, y: 2_200 },
        { x: 7_100, y: 2_200 },
        { x: 7_100, y: 3_400 },
        { x: 5_200, y: 3_400 },
      ],
      source: "vision",
    },
    {
      name: "발코니1",
      xMm: 0,
      yMm: 4_100,
      widthMm: 5_200,
      depthMm: 1_300,
      heightMm: 2_400,
      source: "vision",
    },
  ],
  openings: [
    {
      wall: "거실-발코니1 경계벽",
      type: "sliding",
      fromRoom: "거실",
      toRoom: "발코니",
      widthMm: 2_400,
    },
    {
      wall: "주방 동측 외벽",
      type: "window",
      fromRoom: "주방",
      widthMm: 1_200,
    },
  ],
};

test("UI 부엌 명칭을 실제 도면의 주방에 연결한다", () => {
  assert.equal(findWorkflowFloorplanRoom(floorplan, "부엌")?.name, "주방");
});

test("전체 실 좌표와 개구부를 RenderRoomSpec 입력으로 보존한다", () => {
  const parsed = buildParsedFloorPlanFromWorkflow(floorplan);
  assert.equal(parsed?.rooms?.length, 3);
  assert.deepEqual(parsed?.rooms?.[0].bbox, {
    x: 0,
    y: 0,
    width: 5.2,
    height: 4.1,
  });
  assert.equal(parsed?.rooms?.[1].polygon?.length, 6);
  assert.equal(parsed?.doors?.[0].fromRoomId, "floorplan_room_0");
  assert.equal(parsed?.doors?.[0].toRoomId, "floorplan_room_2");
  assert.equal(parsed?.windows?.[0].roomId, "floorplan_room_1");
});

test("실별 증거 프롬프트에 세대 고유 구조와 일반형 대체 금지를 포함한다", () => {
  const evidence = buildWorkflowFloorplanEvidence(floorplan, "부엌");
  assert.match(evidence, /34평 A형/);
  assert.match(evidence, /Matched plan room: 주방/);
  assert.match(evidence, /l_shaped/);
  assert.match(evidence, /do not substitute a generic Korean apartment layout/i);
});
