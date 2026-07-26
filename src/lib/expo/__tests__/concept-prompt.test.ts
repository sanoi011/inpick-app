import assert from "node:assert/strict";
import test from "node:test";
import { addExpoComponent, createExpoScene } from "../scene";
import {
  EXPO_CONCEPT_PROMPT_MAX,
  ExpoConceptPromptError,
  buildBoothConceptPrompt,
} from "../concept-prompt";

const BASE = {
  widthM: 6,
  depthM: 3,
  wallHeightM: 2.5,
  boothType: "inline" as const,
  dimensionsConfirmed: false,
  scene: null,
  userPrompt: "",
};

test("prompt carries dimensions, booth type and the no-logo rule", () => {
  const prompt = buildBoothConceptPrompt(BASE);
  assert.ok(prompt.includes("6m wide x 3m deep"));
  assert.ok(prompt.includes("wall height 2.5m"));
  assert.ok(prompt.includes("inline booth"));
  assert.ok(prompt.includes("do NOT render any real brand logos"));
  assert.ok(prompt.includes("concept visualization only"));
});

test("provisional wording appears only before confirmation", () => {
  const provisional = buildBoothConceptPrompt(BASE);
  assert.ok(provisional.includes("provisional assumptions"));
  const confirmed = buildBoothConceptPrompt({
    ...BASE,
    dimensionsConfirmed: true,
  });
  assert.ok(confirmed.includes("confirmed from the event manual"));
  assert.ok(!confirmed.includes("provisional assumptions"));
});

test("scene components are summarized with quantities", () => {
  let scene = createExpoScene(6, 3);
  scene = addExpoComponent(scene, "info_counter", "c1");
  scene = addExpoComponent(scene, "info_counter", "c2");
  scene = addExpoComponent(scene, "graphic_wall", "g1");
  const prompt = buildBoothConceptPrompt({ ...BASE, scene });
  assert.ok(prompt.includes("2x info counter"));
  assert.ok(prompt.includes("1x large backwall graphic panel"));
  assert.ok(prompt.includes("matching the builder's 3D layout"));
});

test("user prompt is included; empty prompt falls back to default direction", () => {
  const custom = buildBoothConceptPrompt({
    ...BASE,
    userPrompt: "화이트+우드 미니멀 테크 부스",
  });
  assert.ok(custom.includes("화이트+우드 미니멀 테크 부스"));
  const fallback = buildBoothConceptPrompt(BASE);
  assert.ok(fallback.includes("clean contemporary Korean exhibition booth"));
});

test("invalid dims and oversized prompts are rejected", () => {
  assert.throws(
    () => buildBoothConceptPrompt({ ...BASE, widthM: 0 }),
    (e: unknown) =>
      e instanceof ExpoConceptPromptError &&
      e.code === "EXPO_CONCEPT_DIMS_INVALID",
  );
  assert.throws(
    () =>
      buildBoothConceptPrompt({
        ...BASE,
        userPrompt: "a".repeat(EXPO_CONCEPT_PROMPT_MAX + 1),
      }),
    (e: unknown) =>
      e instanceof ExpoConceptPromptError &&
      e.code === "EXPO_CONCEPT_PROMPT_TOO_LONG",
  );
});
