import assert from "node:assert/strict";
import test from "node:test";

import { mapPhotoSourcesToRooms } from "../photo-source-mapping";

test("uploaded photos stay attached to ordered rooms instead of becoming an apartment-wide text prompt", () => {
  const mapped = mapPhotoSourcesToRooms({
    roomKeys: ["living", "kitchen", "bath"],
    sourceImages: [
      { dataUrl: "data:image/png;base64,living" },
      { dataUrl: "data:image/png;base64,kitchen" },
      { dataUrl: "data:image/png;base64,bath" },
    ],
  });

  assert.equal(mapped.living?.dataUrl, "data:image/png;base64,living");
  assert.equal(mapped.kitchen?.dataUrl, "data:image/png;base64,kitchen");
  assert.equal(mapped.bath?.dataUrl, "data:image/png;base64,bath");
});

test("one uploaded studio photo is reused as a geometry reference without inventing extra sources", () => {
  const source = { dataUrl: "data:image/jpeg;base64,studio" };
  const mapped = mapPhotoSourcesToRooms({
    roomKeys: ["living", "kitchen"],
    sourceImages: [source],
  });

  assert.equal(mapped.living, source);
  assert.equal(mapped.kitchen, source);
});
