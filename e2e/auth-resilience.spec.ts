import { expect, test } from "@playwright/test";

const USER_ID = "aaaaaaaa-2222-4333-8444-555555555555";
const PRODUCTION_STORAGE_KEY = "sb-pyhsjjtxcfmkcqmaxozd-auth-token";

test("OAuth callback이 큰 세션을 브라우저 쿠키에 저장한 뒤 워크플로우를 연다", async ({
  page,
  context,
}) => {
  const expiresAt = Math.floor(Date.now() / 1_000) + 3_600;
  const oauthUser = {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "oauth-browser@inpick.test",
    app_metadata: { provider: "google", providers: ["google"] },
    // 운영 Google 계정처럼 세션이 쿠키 2개 이상으로 분할되는 크기를 재현한다.
    user_metadata: { name: "OAuth Browser Test", padding: "x".repeat(5_500) },
    created_at: "2026-07-25T00:00:00.000Z",
  };
  const payload = btoa(
    JSON.stringify({
      sub: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: oauthUser.email,
      exp: expiresAt,
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const accessToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.test-signature`;

  await page.addInitScript(() => {
    sessionStorage.setItem("inpick_purged_v4", "1");
  });
  await page.route("**/auth/v1/token?grant_type=pkce", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      auth_code?: string;
      code_verifier?: string;
    };
    expect(requestBody.auth_code).toBe("test-oauth-code");
    expect(requestBody.code_verifier).toBe("test-code-verifier");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: accessToken,
        refresh_token: "oauth-browser-refresh-token",
        expires_in: 3_600,
        expires_at: expiresAt,
        token_type: "bearer",
        user: oauthUser,
      }),
    });
  });
  await page.route("**/auth/v1/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(oauthUser),
    });
  });
  await page.route("**/api/user/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        balance: 50,
        authenticated: true,
        userId: USER_ID,
      }),
    });
  });
  await page.route("**/api/inpick/workflow-state**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ exists: false }),
    });
  });

  // 실제 흐름처럼 로그인 페이지에서 verifier를 만든 뒤 callback으로 이동한다.
  await page.goto("/auth?type=consumer");
  await page.evaluate((storageKey) => {
    const encodedVerifier = btoa("test-code-verifier")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    document.cookie = `${storageKey}-code-verifier=base64-${encodedVerifier}; path=/; SameSite=Lax`;
  }, PRODUCTION_STORAGE_KEY);
  await expect
    .poll(() =>
      page.evaluate(
        (storageKey) =>
          document.cookie.includes(`${storageKey}-code-verifier=`),
        PRODUCTION_STORAGE_KEY,
      ),
    )
    .toBe(true);

  await page.goto(
    "/auth/callback?code=test-oauth-code&next=%2Fworkflow%3Fstep%3D1",
  );

  await expect(
    page.getByRole("heading", { name: "어떤 공간을 바꾸고 싶으세요?" }),
  ).toBeVisible({ timeout: 8_000 });
  await expect(page).toHaveURL(/\/workflow\?step=1$/);
  const sessionCookies = (await context.cookies()).filter((cookie) =>
    cookie.name.startsWith(PRODUCTION_STORAGE_KEY),
  );
  expect(
    sessionCookies.filter((cookie) => cookie.name.includes(".")).length,
  ).toBeGreaterThanOrEqual(2);
});

test("서버 세션 검증이 멈춰도 복원된 로그인으로 워크플로우를 연다", async ({
  page,
}) => {
  await page.addInitScript((userId) => {
    const user = {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "auth-regression@inpick.test",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-07-25T00:00:00.000Z",
    };
    const authSession = JSON.stringify({
      access_token: "auth-regression-access-token",
      refresh_token: "auth-regression-refresh-token",
      expires_in: 3_600,
      expires_at: Math.floor(Date.now() / 1_000) + 3_600,
      token_type: "bearer",
      user,
    });
    const encodedSession = btoa(authSession)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    // 로컬 placeholder와 인픽 운영 Supabase ref 양쪽에서 같은 회귀 검사를 실행한다.
    for (const storageKey of [
      "sb-example-auth-token",
      "sb-pyhsjjtxcfmkcqmaxozd-auth-token",
    ]) {
      document.cookie = `${storageKey}=base64-${encodedSession}; path=/; SameSite=Lax`;
    }
    sessionStorage.setItem("inpick_purged_v4", "1");
    localStorage.setItem(
      "inpick_token_state_v2",
      JSON.stringify({
        balance: 50,
        totalUsed: 0,
        totalPurchased: 0,
        history: [],
      }),
    );
  }, USER_ID);

  await page.route("**/auth/v1/user**", async (route) => {
    // 배포 직후 토큰 검증이 잠기는 상황을 재현한다. UI는 이 응답을 기다리면 안 된다.
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: USER_ID,
        aud: "authenticated",
        role: "authenticated",
        email: "auth-regression@inpick.test",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-07-25T00:00:00.000Z",
      }),
    });
  });
  await page.route("**/api/user/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        balance: 50,
        authenticated: true,
        userId: USER_ID,
      }),
    });
  });
  await page.route("**/api/inpick/workflow-state**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ exists: false }),
    });
  });

  await page.goto("/workflow?step=1");

  await expect(
    page.getByRole("heading", { name: "어떤 공간을 바꾸고 싶으세요?" }),
  ).toBeVisible({ timeout: 4_000 });
  await expect(
    page.getByText("로그인 상태를 확인하고 있어요.", { exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/workflow\?step=1$/);
});

test("추가 사용자 검증이 일시 실패해도 복원된 로그인을 유지한다", async ({
  page,
}) => {
  await page.addInitScript((userId) => {
    const user = {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "auth-recovered@inpick.test",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-07-25T00:00:00.000Z",
    };
    const authSession = JSON.stringify({
      access_token: "auth-recovered-access-token",
      refresh_token: "auth-recovered-refresh-token",
      expires_in: 3_600,
      expires_at: Math.floor(Date.now() / 1_000) + 3_600,
      token_type: "bearer",
      user,
    });
    const encodedSession = btoa(authSession)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    for (const storageKey of [
      "sb-example-auth-token",
      "sb-pyhsjjtxcfmkcqmaxozd-auth-token",
    ]) {
      document.cookie = `${storageKey}=base64-${encodedSession}; path=/; SameSite=Lax`;
    }
    sessionStorage.setItem("inpick_purged_v4", "1");
  }, USER_ID);

  await page.route("**/auth/v1/user**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        code: "temporarily_unavailable",
        message: "temporary auth validation failure",
      }),
    });
  });
  await page.route("**/api/user/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        balance: 50,
        authenticated: true,
        userId: USER_ID,
      }),
    });
  });
  await page.route("**/api/inpick/workflow-state**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ exists: false }),
    });
  });

  await page.goto("/workflow?step=1");

  await expect(
    page.getByRole("heading", { name: "어떤 공간을 바꾸고 싶으세요?" }),
  ).toBeVisible({ timeout: 4_000 });
  await expect(page).toHaveURL(/\/workflow\?step=1$/);
});

test("세션이 없으면 로딩 화면에 머물지 않고 로그인 페이지로 이동한다", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("inpick_purged_v4", "1");
  });

  await page.goto("/workflow?step=1");

  await expect(page).toHaveURL(/\/auth\?.*returnUrl=%2Fworkflow%3Fstep%3D1/, {
    timeout: 4_000,
  });
  await expect(
    page.getByText("로그인 상태를 확인하고 있어요.", { exact: true }),
  ).toHaveCount(0);
});

test("Supabase가 Site URL 루트로 보낸 OAuth code를 callback으로 복구한다", async ({
  request,
}) => {
  const code = "abcdefghijklmnopqrstuvwxyz123456";
  const response = await request.get(`/?code=${code}&next=%2Fworkflow`, {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(307);
  const location = new URL(
    response.headers().location,
    "https://www.interiorpick.co.kr",
  );
  expect(`${location.pathname}${location.search}`).toBe(
    `/auth/callback?code=${code}&next=%2Fworkflow`,
  );
});
