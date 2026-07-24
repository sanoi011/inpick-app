import { expect, test } from "@playwright/test";

const PROJECT_ID = "88888888-2222-4333-8444-555555555555";
const USER_ID = "99999999-2222-4333-8444-555555555555";
const GENERATED_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("실별 상담에서 생성 요청을 보내면 선택한 실 한 장만 생성한다", async ({
  page,
}) => {
  const step1 = {
    basicInfo: {
      mode: "address",
      budget: 3_500,
      expansionType: "extended",
      selectedAddress: {
        roadAddress: "대전광역시 중구 대전천서로 709",
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
    selectedByRoom: { kitchen: 0 },
    generations: { kitchen: 1 },
    rendersByRoom: {
      kitchen: [
        {
          url: GENERATED_IMAGE,
          prompt: "기존 부엌 디자인",
          timestamp: "2026-07-25T00:00:00.000Z",
          accessState: "unlocked",
        },
      ],
    },
    promptByRoom: {},
    chatMode: true,
  };
  const renderRequests: Array<Record<string, unknown>> = [];
  let extractRequest: Record<string, unknown> | null = null;

  await page.addInitScript(
    ({ projectId, userId }) => {
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
    },
    { projectId: PROJECT_ID, userId: USER_ID },
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
        totalUsed: 0,
        totalPurchased: 50,
        authenticated: true,
        userId: USER_ID,
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
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        'data: {"text":"부엌을 밝은 오크와 아이보리 톤으로 정리했습니다. 이미지를 생성하시겠습니까?"}\n\n' +
        "data: [DONE]\n\n",
    });
  });
  await page.route("**/api/inpick/design-chat/extract", async (route) => {
    extractRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        room_type: "부엌",
        image_prompt: "밝은 오크와 아이보리 톤의 부엌",
      }),
    });
  });
  await page.route("**/api/inpick/render-room", async (route) => {
    renderRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        imageUrl: GENERATED_IMAGE,
        revisedPrompt: "밝은 오크와 아이보리 톤의 부엌",
        costUsd: 0.01,
      }),
    });
  });

  await page.goto(`/workflow?projectId=${PROJECT_ID}&step=2`);
  await expect(page.getByText("공간별 AI 디자인", { exact: true })).toBeVisible();

  const kitchenTab = page.locator("[data-room-tab]").filter({ hasText: "부엌" });
  await kitchenTab.click();
  await kitchenTab.click();
  const prompt = page.getByPlaceholder(/상담 또는 수정 요청/);
  await prompt.fill("밝은 오크와 아이보리 분위기를 선호해");
  await page.getByRole("button", { name: "메시지 전송" }).click();
  await expect(page.getByText(/이미지를 생성하시겠습니까/)).toBeVisible();

  await prompt.fill("이미지 생성해줘");
  await page.getByRole("button", { name: "메시지 전송" }).click();

  await expect.poll(() => renderRequests.length).toBe(1);
  expect(renderRequests[0].roomName).toBe("부엌");
  expect(renderRequests[0].style).toBe("밝은 오크와 아이보리 톤의 부엌");
  const extraction = extractRequest as unknown as Record<string, unknown>;
  expect(extraction.context).toMatchObject({
    activeRoom: "부엌",
  });
  expect(extraction.messages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ role: "user", content: "이미지 생성해줘" }),
    ]),
  );
  await expect(page.getByAltText("design-1")).toBeVisible();

  await page.getByRole("button", { name: /최종 이미지 선택 → 견적/ }).click();
  await expect(page.getByText("견적에 사용할 실별 최종 이미지", { exact: true })).toBeVisible();
  await expect(page.getByTestId(/^final-design-option-kitchen-/)).toHaveCount(2);
});
