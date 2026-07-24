import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleByRoom,
  assembleSheet,
  constructionEstimateToDetailLines,
  type DetailLine,
} from "../detail-model";
import {
  computeCostSheet,
  defaultJebiItems,
} from "../cost-model";
import {
  buildConstructionEstimate,
  hasMaterialIntent,
} from "@/lib/inpick/estimate-v2/build-construction-estimate";
import { computeRoomQuantityBasis } from "@/lib/inpick/estimate-v2/quantity-formulas";
import { WOOD_FLOOR_RULE } from "@/lib/inpick/estimate-v2/work-package-rules";
import { buildSchedule, buildScheduleFromDocumentLines } from "../schedule-model";
import { resolveMaterialMeta } from "../material-meta";
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
  assert.equal(roomSheet.directExpense, tradeSheet.directExpense);
  assert.equal(roomSheet.directTotal, tradeSheet.directTotal);
  assert.equal(
    tradeSheet.directTotal,
    estimate.lines
      .filter((line) => line.included)
      .reduce((sum, line) => sum + line.totalAmount, 0),
  );
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

test("정식 원가계산서는 직접경비를 노무비와 분리하고 총액에 한 번만 반영한다", () => {
  const cost = computeCostSheet({
    directMaterial: 1_000_000,
    directLabor: 500_000,
    directExpense: 100_000,
    jebi: defaultJebiItems(),
    margins: {
      generalAdmin: 0,
      profit: 0,
      lossInsurance: 0,
      lossInsuranceInclude: false,
      vat: 0,
    },
    includeJebi: false,
  });

  assert.equal(cost.directMaterial, 1_000_000);
  assert.equal(cost.directLabor, 500_000);
  assert.equal(cost.directExpense, 100_000);
  assert.equal(cost.indirectExpenseSubtotal, 0);
  assert.equal(cost.expenseSubtotal, 100_000);
  assert.equal(cost.netConstructionCost, 1_600_000);
  assert.equal(cost.contractPrice, 1_600_000);
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
  assert.equal(roomSheet.directExpense, tradeSheet.directExpense);
  assert.equal(roomSheet.directTotal, tradeSheet.directTotal);
});

function scheduleLine(
  id: string,
  trade: string,
  itemName: string,
  unit: string,
  quantity: number,
  amount = 100_000,
): DetailLine {
  return {
    id,
    trade,
    order: 1,
    itemCode: id,
    itemName,
    part: "공통",
    spec: "-",
    brand: "-",
    product: "시공/설치",
    unit,
    quantity,
    matUnit: 0,
    labUnit: quantity ? amount / quantity : amount,
    expenseUnit: 0,
    matAmount: 0,
    labAmount: amount,
    expenseAmount: 0,
    amount,
    room: "샘플",
    source: "테스트",
    optional: false,
    added: false,
  };
}

test("도배만 시공하면 임의 30일이 아니라 실제 수량 기준 3일 공정이 된다", () => {
  const lines = [
    scheduleLine("demo-wallpaper", "철거공사", "기존 벽지 철거", "m²", 42),
    scheduleLine("wallpaper-wall", "도배공사", "벽 실크벽지 시공", "m²", 42),
    scheduleLine("wallpaper-ceiling", "도배공사", "천장 실크벽지 시공", "m²", 25.2),
    scheduleLine("clean", "준공청소", "준공청소 및 검수", "식", 1),
  ];

  const lowCost = buildSchedule(assembleSheet(lines).groups);
  const highCost = buildSchedule(
    assembleSheet(lines.map((line) => ({ ...line, amount: line.amount * 20 }))).groups,
  );

  assert.equal(lowCost.totalDays, 3);
  assert.equal(lowCost.calculationBasis, "quantity_productivity");
  assert.equal(highCost.totalDays, lowCost.totalDays);
  assert.deepEqual(
    lowCost.phases.map((phase) => phase.name),
    ["철거·폐기물", "필름·도배·도장", "준공청소·검수"],
  );
});

test("욕실은 방수 48시간 검사·타일 3일 보양·도기 1일을 공정에 반영한다", () => {
  const lines = [
    scheduleLine("waterproof-floor", "방수공사", "욕실 바닥 방수", "m²", 4.2),
    scheduleLine("waterproof-wall", "방수공사", "욕실 벽 방수", "m²", 17.5),
    scheduleLine("tile-floor", "타일공사", "욕실 바닥 타일", "m²", 4.2),
    scheduleLine("tile-wall", "타일공사", "욕실 벽 타일", "m²", 17.5),
    scheduleLine("fixture", "위생도기", "양변기·세면대·수전 설치", "개", 3),
  ];

  const schedule = buildSchedule(assembleSheet(lines).groups);
  const waterproof = schedule.phases.find((phase) => phase.key === "waterproof");
  const tile = schedule.phases.find((phase) => phase.key === "tile");
  const fixture = schedule.phases.find((phase) => phase.key === "fixtures");

  assert.equal(waterproof?.durationDays, 3);
  assert.equal(waterproof?.qualityHoldDays, 2);
  assert.match(waterproof?.standardRef || "", /48시간/);
  assert.equal(tile?.durationDays, 3);
  assert.match(tile?.standardRef || "", /3일/);
  assert.equal(fixture?.durationDays, 1);
  assert.equal(schedule.totalDays, 7);
});

test("가구 기본 추천은 대형 브랜드 대신 맞춤형으로 표시한다", () => {
  assert.equal(resolveMaterialMeta("주방 하부장 설치").brand, "맞춤형");
  assert.equal(resolveMaterialMeta("붙박이장 제작").brand, "맞춤형");
  assert.equal(resolveMaterialMeta("신발장 제작").brand, "맞춤형");
});

test("발행 PDF 공정표도 웹과 동일한 수량 기반 엔진을 사용한다", () => {
  const schedule = buildScheduleFromDocumentLines([
    {
      id: "wallpaper",
      tradeName: "도배/페인트",
      itemName: "실크벽지 시공",
      unit: "m²",
      quantity: 85,
      totalAmount: 1_500_000,
      roomName: "거실",
    },
    {
      id: "clean",
      tradeName: "정리/청소",
      itemName: "준공청소",
      unit: "식",
      quantity: 1,
      totalAmount: 300_000,
      roomName: "공통",
    },
  ]);

  assert.equal(schedule.calculationBasis, "quantity_productivity");
  assert.equal(schedule.totalDays, 2);
  assert.deepEqual(
    schedule.phases.map((phase) => [phase.name, phase.durationDays]),
    [
      ["필름·도배·도장", 1],
      ["준공청소·검수", 1],
    ],
  );
});
