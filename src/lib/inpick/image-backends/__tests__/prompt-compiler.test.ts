import assert from "node:assert/strict";
import test from "node:test";
import { compileRenderPrompt } from "../prompt-compiler";
import type { RenderRoomSpec } from "@/lib/inpick/floorplan/render-room-spec";

test("two bathrooms stay separate in the architectural prompt", () => {
  const spec: RenderRoomSpec = {
    targetRoom: {
      id: "bath-2",
      name: "욕실2",
      type: "bathroom",
      bbox: { x: 6000, y: 2000, width: 2100, height: 1700 },
      areaM2: 3.57,
    },
    rooms: [
      { id: "bath", name: "욕실1", type: "bathroom" },
      {
        id: "bath-2",
        name: "욕실2",
        type: "bathroom",
        bbox: { x: 6000, y: 2000, width: 2100, height: 1700 },
        areaM2: 3.57,
      },
      { id: "kitchen", name: "주방", type: "kitchen" },
    ],
    attachedZones: [],
    openings: [],
    exteriorWalls: [],
    extensionOptions: {},
    renderConstraints: {
      mustShow: [],
      mustNotShow: [],
      cameraFacing: "unknown",
      explanationKo: "",
    },
    confidence: 0.9,
    warnings: [],
  };

  const prompt = compileRenderPrompt({
    roomName: "욕실2",
    renderRoomSpec: spec,
    userPrompt: "warm minimal",
  });
  assert.match(prompt, /bathroom=2 \[욕실1, 욕실2\]/);
  assert.match(prompt, /Render 욕실2 only/);
  assert.match(prompt, /x=6000mm/);
});

test("kitchen prompt explicitly rejects a generic fixed layout", () => {
  const spec: RenderRoomSpec = {
    targetRoom: { id: "kitchen", name: "주방", type: "kitchen" },
    rooms: [{ id: "kitchen", name: "주방", type: "kitchen" }],
    attachedZones: [],
    openings: [],
    exteriorWalls: [],
    extensionOptions: {},
    renderConstraints: {
      mustShow: [],
      mustNotShow: [],
      cameraFacing: "unknown",
      explanationKo: "",
    },
    confidence: 0.7,
    warnings: [],
  };

  const prompt = compileRenderPrompt({
    roomName: "주방",
    renderRoomSpec: spec,
  });
  assert.match(prompt, /Do not default to a standard U-shaped or L-shaped/);
});
