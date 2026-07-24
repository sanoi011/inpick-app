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
import { computeRoomQuantityBasis } from "@/lib/inpick/estimate-v2/quantity-formulas";
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

test("욕실 벽 수량은 0이 아니라 실제 타일·방수 면적으로 산출된다", () => {
  const bathroom = computeRoomQuantityBasis({
    roomId: "bath-quantity",
    roomName: "욕실",
    roomType: "bathroom",
    areaM2: 4.2,
    widthM: 2,
    depthM: 2.1,
    heightM: 2.3,
    doorCount: 1,
    windowCount: 0,
  });

  assert.ok(Math.abs(bathroom.wallM2 - 17.06) < 0.001);
  assert.ok(bathroom.wallM2 > bathroom.floorM2);
});

test("욕실·주방은 타일 중복 없이 전기·설비를 별도 세부 라인으로 산출한다", () => {
  const bathroom: RoomQuantityBasis = {
    roomId: "bath-1",
    roomName: "욕실",
    roomType: "bathroom",
    floorM2: 4.2,
    ceilingM2: 4.2,
    wallM2: 17.5,
    perimeterM: 8.6,
    doorCount: 1,
    windowCount: 0,
    fixtureCount: 1,
    heightM: 2.3,
    basisSource: "manual_input",
    assumptions: [],
  };
  const kitchen: RoomQuantityBasis = {
    roomId: "kitchen-1",
    roomName: "주방",
    roomType: "kitchen",
    floorM2: 8.5,
    ceilingM2: 8.5,
    wallM2: 14.5,
    perimeterM: 12,
    doorCount: 0,
    windowCount: 1,
    fixtureCount: 1,
    widthM: 3.6,
    depthM: 2.4,
    heightM: 2.3,
    basisSource: "manual_input",
    assumptions: [],
  };
  const makePlan = (
    id: string,
    room: RoomQuantityBasis,
    surfaceType: SurfacePlan["surfaceType"],
    materialCategory: string,
    materialNameKo: string,
    selectedMaterialUnitPrice?: number,
  ): SurfacePlan => ({
    id,
    projectId: "wet-room-sample",
    projectMode: "apartment",
    roomId: room.roomId,
    roomName: room.roomName,
    roomType: room.roomType,
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
  });

  const estimate = buildConstructionEstimate({
    projectId: "wet-room-sample",
    projectMode: "apartment",
    surfacePlans: [
      makePlan("bath-floor", bathroom, "floor", "porcelain_tile", "욕실 바닥 타일", 42_000),
      makePlan("bath-wall", bathroom, "wall", "wall_tile", "욕실 벽 타일", 39_000),
      makePlan("bath-fixture", bathroom, "fixture", "bathroom_full", "욕실 위생기구"),
      makePlan("kitchen-package", kitchen, "sink", "kitchen_standard", "싱크대", 999_999),
    ],
    quantityBasisByRoom: {
      [bathroom.roomId]: bathroom,
      [kitchen.roomId]: kitchen,
    },
    kitchenPlanOverrides: {
      [kitchen.roomId]: {
        counterLengthM: 3.6,
        lowerCabinetLengthM: 3.6,
        upperCabinetLengthM: 2.8,
        tallCabinetEa: 1,
        tallCabinetLabels: ["냉장고장"],
        worktopLengthM: 3.6,
        sinkEa: 1,
        faucetEa: 1,
        hoodEa: 1,
        cooktopEa: 1,
        backsplashM2: 2.2,
        plumbingRelocation: "none",
        electricalAdditionsEa: 3,
      },
    },
  });

  const bathroomLines = estimate.lines.filter((line) => line.roomName === bathroom.roomName);
  const kitchenLines = estimate.lines.filter((line) => line.roomName === kitchen.roomName);

  // 욕실 전체 패키지는 타일·방수를 다시 넣지 않는다.
  assert.equal(
    bathroomLines.filter((line) => line.subTradeCode === "06-01").length,
    2,
  );
  assert.equal(
    bathroomLines.filter((line) => line.subTradeCode === "07-01").length,
    2,
  );
  assert.equal(bathroomLines.filter((line) => line.tradeCode === "04").length, 3);
  assert.equal(bathroomLines.filter((line) => line.tradeCode === "05").length, 3);
  assert.equal(
    bathroomLines.find((line) => line.subTradeCode === "05-10")?.quantity,
    3,
  );
  assert.equal(
    bathroomLines.find((line) => line.subTradeCode === "05-11")?.quantity,
    3,
  );

  assert.deepEqual(
    kitchenLines
      .filter((line) => line.tradeCode === "04")
      .map((line) => line.subTradeCode),
    ["04-21", "04-22", "04-23", "04-24"],
  );
  assert.deepEqual(
    kitchenLines
      .filter((line) => line.tradeCode === "05")
      .map((line) => line.subTradeCode),
    ["05-21", "05-22", "05-23"],
  );
  assert.equal(
    kitchenLines.find((line) => line.subTradeCode === "04-21")?.quantity,
    3,
  );
  assert.equal(
    kitchenLines.find((line) => line.subTradeCode === "05-21")?.quantity,
    2,
  );

  // 범용 "싱크대" 선택 단가가 상부장·상판·후드·쿡탑에 복제되지 않는다.
  assert.equal(
    kitchenLines.find((line) => line.subTradeCode === "12-11")?.materialUnitPrice,
    999_999,
  );
  assert.equal(
    kitchenLines.find((line) => line.subTradeCode === "12-12")?.materialUnitPrice,
    380_000,
  );
  assert.equal(
    kitchenLines.find((line) => line.subTradeCode === "12-18")?.materialUnitPrice,
    550_000,
  );

  const detailLines = constructionEstimateToDetailLines(estimate);
  assert.ok(
    detailLines
      .filter((line) => line.itemCode.startsWith("04-"))
      .every((line) => line.part === "전기"),
  );
  assert.ok(
    detailLines
      .filter((line) => line.itemCode.startsWith("05-"))
      .every((line) => line.part === "설비"),
  );
  assert.match(
    detailLines.find((line) => line.itemCode === "05-21")?.product || "",
    /급수관/,
  );
  assert.match(
    detailLines.find((line) => line.itemCode === "05-22")?.product || "",
    /배수관/,
  );
  assert.match(
    detailLines.find((line) => line.itemCode === "04-21")?.product || "",
    /콘센트/,
  );
  assert.match(
    detailLines.find((line) => line.itemCode === "12-17")?.product || "",
    /후드/,
  );
  assert.match(
    detailLines.find((line) => line.itemCode === "12-18")?.product || "",
    /인덕션/,
  );

  const roomSheet = assembleByRoom(detailLines);
  const tradeSheet = assembleSheet(detailLines);
  assert.equal(roomSheet.directTotal, tradeSheet.directTotal);
});
