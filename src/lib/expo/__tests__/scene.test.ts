import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogEstimate } from "../estimate";
import { confirmExpoDimensions } from "../footprint";
import {
  EXPO_BASE_CATALOG,
  ExpoSceneError,
  addExpoComponent,
  componentFootprintSize,
  createExpoScene,
  evaluateExpoScene,
  expoDecalPlacement,
  addWallFromPrompt,
  applyConceptSuggestions,
  promptMentionsWall,
  isExpoBoothScene,
  moveExpoComponent,
  removeExpoComponent,
  resizeExpoComponent,
  resizeExpoScene,
  rotateExpoComponent,
} from "../scene";

test("catalog items carry metre dimensions and versions", () => {
  assert.ok(EXPO_BASE_CATALOG.length >= 4);
  for (const item of EXPO_BASE_CATALOG) {
    assert.ok(item.widthM > 0 && item.depthM > 0 && item.heightM > 0);
    assert.ok(item.catalogVersion >= 1);
  }
});

test("adding a component places it at the snapped centre and bumps revision", () => {
  const scene = createExpoScene(6, 3);
  const next = addExpoComponent(scene, "info_counter", "c1");
  assert.equal(next.revision, scene.revision + 1);
  assert.deepEqual(
    next.components.map((c) => ({ id: c.id, x: c.x, z: c.z })),
    [{ id: "c1", x: 0, z: 0 }],
  );
  assert.throws(
    () => addExpoComponent(scene, "hologram", "c2"),
    (error: unknown) =>
      error instanceof ExpoSceneError &&
      error.code === "EXPO_SCENE_CATALOG_UNKNOWN",
  );
});

test("movement snaps to the 0.5m grid and clamps inside the booth", () => {
  let scene = addExpoComponent(createExpoScene(6, 3), "info_counter", "c1");
  scene = moveExpoComponent(scene, "c1", 0.4, 0);
  assert.equal(scene.components[0].x, 0.5);
  // 폭 6m, 카운터 폭 1m → 중심 최대 |x| = 2.5
  scene = moveExpoComponent(scene, "c1", 100, 0);
  assert.equal(scene.components[0].x, 2.5);
  scene = moveExpoComponent(scene, "c1", 0, -100);
  // 깊이 3m, 카운터 깊이 0.5m → 중심 최대 |z| = 1.25 → 그리드 내림 1.0
  assert.equal(scene.components[0].z, -1);
});

test("rotation swaps the footprint and re-clamps", () => {
  let scene = addExpoComponent(createExpoScene(4, 2), "product_table", "c1");
  const before = componentFootprintSize(scene.components[0]);
  assert.deepEqual(before, { w: 1.5, d: 0.7 });
  scene = rotateExpoComponent(scene, "c1");
  const after = componentFootprintSize(scene.components[0]);
  assert.deepEqual(after, { w: 0.7, d: 1.5 });
});

test("removal and unknown ids behave predictably", () => {
  const scene = addExpoComponent(createExpoScene(6, 3), "info_counter", "c1");
  const next = removeExpoComponent(scene, "c1");
  assert.equal(next.components.length, 0);
  assert.throws(
    () => removeExpoComponent(next, "c1"),
    (error: unknown) =>
      error instanceof ExpoSceneError &&
      error.code === "EXPO_SCENE_COMPONENT_NOT_FOUND",
  );
});

test("booth resize clamps existing components into the new bounds", () => {
  let scene = addExpoComponent(createExpoScene(6, 3), "info_counter", "c1");
  scene = moveExpoComponent(scene, "c1", 100, 0); // x=2.5
  scene = resizeExpoScene(scene, 3, 3);
  // 폭 3m → 최대 |x| = 1.0 (그리드 내림)
  assert.equal(scene.components[0].x, 1);
});

test("overlap and wall contact are warnings, not silent corrections", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "info_counter", "a");
  scene = addExpoComponent(scene, "product_table", "b");
  const overlapping = evaluateExpoScene(scene);
  assert.ok(
    overlapping.some(
      (w) =>
        w.code === "components_overlap" &&
        w.componentIds.includes("a") &&
        w.componentIds.includes("b"),
    ),
  );
  // product_table(1.5m)은 그리드 클램프가 벽에서 0.25m 띄운다 → 접촉 아님
  scene = moveExpoComponent(scene, "b", 100, 0);
  assert.equal(scene.components.find((c) => c.id === "b")?.x, 2);
  assert.ok(
    !evaluateExpoScene(scene).some(
      (w) => w.code === "component_touches_wall" && w.componentIds[0] === "b",
    ),
  );
  // info_counter(1m)는 x=2.5에서 벽면(3.0)에 정확히 닿는다 → 접촉 경고
  scene = moveExpoComponent(scene, "a", 100, 0);
  assert.equal(scene.components.find((c) => c.id === "a")?.x, 2.5);
  assert.ok(
    evaluateExpoScene(scene).some(
      (w) => w.code === "component_touches_wall" && w.componentIds[0] === "a",
    ),
  );
});

test("scene guard accepts round-tripped JSON and rejects junk", () => {
  const scene = addExpoComponent(createExpoScene(6, 3), "signage_tower", "s1");
  assert.ok(isExpoBoothScene(JSON.parse(JSON.stringify(scene))));
  assert.ok(!isExpoBoothScene(null));
  assert.ok(!isExpoBoothScene({ schemaVersion: 99 }));
});

test("wall-mounted elements reach the wall flush without a wall warning", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "graphic_wall", "g1");
  // 뒷벽 방향(-z)으로 계속 밀면 그리드 대신 벽면 밀착 한계까지 이동
  for (let i = 0; i < 6; i += 1) {
    scene = moveExpoComponent(scene, "g1", 0, -0.5);
  }
  const wall = scene.components.find((c) => c.id === "g1")!;
  // depth 0.1 → 한계 z = -(1.5 - 0.05) = -1.45 (벽면 밀착)
  assert.equal(wall.z, -1.45);
  const warnings = evaluateExpoScene(scene).filter(
    (w) => w.code === "component_touches_wall" && w.componentIds.includes("g1"),
  );
  assert.equal(warnings.length, 0);
});

test("non-wall components at the boundary still warn", () => {
  // 안내 카운터(1m)는 6m 부스에서 그리드 클램프 한계(x=2.5)가 벽면과 일치한다.
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "info_counter", "b1");
  for (let i = 0; i < 6; i += 1) {
    scene = moveExpoComponent(scene, "b1", 0.5, 0);
  }
  const warnings = evaluateExpoScene(scene).filter(
    (w) => w.code === "component_touches_wall" && w.componentIds.includes("b1"),
  );
  assert.ok(warnings.length >= 1);
});

test("new wall catalog items are priced in the costbook", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "graphic_wall", "g1");
  scene = addExpoComponent(scene, "lightbox_panel", "l1");
  scene = addExpoComponent(scene, "brochure_stand", "b1");
  const estimate = buildCatalogEstimate(
    scene,
    confirmExpoDimensions(
      { widthM: 6, depthM: 3, boothType: "inline", wallHeightM: 2.5 },
      "2026-07-26T00:00:00.000Z",
    ),
  );
  for (const id of [
    "component_graphic_wall",
    "component_lightbox_panel",
    "component_brochure_stand",
  ]) {
    assert.ok(
      estimate.lines.some((line) => line.id === id),
      `missing line: ${id}`,
    );
  }
});

test("decal placement follows rotation to the facing side", () => {
  const item = EXPO_BASE_CATALOG.find((i) => i.catalogId === "graphic_wall")!;
  const base = { id: "g1", catalogId: "graphic_wall", catalogVersion: 1, x: 0, z: -1.45, rotation: 0 };
  const front = expoDecalPlacement(base, item);
  assert.ok(front.z > base.z); // +z (부스 안쪽)
  assert.equal(front.rotationY, 0);
  assert.equal(front.faceWidth, item.widthM);
  assert.equal(front.faceHeight, item.heightM);
  const side = expoDecalPlacement({ ...base, rotation: 90 }, item);
  assert.ok(side.x > base.x); // +x
  assert.equal(side.faceWidth, item.widthM); // 회전해도 보이는 면 폭은 3m
});

test("prompt wall op adds one backwall only when asked and none exists", () => {
  assert.ok(promptMentionsWall("백월에 로고 크게"));
  assert.ok(promptMentionsWall("clean white backwall"));
  assert.ok(!promptMentionsWall("밝은 조명의 미니멀 부스"));

  let scene = createExpoScene(6, 3);
  scene = addWallFromPrompt(scene, "w1");
  const wall = scene.components.find((c) => c.id === "w1");
  assert.ok(wall);
  assert.equal(wall.catalogId, "graphic_wall");
  assert.equal(wall.z, -1.45); // 뒷면 밀착
  // 이미 벽 요소가 있으면 추가하지 않는다
  const again = addWallFromPrompt(scene, "w2");
  assert.equal(again.components.length, scene.components.length);
});

test("concept suggestions top up counts without touching existing placements", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "product_table", "mine");
  const before = scene.components.find((c) => c.id === "mine")!;
  const applied = applyConceptSuggestions(
    scene,
    [
      { catalogId: "product_table", count: 2 },
      { catalogId: "graphic_wall", count: 1 },
      { catalogId: "mystery", count: 3 },
      { catalogId: "info_counter", count: 99 },
    ],
    "ai",
  );
  const tables = applied.components.filter((c) => c.catalogId === "product_table");
  assert.equal(tables.length, 2); // 기존 1 + 부족분 1
  const mine = applied.components.find((c) => c.id === "mine")!;
  assert.deepEqual({ x: mine.x, z: mine.z }, { x: before.x, z: before.z });
  assert.equal(applied.components.filter((c) => c.catalogId === "graphic_wall").length, 1);
  assert.equal(applied.components.filter((c) => c.catalogId === "mystery").length, 0);
  assert.equal(applied.components.filter((c) => c.catalogId === "info_counter").length, 4); // 종류당 캡
  const wall = applied.components.find((c) => c.catalogId === "graphic_wall")!;
  assert.equal(wall.z, -1.45); // 뒷면 밀착
});

test("component size overrides resize the footprint and survive rotation", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "product_table", "t1");
  scene = resizeExpoComponent(scene, "t1", 2.5, 1.2);
  const resized = scene.components.find((c) => c.id === "t1")!;
  assert.equal(resized.widthM, 2.5);
  assert.equal(resized.depthM, 1.2);
  assert.deepEqual(componentFootprintSize(resized), { w: 2.5, d: 1.2 });
  scene = rotateExpoComponent(scene, "t1");
  const rotated = scene.components.find((c) => c.id === "t1")!;
  assert.deepEqual(componentFootprintSize(rotated), { w: 1.2, d: 2.5 });
  // 극단값은 0.1–20m로 클램프
  scene = resizeExpoComponent(scene, "t1", 0.01, 999);
  const clamped = scene.components.find((c) => c.id === "t1")!;
  assert.equal(clamped.widthM, 0.1);
  assert.equal(clamped.depthM, 20);
});
