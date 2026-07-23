import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  clearDeletedWorkflowProjects,
  fetchWorkflowState,
  isActiveWorkflowProjectId,
  lightenWorkflowStep2,
  readWorkflowSessionSnapshot,
  resolveWorkflowLastStep,
  resolveWorkflowVisibleStep,
  saveWorkflowSessionSnapshot,
  saveWorkflowState,
  shouldAdoptLatestWorkflowProject,
  startFreshWorkflowSession,
} from "../client";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

const local = new MemoryStorage();
const session = new MemoryStorage();

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: globalThis,
});
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: local,
});
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: session,
});

beforeEach(() => {
  local.clear();
  session.clear();
});

test("a newer local Step1 choice is not overwritten by a delayed server Step2", () => {
  const lastStep = resolveWorkflowLastStep(1, 2);
  assert.equal(lastStep, 1);
  assert.equal(
    resolveWorkflowVisibleStep({ requestedStep2: false, lastStep, hasStep2: true }),
    1,
  );
});

test("server Step2 resumes only when the Step2 body exists", () => {
  const lastStep = resolveWorkflowLastStep(undefined, 2);
  assert.equal(
    resolveWorkflowVisibleStep({ requestedStep2: false, lastStep, hasStep2: true }),
    2,
  );
  assert.equal(
    resolveWorkflowVisibleStep({ requestedStep2: false, lastStep, hasStep2: false }),
    1,
  );
});

test("legacy workflow keys are never restored into a different project", () => {
  local.setItem("workflow_project_id", "project-a");
  session.setItem("workflow_step1", JSON.stringify({ name: "A" }));
  session.setItem("workflow_step2", JSON.stringify({ room: "living" }));
  session.setItem("workflow_step", "2");

  assert.equal(readWorkflowSessionSnapshot("project-b"), null);
  assert.deepEqual(readWorkflowSessionSnapshot("project-a"), {
    projectId: "project-a",
    step1: { name: "A" },
    step2: { room: "living" },
    lastStep: 2,
  });
});

test("project-scoped snapshot survives switching the active project", () => {
  saveWorkflowSessionSnapshot({
    projectId: "project-a",
    step1: { name: "A" },
    step2: { room: "living" },
    lastStep: 1,
  });
  local.setItem("workflow_project_id", "project-b");

  assert.deepEqual(readWorkflowSessionSnapshot("project-a"), {
    projectId: "project-a",
    step1: { name: "A" },
    step2: { room: "living" },
    lastStep: 1,
  });
});

test("fresh project requests never adopt the account's latest existing project", () => {
  assert.equal(
    shouldAdoptLatestWorkflowProject({
      freshProjectRequested: true,
      requestedProjectId: "",
      workflowStateExists: false,
      hasStep2: false,
    }),
    false,
  );
});

test("ordinary empty sessions may recover the account's latest project", () => {
  assert.equal(
    shouldAdoptLatestWorkflowProject({
      freshProjectRequested: false,
      requestedProjectId: "",
      workflowStateExists: false,
      hasStep2: false,
    }),
    true,
  );
  assert.equal(
    shouldAdoptLatestWorkflowProject({
      freshProjectRequested: false,
      requestedProjectId: "selected-project",
      workflowStateExists: false,
      hasStep2: false,
    }),
    false,
  );
});

test("starting a new project removes every active and scoped image snapshot before assigning a new id", () => {
  local.setItem("workflow_project_id", "project-a");
  session.setItem("workflow_project_id", "project-a");
  saveWorkflowSessionSnapshot({
    projectId: "project-a",
    step1: { name: "old" },
    step2: { rendersByRoom: { living: [{ url: "old-image" }] } },
    lastStep: 2,
  });
  session.setItem("workflow_rfq_decision_packet", "old-packet");
  session.setItem("bidding_post", "old-bid");

  const nextProjectId = startFreshWorkflowSession("project-b");

  assert.equal(nextProjectId, "project-b");
  assert.equal(local.getItem("workflow_project_id"), "project-b");
  assert.equal(session.getItem("workflow_project_id"), null);
  assert.equal(session.getItem("workflow_step1"), null);
  assert.equal(session.getItem("workflow_step2"), null);
  assert.equal(session.getItem("workflow_step"), null);
  assert.equal(session.getItem("workflow_snapshot:project-a"), null);
  assert.equal(session.getItem("workflow_rfq_decision_packet"), null);
  assert.equal(session.getItem("bidding_post"), null);
  assert.equal(readWorkflowSessionSnapshot("project-b"), null);
});

test("deleting the active project clears its Step2 snapshot and rotates the active id", () => {
  local.setItem("workflow_project_id", "project-a");
  saveWorkflowSessionSnapshot({
    projectId: "project-a",
    step1: { name: "old" },
    step2: { rendersByRoom: { bath: [{ url: "paid-image" }] } },
    lastStep: 2,
  });

  const result = clearDeletedWorkflowProjects(["project-a"], "project-new");

  assert.deepEqual(result, {
    activeProjectDeleted: true,
    nextProjectId: "project-new",
  });
  assert.equal(local.getItem("workflow_project_id"), "project-new");
  assert.equal(session.getItem("workflow_snapshot:project-a"), null);
  assert.equal(session.getItem("workflow_step2"), null);
});

test("deleting another project preserves the active workflow", () => {
  local.setItem("workflow_project_id", "project-active");
  session.setItem("workflow_snapshot:project-old", JSON.stringify({ projectId: "project-old" }));
  session.setItem("workflow_step2", JSON.stringify({ room: "living" }));

  const result = clearDeletedWorkflowProjects(["project-old"]);

  assert.deepEqual(result, { activeProjectDeleted: false });
  assert.equal(local.getItem("workflow_project_id"), "project-active");
  assert.equal(session.getItem("workflow_snapshot:project-old"), null);
  assert.notEqual(session.getItem("workflow_step2"), null);
});

test("locked room snapshots never persist original or refined image URLs", () => {
  const lightened = lightenWorkflowStep2({
    unlockedRenderKeys: { kitchen: [] },
    rendersByRoom: {
      living: [{ timestamp: "living-1", url: "https://cdn/living.png" }],
      kitchen: [
        {
          timestamp: "kitchen-1",
          url: "https://cdn/private-kitchen.png",
          refinedUrl: "https://cdn/private-kitchen-hd.png",
          lockedAssetId: "asset-kitchen-1",
          accessState: "locked",
        },
      ],
    },
  });

  assert.equal(lightened.rendersByRoom.living[0].url, "https://cdn/living.png");
  assert.equal("url" in lightened.rendersByRoom.kitchen[0], false);
  assert.equal("refinedUrl" in lightened.rendersByRoom.kitchen[0], false);
  assert.equal(lightened.rendersByRoom.kitchen[0].lockedAssetId, "asset-kitchen-1");
  assert.equal(lightened.rendersByRoom.kitchen[0].accessState, "locked");
});

test("a paid locked snapshot keeps its entitlement hint but requires a fresh signed URL", () => {
  const lightened = lightenWorkflowStep2({
    rendersByRoom: {
      bath: [
        {
          timestamp: "bath-1",
          url: "https://signed/expired-soon.webp",
          lockedAssetId: "asset-bath-1",
          accessState: "unlocked",
          viewExpiresAt: "2026-07-24T00:08:00.000Z",
        },
      ],
    },
  });

  assert.equal("url" in lightened.rendersByRoom.bath[0], false);
  assert.equal("viewExpiresAt" in lightened.rendersByRoom.bath[0], false);
  assert.equal(lightened.rendersByRoom.bath[0].accessState, "locked");
  assert.equal(lightened.rendersByRoom.bath[0].entitlementGranted, true);
});

test("late design output restore is rejected after the active project changes", () => {
  local.setItem("workflow_project_id", "project-a");
  assert.equal(isActiveWorkflowProjectId("project-a"), true);

  startFreshWorkflowSession("project-b");

  assert.equal(isActiveWorkflowProjectId("project-a"), false);
  assert.equal(isActiveWorkflowProjectId("project-b"), true);
});

test("parallel workflow-state readers share one request and successful save invalidates cache", async () => {
  const originalFetch = globalThis.fetch;
  let getCount = 0;
  let postCount = 0;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    if (init?.method === "POST") {
      postCount += 1;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    getCount += 1;
    await Promise.resolve();
    return new Response(
      JSON.stringify({ exists: true, projectId: "dedupe-project", workflowState: {} }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const [first, second] = await Promise.all([
      fetchWorkflowState("dedupe-project"),
      fetchWorkflowState("dedupe-project"),
    ]);
    assert.equal(first?.exists, true);
    assert.deepEqual(second, first);
    assert.equal(getCount, 1);

    await fetchWorkflowState("dedupe-project");
    assert.equal(getCount, 1);

    assert.equal(
      await saveWorkflowState({ projectId: "dedupe-project", lastStep: 2 }),
      true,
    );
    assert.equal(postCount, 1);

    await fetchWorkflowState("dedupe-project");
    assert.equal(getCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
