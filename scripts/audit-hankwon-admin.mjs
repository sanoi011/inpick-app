import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.INPICK_ADMIN_AUDIT_URL || "http://127.0.0.1:3022";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10_000);
const userId = "c1b5d7be-3ff9-4c1b-994c-5a35a78b2ed5";
let grantPayload = null;

await page.addInitScript(() => {
  localStorage.setItem("admin_token", "audit-token");
  localStorage.setItem("admin_id", "audit-admin");
  localStorage.setItem("admin_email", "admin@inpick.test");
  localStorage.setItem("admin_name", "운영 테스트");
  sessionStorage.setItem("inpick_purged_v4", "1");
});

await page.route("**/api/admin/hankwon-plans**", async (route) => {
  const request = route.request();
  if (request.method() === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [{
          id: userId,
          email: "writer@inpick.test",
          name: "테스트 작가",
          created_at: "2026-07-30T00:00:00.000Z",
          hankwon: { plan: "pro", active: true, productId: null, expiresAt: "2026-08-30T00:00:00.000Z", source: "admin" },
        }],
      }),
    });
  }
  const body = request.postDataJSON();
  if (body.action === "history") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: { plan: "pro", active: true, productId: null, expiresAt: "2026-08-30T00:00:00.000Z", source: "admin" },
        grants: [{ id: "grant-1", plan: "pro", starts_at: "2026-07-30T00:00:00.000Z", expires_at: "2026-08-30T00:00:00.000Z", reason: "QA 테스트", test_account: true, granted_by: "audit-admin", revoked_at: null, revoked_by: null, revoke_reason: null, created_at: "2026-07-30T00:00:00.000Z" }],
        subscriptions: [],
      }),
    });
  }
  if (body.action === "grant") {
    grantPayload = body;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(`${baseUrl}/admin/hankwon`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "한권 플랜 관리" }).waitFor();
await page.getByText("writer@inpick.test").click();
await page.getByText("QA 테스트").waitFor();
await page.getByText("MAX", { exact: true }).last().click();
await page.getByRole("button", { name: "MAX 권한 부여" }).click();
await page.waitForTimeout(100);

assert.ok(grantPayload, "grant request was not sent");
assert.equal(grantPayload.userId, userId);
assert.equal(grantPayload.plan, "max");
assert.equal(grantPayload.testAccount, true);
assert.equal(grantPayload.reason, "테스트 계정 운영");
console.log(JSON.stringify({ ok: true, route: "/admin/hankwon", grantPayload }));

await browser.close();
