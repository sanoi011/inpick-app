import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "https://inpick-app.vercel.app";

test.describe("API Smoke Tests", () => {
  test("GET /api/estimates returns 200", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/estimates`);
    expect(res.status()).toBe(200);
  });

  test("GET /api/materials returns 200", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/materials?roomType=LIVING`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("materials");
  });

  test("GET /api/contractor/stats returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/contractor/stats`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/contractor/stats with auth returns 200", async ({ request }) => {
    // Login first to get token
    const loginRes = await request.post(`${BASE_URL}/api/contractor/login`, {
      data: { email: "contractor@inpick.kr", password: "test1234!" },
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    const contractorId = loginData.contractor?.id;

    if (!token || !contractorId) {
      test.skip();
      return;
    }

    const res = await request.get(
      `${BASE_URL}/api/contractor/stats?contractorId=${contractorId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("activeProjects");
    expect(data).toHaveProperty("avgRating");
  });

  test("POST /api/contractor/login with valid credentials", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/contractor/login`, {
      data: { email: "contractor@inpick.kr", password: "test1234!" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("token");
    expect(data.contractor).toHaveProperty("id");
  });

  test("POST /api/contractor/login with invalid credentials", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/contractor/login`, {
      data: { email: "wrong@test.com", password: "wrong" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("GET /api/project/gemini-status returns valid response", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/project/gemini-status`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(["configured", "not_configured", "mock"]).toContain(data.status);
  });

  test("POST /api/admin/login with valid credentials", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/admin/login`, {
      data: { email: "tjsqhs011@naver.com", password: "inpick2026!" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("token");
  });
});
