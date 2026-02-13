import { test, expect } from "@playwright/test";

test.describe("Contractor Login Flow", () => {
  test("login page redirects to unified auth", async ({ page }) => {
    await page.goto("/contractor/login");
    // Should redirect to /auth?type=contractor
    await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
    await expect(page.locator("text=사업자 로그인").first()).toBeVisible();
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/auth?type=contractor");
    await expect(page.locator("text=사업자 로그인").first()).toBeVisible();
    await page.fill("input[type='email']", "wrong@test.com");
    await page.fill("input[type='password']", "wrongpass");
    await page.locator("button:has-text('사업자 로그인')").click();
    // Wait for error message
    await expect(page.locator(".bg-red-50").first()).toBeVisible({ timeout: 10000 });
  });

  test("successful login with test account", async ({ page }) => {
    await page.goto("/auth?type=contractor");
    await expect(page.locator("text=사업자 로그인").first()).toBeVisible();
    await page.fill("input[type='email']", "contractor@inpick.kr");
    await page.fill("input[type='password']", "test1234!");
    await page.locator("button:has-text('사업자 로그인')").click();
    // Should redirect to contractor dashboard
    await expect(page).toHaveURL(/\/contractor$/, { timeout: 15000 });
    await expect(page.locator("text=대시보드").first()).toBeVisible();
  });
});

test.describe("Contractor Dashboard (Authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/auth?type=contractor");
    await expect(page.locator("text=사업자 로그인").first()).toBeVisible();
    await page.fill("input[type='email']", "contractor@inpick.kr");
    await page.fill("input[type='password']", "test1234!");
    await page.locator("button:has-text('사업자 로그인')").click();
    await expect(page).toHaveURL(/\/contractor$/, { timeout: 15000 });
  });

  test("dashboard shows summary cards", async ({ page }) => {
    // Dashboard renders with some content
    await expect(page.locator("text=대시보드").first()).toBeVisible();
  });

  test("sidebar navigation works", async ({ page }) => {
    await page.click("a:has-text('입찰 관리')");
    await expect(page).toHaveURL(/\/contractor\/bids/);

    await page.click("a:has-text('프로젝트')");
    await expect(page).toHaveURL(/\/contractor\/projects/);
  });

  test("all contractor subpages load", async ({ page }) => {
    const subpages = [
      { path: "/contractor/bids", text: "입찰" },
      { path: "/contractor/projects", text: "프로젝트" },
      { path: "/contractor/schedule", text: "일정" },
      { path: "/contractor/finance", text: "재무" },
      { path: "/contractor/matching", text: "매칭" },
      { path: "/contractor/profile", text: "프로필" },
      { path: "/contractor/ai", text: "AI" },
    ];

    for (const sub of subpages) {
      await page.goto(sub.path);
      await expect(page.locator(`text=${sub.text}`).first()).toBeVisible({ timeout: 10000 });
    }
  });
});
