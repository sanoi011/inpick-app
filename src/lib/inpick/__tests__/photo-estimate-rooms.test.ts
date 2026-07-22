import assert from "node:assert/strict";
import test from "node:test";

import { buildConstructionEstimateClientSide } from "../estimate-v2/client-builder";
import { buildPhotoEstimateRooms } from "../photo-estimate-rooms";

test("photo mode preserves generated room identities instead of collapsing everything into an unknown whole space", () => {
  const rooms = buildPhotoEstimateRooms({
    totalAreaM2: 33,
    rendersByRoom: {
      living: [{ prompt: "밝은 오피스텔 거실" }],
      kitchen: [{ prompt: "주방 상하부장과 타일 백스플래시, 냉장고장과 김치냉장고장을 각각 포함" }],
      bath: [{ prompt: "욕실 타일 교체" }],
    },
  });

  assert.deepEqual(rooms.map((room) => room.roomName), ["거실", "주방", "욕실"]);
  assert.equal(Math.round(rooms.reduce((sum, room) => sum + room.areaM2, 0)), 33);

  const estimate = buildConstructionEstimateClientSide({
    projectId: "photo-project",
    projectMode: "photo_only",
    rooms,
  });
  const kitchenCodes = new Set(
    estimate.lines
      .filter((line) => line.roomName === "주방")
      .map((line) => line.subTradeCode),
  );

  for (const requiredCode of ["12-11", "12-12", "12-13", "12-14", "12-15", "12-16", "07-31"]) {
    assert.equal(kitchenCodes.has(requiredCode), true, `${requiredCode} should remain in fallback estimate`);
  }
  const tallCabinetLine = estimate.lines.find(
    (line) => line.roomName === "주방" && line.subTradeCode === "12-13",
  );
  assert.equal(tallCabinetLine?.quantity, 2);
  assert.match(
    [tallCabinetLine?.itemNameKo, ...(tallCabinetLine?.assumptions ?? [])].join(" "),
    /냉장고장.*김치냉장고장|김치냉장고장.*냉장고장/,
  );
});

test("photo mode still returns a room-scoped fallback when image analysis produced no renders", () => {
  const rooms = buildPhotoEstimateRooms({
    totalAreaM2: 24,
    rendersByRoom: {},
    requestedRoomKeys: ["kitchen"],
  });

  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].roomName, "주방");
  assert.equal(rooms[0].areaM2, 24);
});
