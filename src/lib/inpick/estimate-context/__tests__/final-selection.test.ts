import assert from "node:assert/strict";
import test from "node:test";
import { selectFinalDesignOutputs } from "../final-selection";
import type { DesignOutput } from "../types";

function output(targetId: string, imageUrl: string, createdAt: string): DesignOutput {
  return {
    id: `${targetId}:${imageUrl}`,
    projectId: "project-1",
    userId: "user-1",
    projectMode: "apartment",
    targetType: "room",
    targetId,
    targetName: targetId,
    renderKind: "room_render",
    imageUrl,
    materialHints: [],
    status: "generated",
    createdAt,
    updatedAt: createdAt,
  };
}

test("keeps exactly one explicitly selected image per room", () => {
  const outputs = [
    output("living", "https://img/old.png", "2026-07-18T10:00:00.000Z"),
    output("living", "https://img/final.png", "2026-07-18T11:00:00.000Z"),
    output("master", "https://img/master.png", "2026-07-18T12:00:00.000Z"),
  ];

  const selected = selectFinalDesignOutputs(
    outputs,
    [{ targetId: "living", imageUrl: "https://img/final.png" }],
    { projectId: "project-1", userId: "user-1", projectMode: "apartment" },
  );

  assert.equal(selected.length, 1);
  assert.equal(selected[0].targetId, "living");
  assert.equal(selected[0].imageUrl, "https://img/final.png");
});

test("final room label replaces a stale whole-space label on a matched output", () => {
  const stale = output(
    "living",
    "https://img/living.png",
    "2026-07-25T01:00:00.000Z",
  );
  stale.targetName = "전체";

  const selected = selectFinalDesignOutputs(
    [stale],
    [{
      targetId: "living",
      targetName: "거실",
      imageUrl: "https://img/living.png",
    }],
    { projectId: "project-1", userId: "user-1", projectMode: "apartment" },
  );

  assert.equal(selected[0].targetId, "living");
  assert.equal(selected[0].targetName, "거실");
});

test("creates a selected snapshot when its asynchronous DB save has not arrived yet", () => {
  const selected = selectFinalDesignOutputs(
    [],
    [{
      targetId: "master",
      targetName: "안방",
      imageUrl: "data:image/png;base64,abc",
      prompt: "오크 강마루와 실크 벽지",
    }],
    { projectId: "project-1", userId: "user-1", projectMode: "apartment" },
  );

  assert.equal(selected.length, 1);
  assert.equal(selected[0].targetName, "안방");
  assert.equal(selected[0].imageUrl, "data:image/png;base64,abc");
  assert.deepEqual(
    Array.from(new Set(selected[0].materialHints.map((hint) => hint.surfaceType))).sort(),
    ["floor", "wall"],
  );
});

test("does not copy material analysis from a different image in the same room", () => {
  const old = output("bath", "https://img/old-bath.png", "2026-07-18T10:00:00.000Z");
  old.materialHints = [{
    surfaceType: "floor",
    materialCategory: "old_tile",
    materialNameKo: "이전 타일",
    confidence: 0.9,
    source: "vision_analysis",
  }];

  const selected = selectFinalDesignOutputs(
    [old],
    [{
      targetId: "bath",
      targetName: "욕실",
      imageUrl: "https://img/new-bath.png",
      prompt: "새 포세린 타일 욕실",
    }],
    { projectId: "project-1", userId: "user-1", projectMode: "apartment" },
  );

  assert.equal(selected[0].id.startsWith("final-selected:"), true);
  assert.equal(selected[0].materialHints[0]?.materialCategory, "porcelain_tile");
  assert.equal(
    selected[0].materialHints.some((hint) => hint.materialCategory === "old_tile"),
    false,
  );
});
