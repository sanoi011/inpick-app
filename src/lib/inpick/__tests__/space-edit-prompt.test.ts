import assert from "node:assert/strict";
import test from "node:test";

import {
  SPACE_EDIT_PROMPT_VERSION,
  buildSpaceEditPrompt,
} from "../space-edit-prompt";

test("residential space edit keeps source photograph as the geometry authority", () => {
  const prompt = buildSpaceEditPrompt({
    projectMode: "photo_only",
    residentialType: "officetel",
    spaceType: "거실",
    editPrompt: "화이트 오크와 웜그레이로 바꿔줘",
    targetSurfaces: ["floor", "wall"],
    budgetTier: "standard",
  });

  assert.match(prompt, new RegExp(SPACE_EDIT_PROMPT_VERSION));
  assert.match(prompt, /source of truth for geometry/i);
  assert.match(prompt, /Residential type: "officetel"/);
  assert.match(prompt, /Do not add, remove, resize, or relocate walls/i);
  assert.match(prompt, /"floor"/);
  assert.match(prompt, /화이트 오크/);
});

test("commercial space edit carries business and zone identity", () => {
  const prompt = buildSpaceEditPrompt({
    projectMode: "commercial",
    businessType: "office",
    zoneName: "회의실",
    spaceType: "회의실",
    editPrompt: "흡음 패널과 간접 조명을 적용해줘",
  });

  assert.match(prompt, /Mode: commercial/);
  assert.match(prompt, /Business type: "office"/);
  assert.match(prompt, /Target zone: "회의실"/);
  assert.match(prompt, /preserving its existing architecture/i);
});
