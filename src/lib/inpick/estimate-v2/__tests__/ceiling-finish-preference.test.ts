import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyResidentialCeilingFinishPreference,
  type ResidentialCeilingFinish,
} from "../ceiling-finish-preference";
import type { RoomType, SurfacePlan } from "../types";

function plan(
  id: string,
  roomId: string,
  roomType: RoomType,
  surfaceType: SurfacePlan["surfaceType"],
  materialCategory: string,
  materialNameKo: string,
): SurfacePlan {
  return {
    id,
    projectId: "project-a",
    projectMode: "apartment",
    roomId,
    roomName: roomId,
    roomType,
    surfaceType,
    action: "replace",
    materialCategory,
    materialNameKo,
    source: "vision_recommended_material",
    confidence: 0.8,
    evidenceRefs: [],
    assumptions: [],
    warnings: [],
  };
}

function apply(preference: ResidentialCeilingFinish) {
  return applyResidentialCeilingFinishPreference(
    [
      plan("floor", "거실", "living_room", "floor", "engineered_floor", "강마루"),
      plan("paint", "거실", "living_room", "ceiling", "ceiling_paint", "천장 도장"),
      plan("paper", "거실", "living_room", "ceiling", "wallpaper", "천장 도배"),
      plan("bath", "욕실", "bathroom", "ceiling", "smc_ceiling", "욕실 SMC 천장"),
    ],
    "apartment",
    preference,
  );
}

test("domestic residential default keeps one wallpaper ceiling plan per room", () => {
  const result = apply("wallpaper");
  const livingCeilings = result.filter(
    (item) => item.roomId === "거실" && item.surfaceType === "ceiling",
  );

  assert.equal(livingCeilings.length, 1);
  assert.equal(livingCeilings[0].materialCategory, "wallpaper");
  assert.equal(livingCeilings[0].materialNameKo, "천장 도배");
  assert.equal(livingCeilings[0].source, "user_selected_material");
});

test("paint option replaces the conventional residential ceiling finish", () => {
  const result = apply("paint");
  const livingCeiling = result.find(
    (item) => item.roomId === "거실" && item.surfaceType === "ceiling",
  );

  assert.equal(livingCeiling?.materialCategory, "ceiling_paint");
  assert.match(livingCeiling?.spec || "", /수성페인트/);
});

test("special bathroom ceiling is not overwritten", () => {
  const result = apply("wallpaper");
  const bathroom = result.find((item) => item.roomId === "욕실");

  assert.equal(bathroom?.materialCategory, "smc_ceiling");
  assert.equal(bathroom?.materialNameKo, "욕실 SMC 천장");
});

test("commercial plans are returned unchanged", () => {
  const input = [
    {
      ...plan("paint", "홀", "commercial_zone", "ceiling", "ceiling_paint", "천장 도장"),
      projectMode: "commercial" as const,
    },
  ];
  const result = applyResidentialCeilingFinishPreference(
    input,
    "commercial",
    "wallpaper",
  );

  assert.deepEqual(result, input);
});
