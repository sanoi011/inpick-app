import { test, expect } from "@playwright/test";

test.describe("Consumer Project Workflow", () => {
  test("project/new redirects to home tab", async ({ page }) => {
    await page.goto("/project/new");
    // Should redirect to /project/[uuid]/home
    await expect(page).toHaveURL(/\/project\/[a-f0-9-]+\/home/, { timeout: 10000 });
  });

  test("project home page renders address search", async ({ page }) => {
    await page.goto("/project/new");
    await expect(page).toHaveURL(/\/project\/[a-f0-9-]+\/home/, { timeout: 10000 });
    // Should show address search UI
    await expect(page.locator("text=우리집 찾기").first()).toBeVisible();
  });

  test("6-tab navigation renders", async ({ page }) => {
    await page.goto("/project/new");
    await expect(page).toHaveURL(/\/project\/[a-f0-9-]+\/home/, { timeout: 10000 });

    // Check all 6 tabs exist
    const tabs = ["우리집 찾기", "도면/3D", "AI 디자인", "3D 렌더링", "물량산출", "견적요청"];
    for (const tab of tabs) {
      await expect(page.locator(`text=${tab}`).first()).toBeVisible();
    }
  });

  test("design tab loads", async ({ page }) => {
    await page.goto("/project/new");
    await expect(page).toHaveURL(/\/project\/[a-f0-9-]+\/home/, { timeout: 10000 });
    const url = page.url();
    const projectId = url.match(/\/project\/([a-f0-9-]+)\//)?.[1];
    expect(projectId).toBeTruthy();

    await page.goto(`/project/${projectId}/design`);
    await expect(page.locator("text=도면").first()).toBeVisible({ timeout: 10000 });
  });

  test("estimate tab loads", async ({ page }) => {
    await page.goto("/project/new");
    await expect(page).toHaveURL(/\/project\/[a-f0-9-]+\/home/, { timeout: 10000 });
    const url = page.url();
    const projectId = url.match(/\/project\/([a-f0-9-]+)\//)?.[1];

    await page.goto(`/project/${projectId}/estimate`);
    await expect(page.locator("text=물량산출").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Consumer Lists", () => {
  test("projects page loads (unauthenticated shows local)", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.locator("text=내 프로젝트").first()).toBeVisible();
  });

  test("contracts page redirects to auth when not logged in", async ({ page }) => {
    await page.goto("/contracts");
    // Should redirect to /auth?returnUrl=/contracts
    await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
  });
});
