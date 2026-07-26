import assert from "node:assert/strict";
import test from "node:test";
import {
  ExpoFootprintError,
  SQFT_PER_SQM,
  convertArea,
  createProvisionalFootprint,
} from "../footprint";

test("9㎡ resolves to the 3×3 standard module", () => {
  const fp = createProvisionalFootprint(9, "sqm");
  assert.equal(fp.canonicalAreaSqm, 9);
  assert.equal(fp.selected.label, "3m × 3m");
  assert.equal(fp.selected.standardMatch, true);
  assert.equal(fp.standardSizeMatch, true);
  assert.equal(fp.alternatives.length, 0);
  assert.equal(fp.boothType, "inline");
  assert.equal(fp.openSides, 1);
  assert.equal(fp.wallHeightM, 2.5);
  assert.equal(fp.confirmationState, "provisional");
  assert.ok(fp.assumptions.includes("area_only_no_confirmed_dimensions"));
});

test("18㎡ prefers the 2:1 inline run 6×3", () => {
  const fp = createProvisionalFootprint(18, "sqm");
  assert.equal(fp.selected.label, "6m × 3m");
  assert.equal(fp.standardSizeMatch, true);
});

test("36㎡ selects 6×6 and keeps 12×3 as an alternative", () => {
  const fp = createProvisionalFootprint(36, "sqm");
  assert.equal(fp.selected.label, "6m × 6m");
  assert.deepEqual(
    fp.alternatives.map((c) => c.label),
    ["12m × 3m"],
  );
});

test("non-standard 20㎡ fits provisional candidates with the assumption flag", () => {
  const fp = createProvisionalFootprint(20, "sqm");
  assert.equal(fp.standardSizeMatch, false);
  assert.ok(fp.assumptions.includes("non_standard_area_fitted"));
  assert.equal(fp.selected.depthM, 3);
  assert.equal(fp.selected.widthM, 6.7);
  assert.ok(fp.alternatives.length >= 1);
  for (const candidate of [fp.selected, ...fp.alternatives]) {
    assert.equal(candidate.standardMatch, false);
    assert.ok(Math.abs(candidate.areaSqm - 20) <= 1.2);
  }
});

test("100ft² converts to ~9.29㎡ and fits non-standard candidates", () => {
  const fp = createProvisionalFootprint(100, "sqft");
  assert.equal(fp.canonicalAreaSqm, 9.29);
  assert.equal(fp.inputUnit, "sqft");
  assert.equal(fp.standardSizeMatch, false);
  assert.ok(fp.assumptions.includes("unit_converted_from_sqft"));
  assert.equal(fp.selected.depthM, 3);
});

test("200ft² converts to ~18.58㎡", () => {
  const fp = createProvisionalFootprint(200, "sqft");
  assert.equal(fp.canonicalAreaSqm, 18.58);
  assert.equal(fp.selected.depthM, 3);
  assert.equal(fp.selected.widthM, 6.2);
});

test("zero, negative, NaN, too-small and too-large areas are rejected", () => {
  for (const [value, code] of [
    [0, "EXPO_AREA_NOT_POSITIVE"],
    [-9, "EXPO_AREA_NOT_POSITIVE"],
    [Number.NaN, "EXPO_AREA_NOT_A_NUMBER"],
    [Number.POSITIVE_INFINITY, "EXPO_AREA_NOT_A_NUMBER"],
    [3.9, "EXPO_AREA_TOO_SMALL"],
    [1001, "EXPO_AREA_TOO_LARGE"],
  ] as const) {
    assert.throws(
      () => createProvisionalFootprint(value as number, "sqm"),
      (error: unknown) =>
        error instanceof ExpoFootprintError && error.code === code,
      `${String(value)} → ${code}`,
    );
  }
  // 40ft² ≈ 3.7㎡ — 변환 이후에도 하한이 적용된다.
  assert.throws(
    () => createProvisionalFootprint(40, "sqft"),
    (error: unknown) =>
      error instanceof ExpoFootprintError && error.code === "EXPO_AREA_TOO_SMALL",
  );
});

test("unit conversion round-trips within rounding tolerance", () => {
  const sqft = convertArea(18, "sqm", "sqft");
  assert.equal(sqft, Math.round(18 * SQFT_PER_SQM * 10000) / 10000);
  const back = convertArea(sqft, "sqft", "sqm");
  assert.ok(Math.abs(back - 18) < 0.001);
  assert.equal(convertArea(25, "sqm", "sqm"), 25);
});

test("selected candidate area stays close to the canonical area", () => {
  for (const area of [9, 12, 15, 18, 27, 36, 54, 100]) {
    const fp = createProvisionalFootprint(area, "sqm");
    assert.ok(
      Math.abs(fp.selected.areaSqm - fp.canonicalAreaSqm) <= 1.5,
      `${area}㎡ selected=${fp.selected.areaSqm}`,
    );
  }
});
