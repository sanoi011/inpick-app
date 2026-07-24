import { expect, test } from "@playwright/test";

test("room estimate stays consolidated and schedule uses quantity-based days", async ({
  page,
}) => {
  await page.goto("/dev/estimate-work-package-sample");

  await page.getByRole("button", { name: /4\. 세부내역서/ }).click();
  const livingToggle = page.getByRole("button", { name: /01\. 거실/ });
  await livingToggle.click();
  const livingGroup = livingToggle.locator("..");

  await expect(livingGroup.getByText(/강마루.*바닥.*마감공사/)).toHaveCount(1);
  await expect(livingGroup.getByText(/실크벽지.*벽.*마감공사/)).toHaveCount(1);
  await expect(livingGroup.getByText(/실크벽지.*천장.*마감공사/)).toHaveCount(1);
  await expect(livingGroup.getByText("세부 산출근거 5개 보기")).toBeVisible();
  await page.screenshot({
    path: "/tmp/inpick-estimate-room-packages.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "공정표" }).click();
  await expect(page.getByText("공정표 — 견적 수량 기반 예정 공기")).toBeVisible();
  await expect(page.getByText("총 33일")).toBeVisible();
  await page.screenshot({
    path: "/tmp/inpick-estimate-quantity-schedule.png",
    fullPage: true,
  });
});
