import { expect, test } from "@playwright/test";

const PROJECT_ID = "66666666-2222-4333-8444-555555555555";
const USER_ID = "99999999-2222-4333-8444-555555555555";

function constructionEstimate(ceilingFinish: "wallpaper" | "paint") {
  const paint = ceilingFinish === "paint";
  const materialUnitPrice = paint ? 7_000 : 8_500;
  const laborUnitPrice = paint ? 14_000 : 12_000;
  const quantity = 24;
  const materialAmount = materialUnitPrice * quantity;
  const laborAmount = laborUnitPrice * quantity;
  const directTotal = materialAmount + laborAmount;
  return {
    id: `estimate-${ceilingFinish}`,
    projectId: PROJECT_ID,
    projectMode: "apartment",
    version: 1,
    lines: [
      {
        id: `line-${ceilingFinish}`,
        sortNo: 1,
        tradeCode: "09",
        tradeNameKo: "도배공사",
        subTradeCode: paint ? "08-04" : "09-04",
        subTradeNameKo: paint ? "천장 마감 도장" : "천장 마감 도배",
        roomId: "living",
        roomName: "거실",
        roomType: "living_room",
        surfaceType: "ceiling",
        taskNameKo: paint ? "친환경 수성 도장 2회" : "천장 실크벽지 도배",
        itemNameKo: paint ? "천장 친환경 수성 도장" : "천장 도배",
        spec: paint ? "무광 2회" : "실크벽지",
        unit: "m2",
        quantityFormulaKo: "거실 천장면적",
        quantity,
        materialUnitPrice,
        laborUnitPrice,
        expenseUnitPrice: 0,
        materialAmount,
        laborAmount,
        expenseAmount: 0,
        totalAmount: directTotal,
        included: true,
        source: "user_selected_material",
        confidence: 1,
        evidenceRefs: [{ type: "surface_plan", id: `ceiling-${ceilingFinish}` }],
        assumptions: [],
        warnings: [],
      },
    ],
    tradeSummaries: [
      {
        tradeCode: "09",
        tradeNameKo: "도배공사",
        materialAmount,
        laborAmount,
        expenseAmount: 0,
        totalAmount: directTotal,
        lineCount: 1,
      },
    ],
    roomSummaries: [
      {
        roomId: "living",
        roomName: "거실",
        materialAmount,
        laborAmount,
        expenseAmount: 0,
        totalAmount: directTotal,
      },
    ],
    materialSummary: [],
    totals: {
      directMaterial: materialAmount,
      directLabor: laborAmount,
      directExpense: 0,
      directTotal,
      indirectCost: 0,
      generalManagement: 0,
      profit: 0,
      vat: Math.round(directTotal * 0.1),
      totalWithVat: Math.round(directTotal * 1.1),
    },
    confidenceSummary: {
      userSelectedRatio: 1,
      visionBasedRatio: 0,
      promptBasedRatio: 0,
      fallbackRatio: 0,
      averageConfidence: 1,
    },
    assumptions: [],
    warnings: [],
  };
}

test("천장 마감은 별도 UI 없이 세부견적 행에서 선택하고 즉시 재산정한다", async ({
  page,
}) => {
  const requests: Array<Record<string, unknown>> = [];
  const step1 = {
    basicInfo: {
      mode: "address",
      budget: 3_500,
      expansionType: "basic",
      selectedAddress: {
        roadAddress: "서울특별시 테스트로 84",
        buildingName: "인픽아파트",
      },
      selectedPyeong: {
        pyeongNo: 1,
        pyeongName: "34평",
        exclusiveArea: 84,
      },
    },
    buildingType: "apartment",
    workflowEntry: "apartment_drawing",
    rooms: ["living"],
  };
  const step2 = {
    selectedByRoom: { living: 0 },
    generations: { living: 1 },
    rendersByRoom: {
      living: [
        {
          url: "https://images.example/living.webp",
          prompt: "밝은 오크 거실",
          timestamp: "2026-07-25T06:00:00.000Z",
          accessState: "free",
        },
      ],
    },
    promptByRoom: {},
    finalSelectedImageUrlsByRoom: {
      living: "https://images.example/living.webp",
    },
  };

  await page.addInitScript(
    ({ projectId, userId, seededStep1, seededStep2 }) => {
      const user = {
        id: userId,
        aud: "authenticated",
        role: "authenticated",
        email: "qa@inpick.test",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-07-25T00:00:00.000Z",
      };
      const authSession = JSON.stringify({
        access_token: "qa-access-token",
        refresh_token: "qa-refresh-token",
        expires_in: 3_600,
        expires_at: Math.floor(Date.now() / 1_000) + 3_600,
        token_type: "bearer",
        user,
      });
      const encodedSession = btoa(authSession)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      document.cookie = `sb-example-auth-token=base64-${encodedSession}; path=/; SameSite=Lax`;
      localStorage.setItem("workflow_project_id", projectId);
      sessionStorage.setItem("workflow_project_id", projectId);
      sessionStorage.setItem("workflow_step1", JSON.stringify(seededStep1));
      sessionStorage.setItem("workflow_step2", JSON.stringify(seededStep2));
    },
    {
      projectId: PROJECT_ID,
      userId: USER_ID,
      seededStep1: step1,
      seededStep2: step2,
    },
  );

  await page.route("https://example.supabase.co/auth/v1/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: USER_ID,
        aud: "authenticated",
        role: "authenticated",
        email: "qa@inpick.test",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-07-25T00:00:00.000Z",
      }),
    });
  });
  await page.route("**/api/user/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        balance: 50,
        authenticated: true,
        userId: USER_ID,
      }),
    });
  });
  await page.route("**/api/inpick/design-outputs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ outputs: [] }),
    });
  });
  await page.route("**/api/inpick/locked-design/assets**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ assets: [] }),
    });
  });
  await page.route("**/api/inpick/estimate-context/finalize", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ contextId: "qa-context" }),
    });
  });
  await page.route("**/api/inpick/estimate-details-access**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ granted: true }),
    });
  });
  await page.route("**/api/inpick/build-estimate", async (route) => {
    const request = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(request);
    const ceilingFinish =
      request.ceilingFinish === "paint" ? "paint" : "wallpaper";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        estimateVersion: "construction_trade_v2",
        constructionEstimate: constructionEstimate(ceilingFinish),
        estimates: [
          {
            roomName: "거실",
            totalAreaM2: 24,
            items: [],
            mainTotalWon: 0,
            auxTotalWon: 0,
            laborTotalWon: 0,
            totalWon: 1,
          },
        ],
        warnings: [],
        quotationType: "construction_trade_estimate",
        estimateLevel: "L1_DESIGN",
      }),
    });
  });

  await page.goto(`/workflow/estimate?projectId=${PROJECT_ID}`);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0].ceilingFinish).toBeUndefined();
  const requestCountBeforeInlineEdit = requests.length;
  await expect(page.getByText("천장 마감 기준", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /4\. 세부내역서/ }).click();
  await page.getByRole("button", { name: /01\. 거실/ }).click();
  const ceilingOption = page.getByLabel("거실 천장 옵션");
  await expect(ceilingOption).toHaveValue("ceiling-wallpaper");
  await ceilingOption.selectOption("ceiling-water-paint");
  await expect(ceilingOption).toHaveValue("ceiling-water-paint");
  await expect(page.getByText("천장 친환경 수성 도장", { exact: true })).toBeVisible();
  await expect(page.getByText("천장 실크벽지 도배", { exact: true })).toHaveCount(0);
  await expect.poll(() => requests.length).toBe(requestCountBeforeInlineEdit);
});
