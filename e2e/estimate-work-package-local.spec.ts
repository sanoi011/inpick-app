import { expect, test } from "@playwright/test";

test("room estimate stays consolidated and schedule uses quantity-based days", async ({
  page,
}) => {
  await page.goto("/dev/estimate-work-package-sample");
  await expect(page.getByText("33일", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: /4\. 세부내역서/ }).click();
  const siteConditionSummary = page.getByText("현장 확인 가정 및 변동 조건", {
    exact: true,
  });
  await expect(siteConditionSummary).toBeVisible();
  await expect(
    page.getByText(/철거 공사 금액은 기본 철거 단가로 산정한 가견적/),
  ).not.toBeVisible();
  await siteConditionSummary.click();
  await expect(
    page.getByText(/철거 공사 금액은 기본 철거 단가로 산정한 가견적/),
  ).toBeVisible();
  await expect(
    page.getByText(/철거 공사 금액은 기본 철거 단가로 산정한 가견적/),
  ).toHaveCount(1);
  const livingToggle = page.getByRole("button", { name: /01\. 거실/ });
  await livingToggle.click();
  const livingGroup = livingToggle.locator("..");

  await expect(livingGroup.getByText(/강마루.*바닥.*마감공사/)).toHaveCount(1);
  await expect(livingGroup.getByText(/실크벽지.*벽.*마감공사/)).toHaveCount(1);
  await expect(livingGroup.getByText(/실크벽지.*천장.*마감공사/)).toHaveCount(1);
  await expect(livingGroup.getByText("세부 산출근거 5개 보기")).toBeVisible();
  const floorOption = livingGroup.getByLabel("거실 바닥 옵션");
  const ceilingOption = livingGroup.getByLabel("거실 천장 옵션");
  await expect(floorOption).toHaveValue("floor-engineered-wood");
  await expect(ceilingOption).toHaveValue("ceiling-wallpaper");
  await floorOption.selectOption("floor-porcelain-600");
  await ceilingOption.selectOption("ceiling-water-paint");
  await expect(livingGroup.getByText(/포세린 타일.*바닥.*마감공사/)).toBeVisible();
  await expect(livingGroup.getByText(/친환경 수성 도장.*천장.*마감공사/)).toBeVisible();
  await page.screenshot({
    path: "/tmp/inpick-estimate-room-packages.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: /3\. 총괄내역서/ }).click();
  await expect(page.getByText(/^0001\.\s/)).toBeVisible();
  await expect(page.getByText(/^99\.\s/)).toHaveCount(0);

  await page.getByRole("button", { name: "공정표" }).click();
  await expect(page.getByText("공정표 — 견적 수량 기반 예정 공기")).toBeVisible();
  await expect(page.getByText("총 33일")).toBeVisible();
  await page.screenshot({
    path: "/tmp/inpick-estimate-quantity-schedule.png",
    fullPage: true,
  });
});

test("mobile schedule shows only each phase duration without the wide chart", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/estimate-work-package-sample");
  await expect(page.getByText("33일", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "공정표" }).click();

  const mobileList = page.getByTestId("schedule-mobile-list");
  await expect(mobileList).toBeVisible();
  await expect(page.getByTestId("schedule-desktop-chart")).toBeHidden();
  await expect(mobileList.getByText(/^\d+일$/).first()).toBeVisible();
  const fitsViewport = await mobileList.evaluate(
    (element) => element.scrollWidth <= element.clientWidth,
  );
  expect(fitsViewport).toBe(true);
});
