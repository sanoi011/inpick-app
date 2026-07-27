import assert from "node:assert/strict";
import test from "node:test";
import { addExpoComponent, createExpoScene, removeExpoComponent } from "../scene";
import {
  allPrintsConfirmed,
  derivePrintItems,
  isExpoPrintItems,
} from "../print-items";

test("print items derive from wall/signage components and keep user data", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "graphic_wall", "w1");
  scene = addExpoComponent(scene, "signage_tower", "s1");
  scene = addExpoComponent(scene, "product_table", "t1"); // 인쇄물 아님

  const first = derivePrintItems(scene, []);
  assert.equal(first.length, 2);
  assert.equal(first[0].label, "백월 그래픽 1");

  const edited = first.map((item) =>
    item.id === "w1" ? { ...item, note: "로고 크게", confirmed: true } : item,
  );
  scene = addExpoComponent(scene, "lightbox_panel", "l1");
  const merged = derivePrintItems(scene, edited);
  assert.equal(merged.length, 3);
  assert.equal(merged.find((i) => i.id === "w1")?.note, "로고 크게");
  assert.equal(merged.find((i) => i.id === "w1")?.confirmed, true);

  scene = removeExpoComponent(scene, "s1");
  const pruned = derivePrintItems(scene, merged);
  assert.equal(pruned.length, 2);
  assert.ok(!pruned.some((i) => i.id === "s1"));
});

test("confirmation requires every item and guard validates shape", () => {
  const scene = addExpoComponent(createExpoScene(6, 3), "graphic_wall", "w1");
  const items = derivePrintItems(scene, []);
  assert.ok(!allPrintsConfirmed(items));
  assert.ok(allPrintsConfirmed(items.map((i) => ({ ...i, confirmed: true }))));
  assert.ok(!allPrintsConfirmed([]));
  assert.ok(isExpoPrintItems(items));
  assert.ok(!isExpoPrintItems([{ id: 1 }]));
});
