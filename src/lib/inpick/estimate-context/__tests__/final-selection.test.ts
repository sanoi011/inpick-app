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

test("creates a selected snapshot when its asynchronous DB save has not arrived yet", () => {
  const selected = selectFinalDesignOutputs(
    [],
    [{ targetId: "master", targetName: "안방", imageUrl: "data:image/png;base64,abc" }],
    { projectId: "project-1", userId: "user-1", projectMode: "apartment" },
  );

  assert.equal(selected.length, 1);
  assert.equal(selected[0].targetName, "안방");
  assert.equal(selected[0].imageUrl, "data:image/png;base64,abc");
});
