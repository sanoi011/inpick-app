import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleByRoom,
  assembleSheet,
  constructionEstimateToDetailLines,
} from "../detail-model";
import {
  buildConstructionEstimate,
  hasMaterialIntent,
} from "@/lib/inpick/estimate-v2/build-construction-estimate";
import { WOOD_FLOOR_RULE } from "@/lib/inpick/estimate-v2/work-package-rules";
import type {
  RoomQuantityBasis,
  SurfacePlan,
} from "@/lib/inpick/estimate-v2/types";

const roomBasis: RoomQuantityBasis = {
  roomId: "living-1",
  roomName: "거실",
  roomType: "living_room",
  floorM2: 25.2,
  ceilingM2: 25.2,
  wallM2: 42,
  perimeterM: 20,
  doorCount: 1,
  windowCount: 2,
  heightM: 2.3,
  basisSource: "manual_input",
  assumptions: [],
};

function surfacePlan(
  id: string,
  surfaceType: "floor" | "wall" | "ceiling",
  materialCategory: string,
  materialNameKo: string,
  selectedMaterialUnitPrice: number,
): SurfacePlan {
  return {
    id,
    projectId: "estimate-package-sample",
    projectMode: "apartment",
    roomId: roomBasis.roomId,
    roomName: roomBasis.roomName,
    roomType: roomBasis.roomType,
    surfaceType,
    action: "demolish_and_new",
    materialCategory,
    materialNameKo,
    selectedMaterialUnitPrice,
    source: "user_selected_material",
    confidence: 0.95,
    evidenceRefs: [],
    assumptions: [],
    warnings: [],
  };
}

test("실별 견적은 바닥·벽·천장을 각각 하나의 공사 패키지로 표시한다", () => {
  const estimate = buildConstructionEstimate({
    projectId: "estimate-package-sample",
    projectMode: "apartment",
    surfacePlans: [
      surfacePlan("sp-floor", "floor", "engineered_floor", "강마루", 65_000),
      surfacePlan("sp-wall", "wall", "silk_wallpaper", "실크벽지", 8_500),
      surfacePlan("sp-ceiling", "ceiling", "silk_wallpaper", "실크벽지", 8_500),
    ],
    quantityBasisByRoom: { [roomBasis.roomId]: roomBasis },
  });

  // 운영에 저장된 구 견적처럼 하위 공정 품명이 모두 최종 마감재로 오염된 경우를 재현한다.
  estimate.lines
    .filter((line) => line.evidenceRefs.some((ref) => ref.id === "sp-floor"))
    .forEach((line) => {
      line.itemNameKo = "강마루";
      line.productName = "강마루";
      line.brand = "오염된 마감재 브랜드";
    });

  const atomicLines = constructionEstimateToDetailLines(estimate);
  const tradeSheet = assembleSheet(atomicLines);
  const roomSheet = assembleByRoom(atomicLines);
  const living = roomSheet.groups.find((group) => group.trade === "거실");

  assert.ok(living);
  const packages = living.lines.filter((line) => line.isWorkPackage);
  assert.equal(packages.length, 3);
  assert.equal(living.lines.length, 4);
  assert.equal(packages.find((line) => line.part === "바닥")?.workBreakdown?.length, 5);
  assert.equal(packages.find((line) => line.part === "벽")?.workBreakdown?.length, 4);
  assert.equal(packages.find((line) => line.part === "천장")?.workBreakdown?.length, 4);
  assert.equal(
    living.lines.filter((line) => line.part === "걸레받이/몰딩").length,
    1,
  );
  assert.equal(
    new Set(
      packages
        .find((line) => line.part === "바닥")
        ?.workBreakdown?.map((line) => line.taskName),
    ).size,
    5,
  );
  assert.equal(
    atomicLines.find((line) => line.itemName === "기존 바닥재 철거")?.brand,
    "-",
  );
  assert.equal(packages.find((line) => line.part === "바닥")?.quantity, 25.2);
  assert.match(packages.find((line) => line.part === "바닥")?.itemName || "", /강마루.*바닥.*마감공사/);

  // 화면 표시만 묶고 원가와 공종별 원본은 보존한다.
  assert.equal(roomSheet.directMaterial, tradeSheet.directMaterial);
  assert.equal(roomSheet.directLabor, tradeSheet.directLabor);
  assert.equal(roomSheet.directTotal, tradeSheet.directTotal);
  assert.ok(tradeSheet.lineCount > roomSheet.lineCount);
});

test("상품 resolver는 최종 마감재 라인에만 실행된다", () => {
  const demolition = WOOD_FLOOR_RULE.outputLines[0];
  const substrate = WOOD_FLOOR_RULE.outputLines[1];
  const finish = WOOD_FLOOR_RULE.outputLines[3];

  assert.equal(hasMaterialIntent(demolition), false);
  assert.equal(hasMaterialIntent(substrate), false);
  assert.equal(hasMaterialIntent(finish), true);
});
