import assert from "node:assert/strict";
import test from "node:test";
import { addExpoComponent, createExpoScene, moveExpoComponent } from "../scene";
import {
  EXPO_HISTORY_LIMIT,
  applySceneChange,
  canRedoScene,
  canUndoScene,
  createSceneHistory,
  redoScene,
  resetSceneHistory,
  undoScene,
} from "../scene-history";

test("apply, undo and redo walk the same states", () => {
  const s1 = createExpoScene(6, 3);
  const s2 = addExpoComponent(s1, "info_counter", "c1");
  const s3 = moveExpoComponent(s2, "c1", 0.5, 0);

  let history = createSceneHistory(s1);
  history = applySceneChange(history, s2);
  history = applySceneChange(history, s3);
  assert.equal(history.present, s3);
  assert.ok(canUndoScene(history));

  history = undoScene(history);
  assert.equal(history.present, s2);
  history = undoScene(history);
  assert.equal(history.present, s1);
  assert.ok(!canUndoScene(history));

  history = redoScene(history);
  assert.equal(history.present, s2);
  assert.ok(canRedoScene(history));
  history = redoScene(history);
  assert.equal(history.present, s3);
  assert.ok(!canRedoScene(history));
});

test("a new change truncates the redo branch", () => {
  const s1 = createExpoScene(6, 3);
  const s2 = addExpoComponent(s1, "info_counter", "c1");
  const s2b = addExpoComponent(s1, "signage_tower", "t1");

  let history = createSceneHistory(s1);
  history = applySceneChange(history, s2);
  history = undoScene(history);
  history = applySceneChange(history, s2b);
  assert.equal(history.present, s2b);
  assert.ok(!canRedoScene(history));
});

test("history is capped and identical references are no-ops", () => {
  const base = addExpoComponent(createExpoScene(6, 3), "display_showcase", "c0");
  let history = createSceneHistory(base);
  let scene = base;
  for (let i = 0; i < EXPO_HISTORY_LIMIT + 10; i += 1) {
    // 좌우로 번갈아 이동 — 매번 새 리비전의 distinct 씬을 만든다.
    scene = moveExpoComponent(scene, "c0", i % 2 === 0 ? 0.5 : -0.5, 0);
    history = applySceneChange(history, scene);
  }
  assert.equal(history.past.length, EXPO_HISTORY_LIMIT);
  const same = applySceneChange(history, history.present!);
  assert.equal(same, history);
});

test("reset drops both stacks and undo/redo without present are no-ops", () => {
  const s1 = createExpoScene(6, 3);
  let history = createSceneHistory(s1);
  history = applySceneChange(history, addExpoComponent(s1, "info_counter", "c1"));
  history = resetSceneHistory(history, s1);
  assert.deepEqual(history.past, []);
  assert.deepEqual(history.future, []);

  const empty = createSceneHistory(null);
  assert.equal(undoScene(empty), empty);
  assert.equal(redoScene(empty), empty);
});
