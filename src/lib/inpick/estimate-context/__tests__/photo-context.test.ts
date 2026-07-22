import assert from "node:assert/strict";
import test from "node:test";

import {
  collectFinalSelectionImageUrls,
  deriveKitchenPlanOverridesFromStep1,
  deriveRequestedRoomsFromStep1,
  filterRecordsForSelectedRooms,
  normalizeEstimateStep1Snapshot,
} from "../photo-context";
import { buildSurfacePlansFromContext } from "../../estimate-v2/surface-plan-builder";
import { buildConstructionEstimate } from "../../estimate-v2/build-construction-estimate";
import type { DesignOutput } from "../types";

test("photo Step1 keeps residential identity, requested rooms, and room furnishings", () => {
  const normalized = normalizeEstimateStep1Snapshot(
    {
      workflowEntry: "photo_residential",
      photoSpaceType: "officetel",
      rooms: ["living", "kitchen"],
      roomFurnishings: {
        kitchen: ["sinkUpper", "fridgeCabinet"],
      },
    },
    "photo_only",
  );

  assert.equal(normalized.residentialType, "officetel");
  assert.deepEqual(normalized.rooms, ["living", "kitchen"]);
  assert.deepEqual(normalized.roomFurnishings, {
    kitchen: ["sinkUpper", "fridgeCabinet"],
  });
  assert.deepEqual(deriveRequestedRoomsFromStep1(normalized), [
    { roomId: "living", roomName: "거실" },
    { roomId: "kitchen", roomName: "주방" },
  ]);
});

test("requested photo rooms survive missing or failed design analysis as room-scoped fallback", () => {
  const analyzedLiving: DesignOutput = {
    id: "living-output",
    projectId: "photo-project",
    userId: "user-1",
    projectMode: "photo_only",
    targetType: "room",
    targetId: "living",
    targetName: "거실",
    renderKind: "room_render",
    imageUrl: "https://img/living.png",
    materialHints: [
      {
        surfaceType: "floor",
        materialCategory: "engineered_floor",
        materialNameKo: "사용자 확정 강마루",
        confidence: 1,
        source: "user_selected",
      },
    ],
    status: "analysis_done",
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
  };

  const failedKitchen: DesignOutput = {
    ...analyzedLiving,
    id: "kitchen-output",
    targetId: "kitchen",
    targetName: "주방",
    imageUrl: "https://img/kitchen.png",
    materialHints: [],
    status: "analysis_failed",
    analysisError: "provider unavailable",
  };
  const result = buildSurfacePlansFromContext({
    projectId: "photo-project",
    projectMode: "photo_only",
    designOutputs: [analyzedLiving, failedKitchen],
    requestedRooms: [
      { roomId: "living", roomName: "거실" },
      { roomId: "kitchen", roomName: "주방" },
    ],
  });

  assert.ok(
    result.surfacePlans.some(
      (plan) =>
        plan.roomId === "living" &&
        plan.surfaceType === "floor" &&
        plan.source === "user_selected_material",
    ),
  );
  assert.ok(
    result.surfacePlans.some(
      (plan) =>
        plan.roomId === "kitchen" &&
        plan.roomType === "kitchen" &&
        plan.surfaceType === "sink" &&
        plan.source === "standard_fallback_material",
    ),
  );
  assert.equal(result.quantityBasisByRoom.kitchen.roomName, "주방");
});

test("final-images-only keeps evidence and user edits relevant to selected rooms and source images", () => {
  const selections = [
    {
      targetId: "kitchen",
      imageUrl: "https://img/kitchen-final.png",
      sourceImageUrl: "https://img/kitchen-source.png",
    },
  ];
  const selectedOutputs = [
    {
      ...({} as DesignOutput),
      targetId: "kitchen",
      imageUrl: "https://img/kitchen-final.png",
    },
  ];

  assert.deepEqual(
    Array.from(collectFinalSelectionImageUrls(selectedOutputs, selections)).sort(),
    ["https://img/kitchen-final.png", "https://img/kitchen-source.png"],
  );
  assert.deepEqual(
    filterRecordsForSelectedRooms(
      [
        { roomId: "kitchen", surfaceType: "cabinet", id: "keep" },
        { room_id: "living", surface_type: "floor", id: "drop" },
      ],
      selectedOutputs,
    ),
    [{ roomId: "kitchen", surfaceType: "cabinet", id: "keep" }],
  );
});

test("Step1 kitchen requirements become explicit server plan overrides with provenance", () => {
  const overrides = deriveKitchenPlanOverridesFromStep1({
    rooms: ["kitchen"],
    roomFurnishings: {
      kitchen: ["sinkUpper", "sinkLower", "fridgeCabinet", "kimchiCabinet"],
    },
  });

  assert.deepEqual(overrides.kitchen, {
    counterLengthM: 3,
    lowerCabinetLengthM: 3,
    upperCabinetLengthM: 2.4,
    tallCabinetEa: 2,
    tallCabinetLabels: ["냉장고장", "김치냉장고장"],
    requirementSource: "step1_room_furnishings",
    requestedParts: [
      "lower_cabinet",
      "upper_cabinet",
      "refrigerator_cabinet",
      "kimchi_refrigerator_cabinet",
    ],
  });
});

test("server construction estimate consumes Step1 kitchen overrides", () => {
  const step1 = {
    rooms: ["kitchen"],
    roomFurnishings: {
      kitchen: ["sinkUpper", "sinkLower", "fridgeCabinet", "kimchiCabinet"],
    },
  };
  const plans = buildSurfacePlansFromContext({
    projectId: "photo-project",
    projectMode: "photo_only",
    designOutputs: [],
    requestedRooms: deriveRequestedRoomsFromStep1(step1),
  });
  const kitchenPlanOverrides = deriveKitchenPlanOverridesFromStep1(
    step1,
    plans.quantityBasisByRoom,
  );
  const estimate = buildConstructionEstimate({
    projectId: "photo-project",
    projectMode: "photo_only",
    ...plans,
    kitchenPlanOverrides,
  });

  const lower = estimate.lines.find((line) => line.subTradeCode === "12-11");
  const upper = estimate.lines.find((line) => line.subTradeCode === "12-12");
  const tall = estimate.lines.find((line) => line.subTradeCode === "12-13");
  assert.equal(lower?.quantity, kitchenPlanOverrides.kitchen.lowerCabinetLengthM);
  assert.equal(upper?.quantity, kitchenPlanOverrides.kitchen.upperCabinetLengthM);
  assert.equal(tall?.quantity, 2);
  assert.equal(tall?.itemNameKo, "냉장고장 · 김치냉장고장");
  assert.ok(tall?.assumptions.some((assumption) => assumption.includes("사용자 요구 주방장 구성")));
});
