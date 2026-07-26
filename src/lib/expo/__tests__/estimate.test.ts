import assert from "node:assert/strict";
import test from "node:test";
import { confirmExpoDimensions } from "../footprint";
import { addExpoComponent, createExpoScene } from "../scene";
import {
  EXPO_ALLOWANCE_COSTBOOK,
  ExpoEstimateError,
  buildCatalogEstimate,
  buildConceptualRange,
} from "../estimate";

const CONFIRMED_6X3 = confirmExpoDimensions(
  { widthM: 6, depthM: 3, boothType: "inline", wallHeightM: 2.5 },
  "2026-07-26T00:00:00.000Z",
);

test("conceptual range is a low<high band with allowance source", () => {
  const range = buildConceptualRange(18);
  assert.equal(range.stage, "conceptual_range");
  assert.equal(range.source, "allowance");
  assert.equal(range.vatIncluded, false);
  assert.ok(range.lowKrw > 0);
  assert.ok(range.lowKrw < range.highKrw);
  assert.equal(range.lowKrw % 10_000, 0);
  assert.equal(range.highKrw % 10_000, 0);
  assert.ok(range.assumptions.some((a) => a.includes("치수 확정 전")));
});

test("conceptual range rejects out-of-bounds areas", () => {
  for (const area of [3, 1001, Number.NaN]) {
    assert.throws(
      () => buildConceptualRange(area),
      (error: unknown) =>
        error instanceof ExpoEstimateError &&
        error.code === "EXPO_EST_AREA_INVALID",
    );
  }
});

test("catalog estimate requires confirmed dimensions", () => {
  const scene = createExpoScene(6, 3);
  assert.throws(
    () => buildCatalogEstimate(scene, null),
    (error: unknown) =>
      error instanceof ExpoEstimateError &&
      error.code === "EXPO_EST_DIMENSIONS_REQUIRED",
  );
});

test("empty scene still yields area/fixed lines and consistent totals", () => {
  const estimate = buildCatalogEstimate(createExpoScene(6, 3), CONFIRMED_6X3);
  assert.equal(estimate.stage, "catalog_estimate");
  assert.equal(estimate.areaSqm, 18);
  const expectedLineCount =
    EXPO_ALLOWANCE_COSTBOOK.areaRates.length +
    EXPO_ALLOWANCE_COSTBOOK.fixedLines.length;
  assert.equal(estimate.lines.length, expectedLineCount);
  const direct = estimate.lines.reduce((sum, line) => sum + line.amountKrw, 0);
  assert.equal(estimate.directSubtotalKrw, direct);
  const markups = estimate.markupLines.reduce(
    (sum, line) => sum + line.amountKrw,
    0,
  );
  assert.equal(estimate.totalKrw, direct + markups);
  assert.ok(estimate.lines.every((line) => line.source === "allowance"));
});

test("same catalog components group into one quantity line", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "info_counter", "c1");
  scene = addExpoComponent(scene, "info_counter", "c2");
  scene = addExpoComponent(scene, "signage_tower", "t1");
  const estimate = buildCatalogEstimate(scene, CONFIRMED_6X3);

  const counter = estimate.lines.find((l) => l.id === "component_info_counter");
  assert.ok(counter);
  assert.equal(counter.quantity, 2);
  assert.equal(
    counter.amountKrw,
    EXPO_ALLOWANCE_COSTBOOK.componentUnits.info_counter.unitKrw * 2,
  );
  const tower = estimate.lines.find((l) => l.id === "component_signage_tower");
  assert.ok(tower);
  assert.equal(tower.quantity, 1);
});

test("components not in the costbook are rejected, not silently priced", () => {
  const scene = createExpoScene(6, 3);
  const forged = {
    ...scene,
    components: [
      { id: "x1", catalogId: "mystery_item", catalogVersion: 1, x: 0, z: 0, rotation: 0 },
    ],
  };
  assert.throws(
    () => buildCatalogEstimate(forged, CONFIRMED_6X3),
    (error: unknown) =>
      error instanceof ExpoEstimateError &&
      error.code === "EXPO_EST_UNKNOWN_CATALOG_ITEM",
  );
});

test("markup lines are rates over the direct subtotal", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "product_table", "p1");
  const estimate = buildCatalogEstimate(scene, CONFIRMED_6X3);
  for (const markup of EXPO_ALLOWANCE_COSTBOOK.markups) {
    const line = estimate.markupLines.find((l) => l.id === `markup_${markup.trade}`);
    assert.ok(line);
    const expected =
      Math.round((estimate.directSubtotalKrw * markup.rate) / 1_000) * 1_000;
    assert.equal(line.amountKrw, expected);
  }
});

test("estimate is deterministic for the same inputs", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "display_showcase", "d1");
  assert.deepEqual(
    buildCatalogEstimate(scene, CONFIRMED_6X3),
    buildCatalogEstimate(scene, CONFIRMED_6X3),
  );
});

test("manual power capacity replaces the base electrical allowance", () => {
  const base = buildCatalogEstimate(createExpoScene(6, 3), CONFIRMED_6X3);
  const baseLine = base.lines.find((l) => l.id === "fixed_electrical_venue");
  assert.ok(baseLine);
  assert.equal(baseLine.amountKrw, 150_000);

  const powered = buildCatalogEstimate(createExpoScene(6, 3), CONFIRMED_6X3, {
    powerKw: 3,
  });
  const poweredLine = powered.lines.find((l) => l.id === "fixed_electrical_venue");
  assert.ok(poweredLine);
  assert.equal(poweredLine.unit, "kw");
  assert.equal(poweredLine.amountKrw, 450_000);
  assert.ok(poweredLine.label.includes("매뉴얼 입력"));
  assert.ok(powered.totalKrw > base.totalKrw);

  const bogus = buildCatalogEstimate(createExpoScene(6, 3), CONFIRMED_6X3, {
    powerKw: -1,
  });
  assert.equal(
    bogus.lines.find((l) => l.id === "fixed_electrical_venue")?.amountKrw,
    150_000,
  );
});

test("contractor overrides reprice lines as quoted and flow into markups", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "product_table", "p1");
  const base = buildCatalogEstimate(scene, CONFIRMED_6X3);
  const overridden = buildCatalogEstimate(scene, CONFIRMED_6X3, {
    overrides: {
      area_system_structure: { unitAmountKrw: 100_000 },
      component_product_table: { unitAmountKrw: 200_000 },
    },
  });
  const structure = overridden.lines.find((l) => l.id === "area_system_structure");
  assert.ok(structure);
  assert.equal(structure.source, "quoted");
  assert.equal(structure.amountKrw, 1_800_000); // 18㎡ × 10만
  const table = overridden.lines.find((l) => l.id === "component_product_table");
  assert.equal(table?.source, "quoted");
  assert.equal(table?.amountKrw, 200_000);
  assert.equal(overridden.quotedLineCount, 2);
  assert.ok(overridden.directLineCount >= 5);
  // 마크업은 새 직접비 기준으로 재계산
  const expectedDirect = overridden.lines.reduce((sum, l) => sum + l.amountKrw, 0);
  assert.equal(overridden.directSubtotalKrw, expectedDirect);
  assert.ok(overridden.totalKrw !== base.totalKrw);
});

test("invalid or unknown overrides are ignored, staying allowance", () => {
  const estimate = buildCatalogEstimate(createExpoScene(6, 3), CONFIRMED_6X3, {
    overrides: {
      area_system_structure: { unitAmountKrw: Number.NaN },
      nonexistent_line: { unitAmountKrw: 5_000 },
      area_floor_finish: { unitAmountKrw: -10 },
    },
  });
  assert.equal(estimate.quotedLineCount, 0);
  assert.ok(estimate.lines.every((line) => line.source === "allowance"));
});
