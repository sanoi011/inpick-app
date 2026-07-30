import assert from "node:assert/strict";
import test from "node:test";

import {
  getNativeOAuthRedirect,
  HANKWON_NATIVE_OAUTH_REDIRECT,
  INPICK_NATIVE_OAUTH_REDIRECT,
  isHankwonNativeRuntime,
} from "../oauth-start";

test("한권 네이티브 UA는 한권 전용 OAuth 콜백을 사용한다", () => {
  const userAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) HankwonNative/1 CapacitorWebView";

  assert.equal(isHankwonNativeRuntime(userAgent), true);
  assert.equal(getNativeOAuthRedirect(userAgent), HANKWON_NATIVE_OAUTH_REDIRECT);
});

test("기존 인픽 네이티브 UA는 기존 콜백을 유지한다", () => {
  const userAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) InPickNative/7 CapacitorWebView";

  assert.equal(isHankwonNativeRuntime(userAgent), false);
  assert.equal(getNativeOAuthRedirect(userAgent), INPICK_NATIVE_OAUTH_REDIRECT);
});

test("브라우저 UA를 한권 앱으로 오인하지 않는다", () => {
  const userAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";

  assert.equal(isHankwonNativeRuntime(userAgent), false);
});
