import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/components/workflow/RoomProductImageSelector.tsx"),
  "utf8",
);

test("고정 좌표 화살표 대신 클릭 경계 선택기를 사용한다", () => {
  assert.match(source, /<ClickableRenderImage/);
  assert.match(source, /confirmBoundary/);
  assert.doesNotMatch(source, /markerEnd=/);
  assert.doesNotMatch(source, /part\.target\.x/);
  assert.doesNotMatch(source, /part\.label\.x/);
});

test("경계가 현재 source render와 일치해야 SKU 재생성이 활성화된다", () => {
  assert.match(source, /activeRegion\?\.sourceRenderKey === value\.sourceRenderKey/);
  assert.match(source, /buildRoomProductPromptMarkdown\(\s*value,\s*activeDefinition\.partCode/);
});
