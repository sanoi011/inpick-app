import { expect, test } from "@playwright/test";

const viewports = [
  { label: "mobile-320", width: 320, height: 844 },
  { label: "mobile-390", width: 390, height: 844 },
  { label: "desktop", width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test(`bottom CTA remains on one line at ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/");

    const cta = page.getByRole("heading", {
      name: "오늘, 내 공간을 새롭게 만들어보세요.",
    });

    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();

    const layout = await cta.evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        whiteSpace: style.whiteSpace,
      };
    });

    expect(layout.whiteSpace).toBe("nowrap");
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  });
}
