import assert from "node:assert/strict";
import test from "node:test";
import {
  createToken,
  getContractorIdFromRequest,
} from "../contractor-auth";

process.env.CONTRACTOR_JWT_SECRET = "contractor-auth-test-secret";

test("HMAC 서명 사업자 토큰만 요청 인증에 사용한다", () => {
  const token = createToken("contractor-123", "owner@example.com");
  const request = new Request("https://inpick.example/api/contractor/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(getContractorIdFromRequest(request), "contractor-123");
});

test("unsigned legacy base64 payload를 거부한다", () => {
  const forged = Buffer.from(JSON.stringify({ id: "victim-contractor" })).toString("base64");
  const request = new Request("https://inpick.example/api/contractor/profile", {
    headers: { Authorization: `Bearer ${forged}` },
  });
  assert.equal(getContractorIdFromRequest(request), null);
});
