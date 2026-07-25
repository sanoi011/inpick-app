import assert from "node:assert/strict";
import test from "node:test";
import {
  getCanonicalAuthUrl,
  getRootOAuthRecoveryUrl,
} from "../oauth-recovery";

test("비-www 운영 OAuth 요청을 www 호스트로 옮기며 query를 보존한다", () => {
  const canonical = getCanonicalAuthUrl(
    "https://interiorpick.co.kr/?code=abcdefghijklmnopqrstuvwxyz123456&next=%2Fworkflow",
  );

  assert.equal(
    canonical?.toString(),
    "https://www.interiorpick.co.kr/?code=abcdefghijklmnopqrstuvwxyz123456&next=%2Fworkflow",
  );
});

test("비-www 로그인 시작과 callback도 www 호스트로 통일한다", () => {
  assert.equal(
    getCanonicalAuthUrl(
      "https://interiorpick.co.kr/auth?type=consumer&returnUrl=%2Fworkflow",
    )?.toString(),
    "https://www.interiorpick.co.kr/auth?type=consumer&returnUrl=%2Fworkflow",
  );
  assert.equal(
    getCanonicalAuthUrl(
      "https://interiorpick.co.kr/auth/callback?code=abcdefghijklmnopqrstuvwxyz123456",
    )?.toString(),
    "https://www.interiorpick.co.kr/auth/callback?code=abcdefghijklmnopqrstuvwxyz123456",
  );
});

test("일반 페이지와 www·로컬 호스트에는 canonical redirect를 만들지 않는다", () => {
  assert.equal(
    getCanonicalAuthUrl("https://www.interiorpick.co.kr/auth"),
    null,
  );
  assert.equal(getCanonicalAuthUrl("https://interiorpick.co.kr/community"), null);
  assert.equal(getCanonicalAuthUrl("http://127.0.0.1:3000/auth"), null);
});

test("Site URL 루트로 폴백한 OAuth code를 callback으로 복구한다", () => {
  const callback = getRootOAuthRecoveryUrl(
    "https://www.interiorpick.co.kr/?code=abcdefghijklmnopqrstuvwxyz123456&next=%2Fworkflow",
  );

  assert.equal(
    callback?.toString(),
    "https://www.interiorpick.co.kr/auth/callback?code=abcdefghijklmnopqrstuvwxyz123456&next=%2Fworkflow",
  );
});

test("짧은 일반 code나 callback 이외 경로는 OAuth로 오인하지 않는다", () => {
  assert.equal(
    getRootOAuthRecoveryUrl("https://www.interiorpick.co.kr/?code=promo10"),
    null,
  );
  assert.equal(
    getRootOAuthRecoveryUrl(
      "https://www.interiorpick.co.kr/community?code=abcdefghijklmnopqrstuvwxyz123456",
    ),
    null,
  );
});
