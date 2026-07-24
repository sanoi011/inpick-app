import assert from "node:assert/strict";
import test from "node:test";
import {
  isDesignGenerationRequest,
  routePromptToRoom,
} from "../prompt-room-router";

const tabs = [
  { key: "all", label: "전체" },
  { key: "living", label: "거실" },
  { key: "master", label: "안방" },
  { key: "bedroom", label: "침실" },
  { key: "kitchen", label: "주방" },
];

test("routes an edit request to the explicitly mentioned room and surface", () => {
  const route = routePromptToRoom(
    "안방 문은 밝은 오크 방문으로 바꿔줘",
    tabs,
    "living",
    new Set(["living", "master"]),
  );

  assert.equal(route.roomKey, "master");
  assert.equal(route.shouldEditExistingImage, true);
  assert.deepEqual(route.targetSurfaces, ["door"]);
});

test("uses the selected room when no room name is mentioned", () => {
  const route = routePromptToRoom(
    "바닥을 밝은 원목 마루로 변경해줘",
    tabs,
    "kitchen",
    new Set(["kitchen"]),
  );

  assert.equal(route.roomKey, "kitchen");
  assert.equal(route.mentionedRoom, false);
  assert.equal(route.shouldEditExistingImage, true);
  assert.deepEqual(route.targetSurfaces, ["floor"]);
});

test("does not confuse the Korean word 방문 with the generic bedroom category", () => {
  const route = routePromptToRoom(
    "안방 방문만 흰색으로 교체해줘",
    tabs,
    "living",
    new Set(["master", "bedroom"]),
  );

  assert.equal(route.roomKey, "master");
  assert.deepEqual(route.targetSurfaces, ["door"]);
});

test("keeps consultation mode when the target room has no generated image", () => {
  const route = routePromptToRoom(
    "침실 벽지를 웜그레이로 바꿔줘",
    tabs,
    "living",
    new Set(["living"]),
  );

  assert.equal(route.roomKey, "bedroom");
  assert.equal(route.shouldEditExistingImage, false);
});

test("detects explicit room image generation requests", () => {
  assert.equal(isDesignGenerationRequest("이 스타일로 이미지 생성해줘"), true);
  assert.equal(isDesignGenerationRequest("현관 시안 만들어 주세요"), true);
  assert.equal(isDesignGenerationRequest("골드 톤은 어떤가요?"), false);
});

test("treats an affirmative answer to the generation question as a request", () => {
  assert.equal(
    isDesignGenerationRequest("네", "이 컨셉으로 이미지를 생성하시겠습니까?"),
    true,
  );
  assert.equal(isDesignGenerationRequest("네", "골드 톤으로 할까요?"), false);
});
