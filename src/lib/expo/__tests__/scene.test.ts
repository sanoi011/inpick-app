import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPO_BASE_CATALOG,
  ExpoSceneError,
  addExpoComponent,
  componentFootprintSize,
  createExpoScene,
  evaluateExpoScene,
  isExpoBoothScene,
  moveExpoComponent,
  removeExpoComponent,
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
