import assert from "node:assert/strict";
import { test } from "node:test";

import type { Step2Data } from "@/components/workflow/Step2Designer";
import type { DesignOutput } from "@/lib/inpick/estimate-context/types";
import type { SanitizedLockedAsset } from "@/lib/inpick/locked-design/contracts";
import { mergeRestoredDesigns } from "../restore-designs";

function output(overrides: Partial<DesignOutput> = {}): DesignOutput {
  return {
    id: "output-bath",
    projectId: "project-a",
    userId: "user-a",
    projectMode: "apartment",
    targetType: "room",
    targetId: "bath",
    targetName: "욕실",
    renderKind: "room_render",
    imageUrl: "locked-design:asset-bath",
    prompt: "밝은 욕실",
    materialHints: [],
    status: "analysis_done",
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

function asset(overrides: Partial<SanitizedLockedAsset> = {}): SanitizedLockedAsset {
  return {
    id: "asset-bath",
    designOutputId: "output-bath",
    projectId: "project-a",
    targetType: "room",
    targetId: "bath",
    targetName: "욕실",
    renderKind: "room_render",
    status: "completed",
    unlockCost: 1,
    mimeType: "image/webp",
    width: 1024,
    height: 1024,
    byteSize: 1000,
    createdAt: "2026-07-24T00:00:00.000Z",
    unlocked: true,
    viewUrl: "https://signed.example/bath.webp",
    viewExpiresAt: "2026-07-24T00:08:00.000Z",
    ...overrides,
  };
}

function emptyStep2(): Step2Data {
  return {
    selectedByRoom: {},
    generations: {},
    rendersByRoom: {},
    promptByRoom: {},
  };
}

test("a paid room image is restored with its signed URL and no paywall state", () => {
  const restored = mergeRestoredDesigns(emptyStep2(), [output()], [asset()]);
  const render = restored.rendersByRoom.bath[0];

  assert.equal(render.url, "https://signed.example/bath.webp");
  assert.equal(render.lockedAssetId, "asset-bath");
  assert.equal(render.accessState, "unlocked");
  assert.equal(render.entitlementGranted, true);
});

test("a locked marker is never treated as a public image URL", () => {
  const restored = mergeRestoredDesigns(emptyStep2(), [output()], []);
  const render = restored.rendersByRoom.bath[0];

  assert.equal(render.url, "");
  assert.equal(render.lockedAssetId, "asset-bath");
  assert.equal(render.accessState, "locked");
});

test("an existing lightweight render is rehydrated instead of duplicated", () => {
  const step2 = emptyStep2();
  step2.rendersByRoom.bath = [
    {
      url: "",
      lockedAssetId: "asset-bath",
      accessState: "locked",
      prompt: "밝은 욕실",
      costUsd: 0,
      timestamp: "2026-07-24T00:00:00.000Z",
    },
  ];

  const restored = mergeRestoredDesigns(step2, [output()], [asset()]);

  assert.equal(restored.rendersByRoom.bath.length, 1);
  assert.equal(
    restored.rendersByRoom.bath[0].url,
    "https://signed.example/bath.webp",
  );
  assert.equal(restored.rendersByRoom.bath[0].accessState, "unlocked");
});

test("an expired final selection URL is replaced with the restored signed URL", () => {
  const step2 = emptyStep2();
  step2.rendersByRoom.bath = [
    {
      url: "https://signed.example/expired.webp",
      lockedAssetId: "asset-bath",
      accessState: "unlocked",
      prompt: "밝은 욕실",
      costUsd: 0,
      timestamp: "2026-07-24T00:00:00.000Z",
    },
  ];
  step2.selectedByRoom.bath = 0;
  step2.finalSelectedImageUrlsByRoom = {
    bath: "https://signed.example/expired.webp",
  };

  const restored = mergeRestoredDesigns(step2, [output()], [asset()]);

  assert.equal(
    restored.finalSelectedImageUrlsByRoom?.bath,
    "https://signed.example/bath.webp",
  );
});
