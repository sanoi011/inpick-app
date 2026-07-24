import { expect, test } from "@playwright/test";

const PROJECT_ID = "77777777-2222-4333-8444-555555555555";

test("Step 2 consultation receives Step 1 apartment and spatial context", async ({
  page,
}, testInfo) => {
  const step1 = {
    basicInfo: {
      mode: "address",
      budget: 3_500,
      expansionType: "extended",
      selectedAddress: {
        roadAddress: "대전광역시 중구 대전천서로 709",
        jibunAddress: "대전광역시 중구 중촌동",
        buildingName: "중촌동 센터파크",
      },
      selectedComplex: {
        complexNo: "qa-complex",
        complexName: "중촌동 센터파크",
        bcode: "qa-bcode",
      },
      selectedPyeong: {
        pyeongNo: 79,
        pyeongName: "79평",
        exclusiveArea: 59.98,
        roomCnt: 3,
      },
      normalizedPyeong: "전용 59.98㎡",
      normalizedRooms: [
        {
          name: "주방",
          widthMm: 3_600,
          depthMm: 3_200,
          heightMm: 2_300,
          source: "vision",
        },
      ],
    },
    buildingType: "apartment",
    workflowEntry: "apartment_drawing",
    rooms: ["kitchen"],
    normalizedFloorplan: {
      pyeong: "전용 59.98㎡",
      rooms: [
        {
          name: "주방",
          widthMm: 3_600,
          depthMm: 3_200,
          heightMm: 2_300,
          source: "vision",
        },
      ],
      openings: [],
      notes: "주방은 거실과 연결된 확장형 구조",
    },
  };
  const step2 = {
    selectedByRoom: {},
    generations: {},
    rendersByRoom: {},
    promptByRoom: {},
    chatMode: true,
  };
  let chatRequest: Record<string, unknown> | null = null;

  await page.addInitScript((projectId) => {
    const user = {
      id: "99999999-2222-4333-8444-555555555555",
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
    localStorage.setItem(
      "inpick_token_state_v2",
      JSON.stringify({ balance: 50, totalUsed: 0, totalPurchased: 0, history: [] }),
    );
  }, PROJECT_ID);

  await page.route("https://example.supabase.co/auth/v1/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "99999999-2222-4333-8444-555555555555",
        aud: "authenticated",
        role: "authenticated",
        email: "qa@inpick.test",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-07-25T00:00:00.000Z",
      }),
    });
  });

  await page.route("**/api/inpick/workflow-state**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          exists: true,
          projectId: PROJECT_ID,
          workflowState: { step1, step2, lastStep: 2 },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
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
  await page.route("**/api/inpick/design-chat/stream", async (route) => {
    chatRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        'data: {"text":"입력하신 아파트와 주방 구조를 기준으로 블랙 포인트 자재를 추천할게요."}\n\n' +
        "data: [DONE]\n\n",
    });
  });

  await page.goto(`/workflow?projectId=${PROJECT_ID}&step=2`);
  await expect(page.getByText("공간별 AI 디자인", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Step 1에서 입력한 아파트 · 전용 59\.98㎡ · 발코니 확장형 정보를 기준/),
  ).toBeVisible();
  await expect(page.getByText(/선택하신 공간은 부엌입니다/)).toBeVisible();

  const prompt = page.getByPlaceholder(/상담 또는 수정 요청/);
  await prompt.fill("블랙 포인트가 들어간 세련된 주방으로 해줘");
  await page.getByRole("button", { name: "메시지 전송" }).click();
  await expect(page.getByText(/입력하신 아파트와 주방 구조를 기준/)).toBeVisible();

  await expect.poll(() => chatRequest).not.toBeNull();
  const context = (chatRequest as unknown as Record<string, unknown>)
    .context as Record<string, unknown>;
  expect(context.buildingType).toBe("apartment");
  expect(context.workflowEntry).toBe("apartment_drawing");
  expect(context.address).toBe("대전광역시 중구 대전천서로 709");
  expect(context.exclusiveAreaM2).toBe(59.98);
  expect(context.expansionType).toBe("extended");
  expect(context.selectedRooms).toEqual(["부엌"]);
  expect(context.activeRoom).toBeUndefined();
  expect(context.floorplanRooms).toEqual([
    { name: "주방", widthMm: 3_600, depthMm: 3_200, heightMm: 2_300 },
  ]);

  await page.screenshot({
    path: testInfo.outputPath("step1-context-in-step2-chat.png"),
    fullPage: true,
  });
});
