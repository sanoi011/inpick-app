import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/components/workflow/Step2Designer.tsx"),
  "utf8",
);

test("Step2 실별 SKU 상태는 현재 선택된 source render에 결합된다", () => {
  assert.match(source, /bindRoomProductCustomizationToSource\(/);
  assert.match(source, /sourceRenderKey:\s*activeRenderKey/);
});

test("SKU image edit로 만든 파생 시안에는 선택을 새 render identity로 명시 승계한다", () => {
  assert.match(source, /carryRoomProductCustomizationToSource\(/);
  assert.match(source, /roomProductCustomizations:\s*\{/);
  assert.match(source, /renderUnlockKey\(editedRender, nextIndex\)/);
});

test("SKU 재생성은 SAM 경계 마스크와 고정 project identity를 사용한다", () => {
  assert.match(source, /selectionMaskUrl:\s*request\.region\.maskUrl/);
  assert.ok(source.includes('fetch("/api/inpick/refine-render"'));
  assert.match(source, /isActiveWorkflowProjectId\(workflowProjectId\)/);
  assert.match(source, /request\.region\.sourceRenderKey !== sourceRenderKey/);
});

test("출시 UI에서는 실제 제품 교체를 숨기고 과거 SKU prompt도 주입하지 않는다", () => {
  assert.match(source, /const ROOM_PRODUCT_CUSTOMIZATION_ENABLED = false/);
  assert.match(
    source,
    /ROOM_PRODUCT_CUSTOMIZATION_ENABLED &&\s*activeRoom !== "all"/,
  );
  assert.match(
    source,
    /ROOM_PRODUCT_CUSTOMIZATION_ENABLED && roomCustomization/,
  );
});

test("이미지 생성 prompt는 전체 공통과 각 실을 독립 key로 저장한다", () => {
  assert.match(
    source,
    /const activePromptKey = activeRoom === "all" \? GLOBAL_PROMPT_KEY : activeRoom/,
  );
  assert.match(source, /\[activePromptKey\]: text/);
});

test("실별 렌더 요청에 전체 도면 그래프를 전달한다", () => {
  assert.match(source, /buildParsedFloorPlanFromWorkflow\(normalizedFloorplan\)/);
  assert.match(source, /parsedFloorPlan,/);
  assert.match(source, /buildWorkflowFloorplanEvidence\(/);
});
