import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  fetchWorkflowState,
  readWorkflowSessionSnapshot,
  resolveWorkflowLastStep,
  resolveWorkflowVisibleStep,
  saveWorkflowSessionSnapshot,
  saveWorkflowState,
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
