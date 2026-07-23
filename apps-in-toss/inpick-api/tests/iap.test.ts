import assert from "node:assert/strict";
import test from "node:test";
import {
  isAppsInTossOrderId,
  isAppsInTossSku,
  isGrantableAppsInTossIapStatus,
} from "../lib/apps-in-toss-iap.js";

test("Apps in Toss IAP accepts UUID orders and console-issued SKU format", () => {
  assert.equal(
    isAppsInTossOrderId("13c9a1ff-2baa-4495-bbfa-a0826ba8c7c0"),
    true,
  );
  assert.equal(
    isAppsInTossSku("ait.0000010000.af647449.3bd55cfd00.0000000475"),
    true,
  );
});

test("Apps in Toss IAP rejects path/control characters in order and SKU", () => {
  assert.equal(isAppsInTossOrderId("../13c9a1ff"), false);
  assert.equal(isAppsInTossSku("../product"), false);
  assert.equal(isAppsInTossSku("product\nx"), false);
  assert.equal(isAppsInTossSku(""), false);
});

test("only paid or already-granted remote states may enter grant handling", () => {
  assert.equal(isGrantableAppsInTossIapStatus("PAYMENT_COMPLETED"), true);
  assert.equal(isGrantableAppsInTossIapStatus("PURCHASED"), true);
  assert.equal(isGrantableAppsInTossIapStatus("ORDER_IN_PROGRESS"), false);
  assert.equal(isGrantableAppsInTossIapStatus("FAILED"), false);
  assert.equal(isGrantableAppsInTossIapStatus("REFUNDED"), false);
  assert.equal(isGrantableAppsInTossIapStatus("MINIAPP_MISMATCH"), false);
});
