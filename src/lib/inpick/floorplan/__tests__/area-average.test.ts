import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStandardAreaAverage,
  parseAreaAverageResponse,
} from "../area-average";

test("standard area average keeps interior rooms near 92 percent of exclusive area", () => {
  const result = buildStandardAreaAverage({ exclusiveAreaM2: 84.9, roomCount: 3 });
  const interiorArea = result.rooms
    .filter((room) => !/발코니|베란다/.test(room.name))
    .reduce((sum, room) => sum + (room.widthMm * room.depthMm) / 1_000_000, 0);

  assert.ok(result.rooms.some((room) => room.name === "거실"));
  assert.ok(result.rooms.some((room) => room.name.includes("주방")));
  assert.ok(interiorArea > 84.9 * 0.9);
  assert.ok(interiorArea < 84.9 * 0.94);
});

test("prompt response is sanitized and rescaled for estimate use", () => {
  const result = parseAreaAverageResponse(
    JSON.stringify({
      rooms: [
        { name: "거실", widthMm: 6200, depthMm: 5000, heightMm: 2400 },
        { name: "안방", widthMm: 4400, depthMm: 3900, heightMm: 2400 },
        { name: "주방", widthMm: 4000, depthMm: 3200, heightMm: 2400 },
        { name: "욕실", widthMm: 2300, depthMm: 1800, heightMm: 2400 },
        { name: "현관", widthMm: 2200, depthMm: 1600, heightMm: 2400 },
      ],
      notes: "통계 평균",
    }),
    { exclusiveAreaM2: 59.8 },
  );

  assert.ok(result);
  assert.equal(result?.notes, "통계 평균");
  const interiorArea = result!.rooms.reduce(
    (sum, room) => sum + (room.widthMm * room.depthMm) / 1_000_000,
    0,
  );
  assert.ok(interiorArea > 53);
  assert.ok(interiorArea < 57);
});
