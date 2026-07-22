import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const routeSource = readFileSync(
  resolve(process.cwd(), "src/app/api/contractor/profile/route.ts"),
  "utf8",
);
const pageSource = readFileSync(
  resolve(process.cwd(), "src/app/contractor/profile/page.tsx"),
  "utf8",
);

test("사업자 프로필 API는 토큰 사업자와 요청 사업자가 일치해야 한다", () => {
  assert.match(routeSource, /getContractorIdFromRequest/);
  assert.match(routeSource, /authContractorId/);
  assert.match(routeSource, /contractorId\s*!==\s*authContractorId/);
  assert.match(routeSource, /status:\s*401/);
  assert.match(routeSource, /status:\s*403/);
});

test("사업자 프로필 화면은 private API에 authFetch를 사용한다", () => {
  assert.match(pageSource, /authFetch/);
  assert.doesNotMatch(pageSource, /fetch\(`?\/api\/contractor\/profile/);
});
