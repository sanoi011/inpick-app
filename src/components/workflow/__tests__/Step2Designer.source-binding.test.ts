import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/components/workflow/Step2Designer.tsx"),
  "utf8",
);

test("기존 프로젝트의 SKU 상태는 호환 데이터로만 유지한다", () => {
  assert.match(source, /roomProductCustomizations\?:/);
  assert.match(source, /bindRoomProductCustomizationToSource\(/);
});

test("SKU image edit로 만든 파생 시안에는 선택을 새 render identity로 명시 승계한다", () => {
  assert.match(source, /carryRoomProductCustomizationToSource\(/);
  assert.match(source, /roomProductCustomizations:\s*\{/);
  assert.match(source, /renderUnlockKey\(editedRender, nextIndex\)/);
});

test("출시 Step2 화면에는 실제 제품 선택 컴포넌트를 마운트하지 않는다", () => {
  assert.match(source, /const ROOM_PRODUCT_CUSTOMIZATION_ENABLED = false/);
  assert.match(source, /ROOM_PRODUCT_CUSTOMIZATION_ENABLED && roomCustomization/);
  assert.doesNotMatch(source, /import RoomProductImageSelector/);
  assert.doesNotMatch(source, /<RoomProductImageSelector/);
});
