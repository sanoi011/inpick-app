import assert from "node:assert/strict";
import test from "node:test";

import {
  PHOTO_RENDER_PROMPT_VERSION,
  buildPhotoRenderPrompt,
} from "../photo-render-prompt";

test("officetel photo mode cannot silently fall back to an apartment typology", () => {
  const prompt = buildPhotoRenderPrompt({
    projectMode: "photo_only",
    residentialType: "officetel",
    spaceType: "거실/다이닝",
    areaM2: 24,
    budgetTier: "standard",
    furnishingOptions: ["sinkUpper", "sinkLower", "fridgeCabinet", "kimchiCabinet"],
    stylePrompt: "warm oak and cream fabric",
  });

  assert.match(prompt, /Korean officetel/i);
  assert.match(prompt, /Do not convert.*apartment/i);
  assert.match(prompt, /24 m²/);
  assert.match(prompt, /상부장/);
  assert.match(prompt, /하부장/);
  assert.match(prompt, /냉장고장/);
  assert.match(prompt, /김치냉장고장/);
  assert.match(prompt, new RegExp(PHOTO_RENDER_PROMPT_VERSION));
});

test("commercial photo mode keeps business and zone identity", () => {
  const prompt = buildPhotoRenderPrompt({
    projectMode: "commercial",
    businessType: "cafe",
    zoneName: "카운터",
    stylePrompt: "quiet natural materials",
  });

  assert.match(prompt, /Business type: cafe/);
  assert.match(prompt, /Target zone: 카운터/);
});
