import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("리뷰 owner view와 답변은 사업자 토큰 ID를 대조한다", () => {
  const route = source("src/app/api/contractor/reviews/route.ts");
  assert.match(route, /getContractorIdFromRequest/);
  assert.match(route, /contractorId !== authContractorId/);
});

test("업로드는 사업자 토큰 ID와 저장 경로 ID를 대조한다", () => {
  const route = source("src/app/api/contractor/upload/route.ts");
  const page = source("src/app/contractor/profile/page.tsx");
  assert.match(route, /getContractorIdFromRequest/);
  assert.match(route, /contractorId !== authContractorId/);
  assert.match(page, /authFetch\("\/api\/contractor\/upload"/);
});

test("공개 업체 상세 API는 연락처·주소·서류 원본을 선택하지 않는다", () => {
  const route = source("src/app/api/contractors/[id]/route.ts");
  const selection = route.match(/\.select\(`([\s\S]*?)`\)/)?.[1] || "";
  assert.doesNotMatch(selection, /\bphone\b|\bemail\b|\baddress\b|license_number|business_license_url/);
});

test("RFQ shortlist는 UI와 API 모두 최대 3개다", () => {
  const page = source("src/app/workflow/bidding/page.tsx");
  const route = source("src/app/api/rfq/publish/route.ts");
  assert.match(page, /최대 3개 적합 업체/);
  assert.doesNotMatch(page, /5개 업체/);
  assert.match(route, /const shortlistSize = 3 as const/);
  assert.doesNotMatch(route, /3 \| 5/);
});

test("사업자 토큰에는 공개된 고정 fallback secret이 없다", () => {
  const auth = source("src/lib/contractor-auth.ts");
  assert.doesNotMatch(auth, /inpick-contractor-secret/);
  assert.match(auth, /CONTRACTOR_JWT_SECRET 또는 ADMIN_PASSWORD가 필요합니다/);
});

test("운영 비밀번호 재설정 응답에는 reset token URL을 포함하지 않는다", () => {
  const route = source("src/app/api/contractor/forgot-password/route.ts");
  assert.match(route, /NODE_ENV !== "production"/);
  assert.match(route, /운영에서는 reset token을 응답·로그로 노출하지 않는다/);
});

test("OAuth 토큰 교환은 서버가 Supabase 사용자 이메일을 확인한다", () => {
  const route = source("src/app/api/contractor/login/route.ts");
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /user\.email\.toLowerCase\(\) !== email/);
});

test("401 응답은 stale 사업자 토큰을 폐기한다", () => {
  const hook = source("src/hooks/useContractorAuth.ts");
  assert.match(hook, /response\.status === 401/);
  assert.match(hook, /removeItem\("contractor_token"\)/);
});

test("문의 API는 정보 공유 동의와 버전을 서버에서 검증한다", () => {
  const route = source("src/app/api/contractors/[id]/inquiry/route.ts");
  const modal = source("src/components/contractor/InquiryModal.tsx");
  assert.match(route, /sharingAccepted !== true/);
  assert.match(route, /contractor-inquiry-v1/);
  assert.match(modal, /consentVersion: CONSENT_VERSION/);
});

test("프로필 API는 allowlist를 사용하고 문서 공개 업로드를 막는다", () => {
  const profile = source("src/app/api/contractor/profile/route.ts");
  const upload = source("src/app/api/contractor/upload/route.ts");
  assert.doesNotMatch(profile, /\.select\(`\s*\*/);
  assert.doesNotMatch(profile, /password_hash/);
  assert.match(upload, /folder === "documents"/);
  assert.match(upload, /보호 문서 스토리지 연결 후/);
});
