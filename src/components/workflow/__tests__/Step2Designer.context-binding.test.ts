import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const step2Source = readFileSync(
  resolve(process.cwd(), "src/components/workflow/Step2Designer.tsx"),
  "utf8",
);
const workflowSource = readFileSync(
  resolve(process.cwd(), "src/app/workflow/page.tsx"),
  "utf8",
);
const streamRouteSource = readFileSync(
  resolve(process.cwd(), "src/app/api/inpick/design-chat/stream/route.ts"),
  "utf8",
);
const extractRouteSource = readFileSync(
  resolve(process.cwd(), "src/app/api/inpick/design-chat/extract/route.ts"),
  "utf8",
);

test("Step 1 building type and spatial facts are bound to both chat API calls", () => {
  assert.match(workflowSource, /buildingType=\{step1\.buildingType\}/);
  assert.match(step2Source, /const designChatContext = useMemo<DesignChatContext>/);
  assert.match(step2Source, /context: designChatContext/);
  assert.match(
    step2Source,
    /extractDesignPrompt\(chatMessages,\s*designChatContext\)/,
  );
});

test("streaming consultation and prompt extraction both consume Step 1 context", () => {
  assert.match(streamRouteSource, /buildDesignChatSystemContext\(context\)/);
  assert.match(extractRouteSource, /sanitizeDesignChatContext\(rawContext\)/);
  assert.match(extractRouteSource, /buildDesignChatSystemContext\(context\)/);
  assert.match(extractRouteSource, /buildImagePromptContextSuffix\(context\)/);
});
