import { expect, test } from "@playwright/test";

const EXPECTED_CALLBACK =
  "https://www.interiorpick.co.kr/auth/callback?next=%2Fworkflow";

test.describe("production authentication smoke", () => {
  test.setTimeout(20_000);

  test.skip(
    process.env.PRODUCTION_AUTH_SMOKE !== "1",
    "Set PRODUCTION_AUTH_SMOKE=1 to probe the deployed login entry points.",
  );

  test("이메일 로그인 버튼이 Supabase password 요청을 전송한다", async ({
    page,
  }) => {
    await page.goto("/auth?type=consumer&returnUrl=%2Fworkflow");
    await page.getByPlaceholder("이메일을 입력하세요").fill(
      `auth-probe-${Date.now()}@example.invalid`,
    );
    await page.getByPlaceholder("비밀번호를 입력하세요").fill(
      "invalid-probe-password",
    );

    const passwordRequest = page.waitForRequest(
      (request) =>
        request.url().includes("/auth/v1/token") &&
        request.url().includes("grant_type=password"),
      { timeout: 8_000 },
    );
    await page
      .locator("form")
      .getByRole("button", { name: /^로그인/ })
      .click();

    const request = await passwordRequest;
    expect(request.method()).toBe("POST");
    await expect(
      page.getByText(/이메일 또는 비밀번호가 올바르지 않습니다/),
    ).toBeVisible({ timeout: 8_000 });
  });

  for (const provider of ["google", "kakao"] as const) {
    test(`${provider} 버튼이 올바른 callback으로 OAuth를 시작한다`, async ({
      page,
    }) => {
      await page.goto("/auth?type=consumer&returnUrl=%2Fworkflow");

      let authorizeUrl = "";
      await page.route("**/auth/v1/authorize**", async (route) => {
        authorizeUrl = route.request().url();
        await route.abort();
      });

      await page
        .getByRole("button", {
          name: provider === "google" ? "Google" : "카카오",
        })
        .click();

      await expect
        .poll(() => authorizeUrl, { timeout: 8_000 })
        .toContain(`provider=${provider}`);
      const requestedCallback = new URL(authorizeUrl).searchParams.get(
        "redirect_to",
      );
      expect(requestedCallback).toBe(EXPECTED_CALLBACK);
      const cookieNames = (await page.context().cookies()).map(
        (cookie) => cookie.name,
      );
      expect(
        cookieNames.some((name) => name.includes("auth-token-code-verifier")),
      ).toBe(true);
    });
  }
});
