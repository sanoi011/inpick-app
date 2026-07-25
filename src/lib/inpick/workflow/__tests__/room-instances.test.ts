import assert from "node:assert/strict";
import test from "node:test";
import {
  buildApartmentRoomDescriptors,
  buildRenderFloorplanPayload,
  canonicalizeFloorplanRoomNames,
  expandWorkflowRoomSelection,
} from "../room-instances";

const room = (name: string) => ({
  name,
  widthMm: 2400,
  depthMm: 1800,
  heightMm: 2400,
  source: "vision" as const,
});

test("욕실과 침실 여러 개를 각각 독립된 생성 키로 보존한다", () => {
  const descriptors = buildApartmentRoomDescriptors([
    room("거실"),
    room("주방"),
    room("욕실1"),
    room("욕실2"),
    room("침실1"),
    room("침실2"),
  ]);

  assert.deepEqual(
    descriptors
      .filter((item) => item.kind === "bath")
      .map((item) => [item.key, item.label]),
    [
      ["bath", "욕실1"],
      ["bath-2", "욕실2"],
    ],
  );
  assert.deepEqual(
    descriptors
      .filter((item) => item.kind === "bedroom")
      .map((item) => item.key),
    ["bedroom", "bedroom-2"],
  );
});

test("Step1의 욕실 선택은 도면에 있는 모든 욕실 인스턴스로 확장된다", () => {
  const descriptors = buildApartmentRoomDescriptors([
    room("욕실"),
    room("욕실"),
    room("주방"),
  ]);

  assert.deepEqual(expandWorkflowRoomSelection(["bath"], descriptors), [
    "bath",
    "bath-2",
  ]);
});

test("렌더 payload가 두 욕실을 서로 다른 target id와 bbox로 전달한다", () => {
  const payload = buildRenderFloorplanPayload({
    rooms: [
      { ...room("욕실1"), xMm: 1000, yMm: 2000 },
      { ...room("욕실2"), xMm: 6000, yMm: 2000 },
    ],
  });

  assert.deepEqual(
    payload.rooms.map((item) => [item.id, item.name, item.bbox?.x]),
    [
      ["bath", "욕실1", 1000],
      ["bath-2", "욕실2", 6000],
    ],
  );
});

test("분석기가 같은 욕실 이름을 반복해도 욕실1·욕실2로 정규화한다", () => {
  assert.deepEqual(
    canonicalizeFloorplanRoomNames([
      { name: "욕실", value: 1 },
      { name: "화장실", value: 2 },
    ]).map((item) => item.name),
    ["욕실1", "욕실2"],
  );
});
