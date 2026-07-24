import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDesignChatSystemContext,
  buildImagePromptContextSuffix,
  buildInitialDesignChatMessage,
  sanitizeDesignChatContext,
} from "../design-chat-context";

const apartmentContext = {
  projectMode: "apartment" as const,
  workflowEntry: "apartment_drawing" as const,
  buildingType: "apartment" as const,
  address: "대전광역시 중구 대전천서로 709",
  complexName: "중촌동 센터파크",
  pyeongName: "79평",
  exclusiveAreaM2: 59.98,
  expansionType: "extended" as const,
  budgetManwon: 3_500,
  selectedRooms: ["거실", "주방", "욕실"],
  activeRoom: "주방",
  floorplanRooms: [
    { name: "주방", widthMm: 3_600, depthMm: 3_200, heightMm: 2_300 },
  ],
};

test("initial chat message acknowledges Step 1 facts instead of asking for them again", () => {
  const message = buildInitialDesignChatMessage(apartmentContext);

  assert.match(message, /아파트/);
  assert.match(message, /59\.98㎡/);
  assert.match(message, /발코니 확장형/);
  assert.match(message, /거실, 주방, 욕실/);
  assert.doesNotMatch(message, /아파트인지|주택인지|평수.*알려/);
});

test("system context marks Step 1 fields as authoritative and blocks duplicate questions", () => {
  const prompt = buildDesignChatSystemContext(apartmentContext);

  assert.match(prompt, /Step 1에서 직접 선택/);
  assert.match(prompt, /"buildingType": "apartment"/);
  assert.match(prompt, /"exclusiveAreaM2": 59\.98/);
  assert.match(prompt, /아파트인지 주택인지 다시 묻지 마라/);
  assert.match(prompt, /어떤 공간을 꾸밀지 다시 묻지 말고/);
});

test("image prompt suffix carries spatial facts but excludes the exact address", () => {
  const suffix = buildImagePromptContextSuffix(apartmentContext);

  assert.match(suffix, /Korean apartment residence/);
  assert.match(suffix, /59\.98 square meters/);
  assert.match(suffix, /extended balcony layout/);
  assert.match(suffix, /target room: 주방/);
  assert.match(suffix, /strictly follow the supplied floor plan/);
  assert.doesNotMatch(suffix, /대전천서로|센터파크/);
});

test("incoming context is bounded before being sent to an AI provider", () => {
  const context = sanitizeDesignChatContext({
    ...apartmentContext,
    address: "가".repeat(2_000),
    selectedRooms: Array.from({ length: 100 }, (_, index) => `실 ${index}`),
    exclusiveAreaM2: Number.POSITIVE_INFINITY,
  });

  assert.ok(context);
  assert.equal(context.address?.length, 240);
  assert.equal(context.selectedRooms?.length, 24);
  assert.equal(context.exclusiveAreaM2, undefined);
});
