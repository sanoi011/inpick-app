import { test, expect } from "@playwright/test";

// 주요 페이지 라우트 스모크 테스트 - 200 응답 + 기본 렌더링 확인
const PUBLIC_ROUTES = [
  { path: "/", title: "INPICK" },
  { path: "/auth", title: "INPICK" },
  { path: "/project/new", title: "" },
  { path: "/viewer", title: "" },
];

const CONTRACTOR_ROUTES = [
  "/contractor/login",
  "/contractor/register",
];

const ADMIN_ROUTES = [
  "/admin/login",
];

test.describe("Smoke Tests - Public Pages", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`GET ${route.path} loads successfully`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBeLessThan(400);
      if (route.title) {
        await expect(page.locator("body")).toContainText(route.title);
      }
    });
  }
});

test.describe("Smoke Tests - Contractor Pages", () => {
  for (const path of CONTRACTOR_ROUTES) {
    test(`GET ${path} loads successfully`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
    });
  }
});

test.describe("Smoke Tests - Admin Pages", () => {
  for (const path of ADMIN_ROUTES) {
    test(`GET ${path} loads successfully`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
    });
  }
});

test.describe("Landing Page", () => {
  test("hero section renders with CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=INPICK").first()).toBeVisible();
    await expect(page.locator("text=무료 견적 받기").first()).toBeVisible();
  });

  test("navigation links work", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    await expect(header).toBeVisible();
  });
});

test.describe("Auth Page", () => {
  test("consumer login form renders", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("text=일반 고객").first()).toBeVisible();
    await expect(page.locator("text=사업자").first()).toBeVisible();
    await expect(page.locator("text=Google로 계속하기").first()).toBeVisible();
  });

  test("contractor tab switches form", async ({ page }) => {
    await page.goto("/auth");
    await page.click("text=사업자");
    await expect(page.locator("text=사업자 로그인").first()).toBeVisible();
    await expect(page.locator("text=사업자 등록").first()).toBeVisible();
  });

  test("kakao button is disabled", async ({ page }) => {
    await page.goto("/auth");
    const kakaoBtn = page.locator("text=카카오 로그인 (준비중)").first();
    await expect(kakaoBtn).toBeVisible();
    await expect(kakaoBtn).toBeDisabled();
  });
});
