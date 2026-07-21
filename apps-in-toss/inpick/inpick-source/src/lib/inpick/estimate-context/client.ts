/**
 * 클라이언트(브라우저) 측 design_outputs / estimate-context 헬퍼.
 *
 * 핵심 원칙:
 *   - 인증 실패/API 실패는 워크플로를 절대 막지 않음 (로컬 state는 그대로 유지)
 *   - 모든 함수는 실패해도 null/false 반환, throw 하지 않음
 */
"use client";

import type {
  DesignOutput,
  DesignTargetType,
  MaterialHint,
  ProjectMode,
  RenderKind,
} from "./types";

const PROJECT_ID_KEY = "workflow_project_id";
const WORKFLOW_SNAPSHOT_PREFIX = "workflow_snapshot:";
const WORKFLOW_STATE_CACHE_TTL_MS = 15_000;

export interface WorkflowSessionSnapshot {
  projectId: string;
  step1?: unknown;
  step2?: unknown;
  lastStep: 1 | 2;
}

/**
 * 현재 브라우저의 단계 선택은 DB 디바운스 저장보다 최대 1.2초 최신이다.
 * 로컬 값이 있으면 뒤늦은 DB lastStep이 화면을 임의로 옮기지 못하게 한다.
 */
export function resolveWorkflowLastStep(
  localLastStep: number | undefined,
  serverLastStep: number | undefined,
): 1 | 2 {
  return (localLastStep ?? serverLastStep) === 2 ? 2 : 1;
}

/** step2 본문이 없는 오래된 상태는 빈 Step2 화면으로 열지 않는다. */
export function resolveWorkflowVisibleStep(input: {
  requestedStep2: boolean;
  lastStep: number;
  hasStep2: boolean;
}): 1 | 2 {
  if (input.requestedStep2) return 2;
  return input.lastStep === 2 && input.hasStep2 ? 2 : 1;
}

const workflowStateCache = new Map<
  string,
  { expiresAt: number; value: WorkflowStateRow | null }
>();
const workflowStateRequests = new Map<string, Promise<WorkflowStateRow | null>>();

/**
 * workflow projectId — localStorage에 UUID로 보관.
 * (sessionStorage였으나 재로그인/새 세션 시 projectId가 소실되어 계정의 DB 프로젝트와
 *  매칭이 끊기는 문제로 localStorage로 변경 — 같은 브라우저에서 재로그인 시 그대로 복원.)
 * 견적 페이지/입찰 페이지에서도 같은 키로 읽어 일관성 유지.
 */
export function getOrCreateWorkflowProjectId(): string {
  if (typeof window === "undefined") return "";
  try {
    // 기존 sessionStorage 값이 있으면 1회 마이그레이션
    const legacy = sessionStorage.getItem(PROJECT_ID_KEY);
    const existing = localStorage.getItem(PROJECT_ID_KEY) || legacy;
    if (existing) {
      localStorage.setItem(PROJECT_ID_KEY, existing);
      return existing;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : fallbackUuid();
    localStorage.setItem(PROJECT_ID_KEY, id);
    return id;
  } catch {
    return fallbackUuid();
  }
}

/**
 * 영속 저장용 step2 경량화 — rendersByRoom 각 항목의 순수 base64/dataUrl 제거.
 * (base64는 활성 세션의 Anthropic 편집 전송용일 뿐, 표시는 imageUrl[스토리지 URL]로 충분.
 *  이게 sessionStorage/DB에 들어가면 수 MB로 비대해져 QuotaExceeded/413으로 저장이 실패하고
 *  → 견적요청 네비게이션 무산 / 견적 페이지 공백 / 재로그인 소실의 근본 원인이 됨.)
 * 메모리상의 state는 그대로 두고, 저장하는 복사본만 경량화한다.
 */
export function lightenWorkflowStep2<T>(step2: T): T {
  const s = step2 as unknown as { rendersByRoom?: Record<string, Array<Record<string, unknown>>> };
  if (!s || typeof s !== "object" || !s.rendersByRoom) return step2;
  const lightened: Record<string, Array<Record<string, unknown>>> = {};
  for (const key of Object.keys(s.rendersByRoom)) {
    lightened[key] = (s.rendersByRoom[key] || []).map((item) => {
      const { base64, dataUrl, ...rest } = item as Record<string, unknown> & { base64?: unknown; dataUrl?: unknown };
      void base64; void dataUrl;
      return rest;
    });
  }
  return { ...(s as object), rendersByRoom: lightened } as unknown as T;
}

/** 계정 복원 등으로 활성 projectId를 교체. */
export function setWorkflowProjectId(id: string) {
  if (typeof window === "undefined" || !id) return;
  try {
    localStorage.setItem(PROJECT_ID_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * 프로젝트별 최근 작업 스냅샷을 읽는다.
 *
 * 기존 글로벌 workflow_step* 키는 현재 프로젝트와 id가 같을 때만
 * 폴백으로 읽어, 다른 프로젝트 상태가 잠시 노출되는 것을 막는다.
 */
export function readWorkflowSessionSnapshot(
  projectId: string,
): WorkflowSessionSnapshot | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const scoped = sessionStorage.getItem(`${WORKFLOW_SNAPSHOT_PREFIX}${projectId}`);
    if (scoped) {
      const parsed = JSON.parse(scoped) as Partial<WorkflowSessionSnapshot>;
      if (parsed.projectId === projectId) {
        return {
          projectId,
          step1: parsed.step1,
          step2: parsed.step2,
          lastStep: parsed.lastStep === 2 ? 2 : 1,
        };
      }
    }

    const activeProjectId =
      localStorage.getItem(PROJECT_ID_KEY) || sessionStorage.getItem(PROJECT_ID_KEY);
    if (activeProjectId !== projectId) return null;

    const step1raw = sessionStorage.getItem("workflow_step1");
    const step2raw = sessionStorage.getItem("workflow_step2");
    if (!step1raw && !step2raw) return null;
    return {
      projectId,
      step1: step1raw ? JSON.parse(step1raw) : undefined,
      step2: step2raw ? JSON.parse(step2raw) : undefined,
      lastStep: sessionStorage.getItem("workflow_step") === "2" ? 2 : 1,
    };
  } catch (err) {
    console.warn("[workflow] session snapshot restore fail", err);
    return null;
  }
}

/**
 * 현재 화면 호환 키와 프로젝트별 키를 한 번에 동기화한다.
 * step2는 호출 전 lightenWorkflowStep2로 경량화한 값이어야 한다.
 */
export function saveWorkflowSessionSnapshot(input: WorkflowSessionSnapshot): boolean {
  if (typeof window === "undefined" || !input.projectId) return false;
  try {
    const snapshot: WorkflowSessionSnapshot = {
      ...input,
      lastStep: input.lastStep === 2 ? 2 : 1,
    };
    sessionStorage.setItem(
      `${WORKFLOW_SNAPSHOT_PREFIX}${input.projectId}`,
      JSON.stringify(snapshot),
    );
    if (snapshot.step1 != null) {
      sessionStorage.setItem("workflow_step1", JSON.stringify(snapshot.step1));
    }
    if (snapshot.step2 != null) {
      sessionStorage.setItem("workflow_step2", JSON.stringify(snapshot.step2));
    }
    sessionStorage.setItem("workflow_step", String(snapshot.lastStep));
    return true;
  } catch (err) {
    console.warn("[workflow] session snapshot save skipped (non-fatal)", err);
    return false;
  }
}

/** 다른 프로젝트로 전환할 때 현재 화면용 글로벌 키만 비운다. */
export function clearActiveWorkflowSessionSnapshot() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem("workflow_step1");
    sessionStorage.removeItem("workflow_step2");
    sessionStorage.removeItem("workflow_step");
  } catch {
    /* private mode */
  }
}

/** 초기화할 때 현재 프로젝트의 프로젝트별 캐시도 함께 제거한다. */
export function clearWorkflowSessionSnapshot(projectId: string) {
  clearActiveWorkflowSessionSnapshot();
  if (typeof window === "undefined" || !projectId) return;
  try {
    sessionStorage.removeItem(`${WORKFLOW_SNAPSHOT_PREFIX}${projectId}`);
  } catch {
    /* private mode */
  }
}

function fallbackUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function clearWorkflowProjectId() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PROJECT_ID_KEY);
    sessionStorage.removeItem(PROJECT_ID_KEY);
  } catch {
    /* ignore */
  }
}

export interface SaveDesignOutputInput {
  projectMode: ProjectMode;
  targetType: DesignTargetType;
  targetId: string;
  targetName: string;
  renderKind: RenderKind;
  imageUrl: string;
  prompt?: string;
  negativePrompt?: string;
  materialHints?: MaterialHint[];
}

/**
 * 이미지 생성 성공 직후 호출 — design_outputs DB에 evidence 저장.
 * 실패해도 throw 하지 않고 null 반환 (워크플로 막지 않음).
 */
export async function saveDesignOutputAfterRender(
  input: SaveDesignOutputInput,
): Promise<DesignOutput | null> {
  try {
    const projectId = getOrCreateWorkflowProjectId();
    if (!projectId) return null;
    const res = await fetch("/api/inpick/design-outputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...input }),
    });
    if (!res.ok) {
      // 401(미인증) 포함 — 사용자가 로그인 안 했어도 워크플로는 그대로 진행
      console.warn(
        `[design-outputs] save skipped (status ${res.status}) — local state remains source of truth`,
      );
      return null;
    }
    const data = (await res.json()) as { output: DesignOutput };
    return data.output;
  } catch (err) {
    console.warn("[design-outputs] save error (non-fatal):", err);
    return null;
  }
}

/**
 * P8: workflow_state 저장 — 사용자×프로젝트 영속.
 * 실패해도 throw 안 함 (sessionStorage가 폴백).
 */
export async function saveWorkflowState(input: {
  projectId: string;
  step1?: unknown;
  step2?: unknown;
  contextId?: string;
  lastStep?: number;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/inpick/workflow-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) workflowStateCache.delete(input.projectId);
    return res.ok;
  } catch (err) {
    console.warn("[workflow-state] save error (non-fatal):", err);
    return false;
  }
}

export interface WorkflowStateRow {
  exists: boolean;
  projectId?: string;
  workflowState?: {
    step1?: Record<string, unknown>;
    step2?: Record<string, unknown>;
    contextId?: string;
    lastStep?: number;
    updatedAt?: string;
  } | null;
  status?: string;
  updatedAt?: string;
}

/**
 * P8: workflow_state 조회 — 워크플로/견적 페이지 mount 시 호출.
 */
export async function fetchWorkflowState(
  projectId: string,
): Promise<WorkflowStateRow | null> {
  const now = Date.now();
  const cached = workflowStateCache.get(projectId);
  if (cached && cached.expiresAt > now) return cached.value;

  const pending = workflowStateRequests.get(projectId);
  if (pending) return pending;

  const request = fetchWorkflowStateUncached(projectId).finally(() => {
    workflowStateRequests.delete(projectId);
  });
  workflowStateRequests.set(projectId, request);
  return request;
}

async function fetchWorkflowStateUncached(
  projectId: string,
): Promise<WorkflowStateRow | null> {
  try {
    const res = await fetch(
      `/api/inpick/workflow-state?projectId=${encodeURIComponent(projectId)}`,
    );
    if (!res.ok) return null;
    const value = (await res.json()) as WorkflowStateRow;
    workflowStateCache.set(projectId, {
      expiresAt: Date.now() + WORKFLOW_STATE_CACHE_TTL_MS,
      value,
    });
    return value;
  } catch (err) {
    console.warn("[workflow-state] fetch error (non-fatal):", err);
    return null;
  }
}

/** 내 프로젝트 카드 hover/focus 시 복원 요청을 미리 시작한다. */
export function preloadWorkflowState(projectId: string): void {
  if (!projectId) return;
  void fetchWorkflowState(projectId);
}

/**
 * P8: 본인 워크플로 프로젝트 목록 — "내 프로젝트" 페이지용.
 */
export async function fetchWorkflowProjects(): Promise<
  Array<{ id: string; status?: string; updatedAt?: string; summary: string }>
> {
  try {
    const res = await fetch(`/api/inpick/workflow-state?list=1`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      projects?: Array<{ id: string; status?: string; updatedAt?: string; summary: string }>;
    };
    return data.projects ?? [];
  } catch (err) {
    console.warn("[workflow-state] list error (non-fatal):", err);
    return [];
  }
}

/**
 * projectId 기준 design_outputs 조회 — 견적 페이지 진입 시 호출.
 */
export async function fetchDesignOutputs(projectId: string): Promise<DesignOutput[]> {
  try {
    const res = await fetch(
      `/api/inpick/design-outputs?projectId=${encodeURIComponent(projectId)}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { outputs: DesignOutput[] };
    return data.outputs ?? [];
  } catch (err) {
    console.warn("[design-outputs] fetch error (non-fatal):", err);
    return [];
  }
}
