import { expect, test } from "@playwright/test";

const PROJECT_ID = "11111111-2222-4333-8444-555555555555";

function imageData(label: string, from: string, to: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
      <rect width="960" height="720" fill="url(#g)"/>
      <rect x="80" y="90" width="800" height="520" rx="32" fill="white" fill-opacity=".2" stroke="white" stroke-opacity=".55" stroke-width="4"/>
      <text x="480" y="350" text-anchor="middle" font-family="sans-serif" font-size="62" font-weight="700" fill="white">${label}</text>
      <text x="480" y="415" text-anchor="middle" font-family="sans-serif" font-size="25" fill="white" fill-opacity=".82">INPICK STEP 2 QA</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

test("Step 2 routes one prompt to a room edit and carries only final room images", async ({
  page,
}, testInfo) => {
  const living1 = imageData("거실 시안 1", "#5f6658", "#b39b78");
  const living2 = imageData("거실 시안 2", "#263f4d", "#9d8768");
  const master1 = imageData("안방 시안 1", "#75665d", "#c7a99b");
  const master2 = imageData("안방 시안 2", "#4d5965", "#9e8e80");
  const masterEdited = imageData("안방 문 수정", "#7a563d", "#d2b38c");
  let editRequest: Record<string, unknown> = {};

  const step1 = {
    basicInfo: {
      mode: "address",
      budget: 3500,
      expansionType: "basic",
      selectedAddress: { roadAddress: "서울특별시 강남구 테스트로 84", buildingName: "인픽아파트" },
      selectedComplex: { complexName: "인픽아파트" },
      selectedPyeong: { pyeongNo: 1, pyeongName: "34평", exclusiveArea: 84 },
    },
    buildingType: "apartment",
    workflowEntry: "apartment_drawing",
    rooms: ["living", "master"],
  };
  const step2 = {
    selectedByRoom: { living: 1, master: 1 },
    generations: { living: 2, master: 2 },
    rendersByRoom: {
      living: [
        { url: living1, prompt: "내추럴 거실", costUsd: 0.01, timestamp: "2026-07-18T10:00:00.000Z" },
        { url: living2, prompt: "모던 거실", costUsd: 0.01, timestamp: "2026-07-18T10:01:00.000Z" },
      ],
      master: [
        { url: master1, prompt: "따뜻한 안방", costUsd: 0.01, timestamp: "2026-07-18T10:02:00.000Z" },
        { url: master2, prompt: "차분한 안방", costUsd: 0.01, timestamp: "2026-07-18T10:03:00.000Z" },
      ],
    },
    promptByRoom: {},
    chatMode: true,
    chatMessages: [{ role: "assistant", content: "원하는 공간과 변경 내용을 말씀해주세요." }],
    unlockedRenderKeys: {
      master: ["2026-07-18T10:02:00.000Z", "2026-07-18T10:03:00.000Z"],
    },
  };

  await page.addInitScript(
    ({ projectId, seededStep1, seededStep2 }) => {
      const snapshot = {
        projectId,
        step1: seededStep1,
        step2: seededStep2,
        lastStep: 2,
      };
      localStorage.setItem("workflow_project_id", projectId);
      localStorage.setItem(
        "inpick_token_state_v2",
        JSON.stringify({ balance: 50, totalUsed: 0, totalPurchased: 0, history: [] }),
      );
      sessionStorage.setItem("workflow_project_id", projectId);
      sessionStorage.setItem(`workflow_snapshot:${projectId}`, JSON.stringify(snapshot));
      sessionStorage.setItem("workflow_step1", JSON.stringify(seededStep1));
      sessionStorage.setItem("workflow_step2", JSON.stringify(seededStep2));
      sessionStorage.setItem("workflow_step", "2");
    },
    { projectId: PROJECT_ID, seededStep1: step1, seededStep2: step2 },
  );

  await page.route("**/api/inpick/workflow-state", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ exists: false }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/inpick/design-outputs**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ outputs: [] }) });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        output: {
          id: "edited-output",
          projectId: PROJECT_ID,
          targetId: "master",
          targetName: "안방",
          imageUrl: masterEdited,
        },
      }),
    });
  });
  await page.route("**/api/inpick/render-space-edit", async (route) => {
    editRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        imageUrl: masterEdited,
        prompt: "Preserve geometry. Change only the master bedroom door to light oak.",
        model: "qa-mock",
        costUsd: 0.01,
      }),
    });
  });
  await page.route("**/api/inpick/estimate-context/finalize", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ contextId: "qa-context", canBuildEstimate: true }),
    });
  });

  await page.goto("/workflow?step=2");
  await expect(page.getByText("공간별 AI 디자인", { exact: true })).toBeVisible();
  await expect(page.getByText("전체 공간 · AI 디자인 프롬프트", { exact: true })).toBeVisible();
  await expect(page.getByText("클릭해서 크게 보기", { exact: true })).toBeVisible();
  await expect(page.getByText("부위별 자재 선택·수정", { exact: true })).toHaveCount(0);

  const prompt = page.getByPlaceholder(/상담 또는 수정 요청/);
  await prompt.fill("안방 문을 밝은 오크 방문으로 바꿔줘");
  await page.getByRole("button", { name: "메시지 전송" }).click();
  await expect(page.getByText("안방 수정 시안을 만들었습니다.", { exact: false })).toBeVisible();
  await expect(page.getByText("AI 디자인 생성 중", { exact: true })).toHaveCount(0);

  expect(editRequest.targetId).toBe("master");
  expect(editRequest.targetNameKo).toBe("안방");
  expect(editRequest.targetSurfaces).toEqual(["door"]);
  expect(editRequest.analyzeSurfaces).toBe(false);
  expect((editRequest.sourceImage as { dataUrl?: string }).dataUrl).toBe(master2);

  await page.getByRole("button", { name: /^안방/ }).first().click();
  await expect(page.getByText("3장 생성됨", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("step2-room-edit.png") });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /최종 이미지 선택 → 견적/ }).click();
  await expect(page.getByText("견적에 사용할 실별 최종 이미지", { exact: true })).toBeVisible();
  await expect(page.getByText("각 실에서 1장씩 선택하세요.", { exact: false })).toBeVisible();
  const livingFirstOption = page.getByTestId("final-design-option-living-0");
  await livingFirstOption.click();
  await expect(livingFirstOption).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: testInfo.outputPath("step2-final-selection.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  const confirmButton = page.getByRole("button", { name: /선택 완료 · 견적 받기/ });
  await expect(confirmButton).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("step2-final-selection-mobile.png") });
  await confirmButton.click();
  await page.waitForURL("**/workflow/estimate", { timeout: 15_000 });

  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem("workflow_step2") || "{}"));
  expect(saved.selectedByRoom).toMatchObject({ living: 0, master: 2 });
  expect(saved.finalSelectedImageUrlsByRoom).toEqual({ living: living1, master: masterEdited });
  expect(Object.keys(saved.finalSelectedImageUrlsByRoom)).toEqual(["living", "master"]);
});
