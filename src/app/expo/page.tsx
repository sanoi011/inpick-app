"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ExpoDimensionError,
  ExpoFootprintError,
  confirmExpoDimensions,
  createProvisionalFootprint,
  type ExpoAreaUnit,
  type ExpoBoothType,
  type ExpoConfirmedDimensions,
  type ExpoProvisionalFootprint,
} from "@/lib/expo/footprint";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  EXPO_BASE_CATALOG,
  addExpoComponent,
  findCatalogItem,
  createExpoScene,
  evaluateExpoScene,
  isExpoBoothScene,
  moveExpoComponent,
  removeExpoComponent,
  addWallFromPrompt,
  applyConceptSuggestions,
  promptMentionsWall,
  resizeExpoComponent,
  resizeExpoScene,
  rotateExpoComponent,
  type ExpoBoothScene,
} from "@/lib/expo/scene";
import {
  applySceneChange,
  canRedoScene,
  canUndoScene,
  createSceneHistory,
  redoScene,
  resetSceneHistory,
  undoScene,
  type ExpoSceneHistory,
} from "@/lib/expo/scene-history";
import type { ExpoCameraPreset } from "@/components/expo/BoothShell3D";
import {
  EXPO_MONEY_SOURCE_LABELS,
  buildCatalogEstimate,
  buildConceptualRange,
  estimateToCsv,
  formatKrw,
  isExpoEstimateOverrides,
  type ExpoEstimateOverrides,
} from "@/lib/expo/estimate";
import {
  canPublishProposal,
  isExpoProposalSnapshot,
  isProposalStale,
  type ExpoProposalSnapshot,
} from "@/lib/expo/proposal";
import {
  EXPO_DECISION_LABELS,
  isExpoClientDecision,
  type ExpoClientDecision,
} from "@/lib/expo/client-decision";
import {
  createEmptyEventInfo,
  createEmptyOfficialServices,
  evaluateEventRules,
  hasEventRuleInput,
  hasEventRuleViolation,
  hasOfficialServicesInput,
  isExpoEventInfo,
  isExpoOfficialServices,
  type ExpoEventInfo,
  type ExpoOfficialServices,
} from "@/lib/expo/event-rules";
import {
  isExpoBrandKit,
  type ExpoBrandCandidates,
  type ExpoBrandKit,
} from "@/lib/expo/brand-import";
import {
  EXPO_READINESS_STATE_LABELS,
  evaluateProposalReadiness,
  readinessPercent,
  type ExpoReadinessState,
} from "@/lib/expo/readiness";

const READINESS_CHIP_CLASSES: Record<ExpoReadinessState, string> = {
  unstarted: "bg-zinc-100 text-zinc-500",
  assumed: "bg-amber-50 text-amber-700",
  needs_review: "bg-orange-50 text-orange-700",
  confirmed: "bg-green-50 text-green-700",
  blocked: "bg-red-50 text-red-700",
  stale: "bg-zinc-100 text-zinc-600",
};

const CAMERA_PRESET_IDS: readonly ExpoCameraPreset[] = [
  "hero",
  "front",
  "top",
  "visitor",
];

const BoothShell3D = dynamic(() => import("@/components/expo/BoothShell3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-2xl border border-black/10 bg-slate-50 text-sm text-black/50 sm:h-[400px]">
      3D 캔버스 준비 중…
    </div>
  ),
});

/** Builder Kit — 한국 전시 관행 기반 시작 프리셋 (§7.1 실동작 요건) */
const BUILDER_KITS = [
  { id: "kit_9_light", label: "9㎡ 라이트", areaSqm: 9, description: "3m × 3m 조립 부스 기본형" },
  { id: "kit_18_standard", label: "18㎡ 스탠다드", areaSqm: 18, description: "6m × 3m 인라인 확장형" },
  { id: "kit_36_island", label: "36㎡ 프리미엄", areaSqm: 36, description: "6m × 6m 대형 전시" },
] as const;

type StartMode = "quick_area" | "builder_kit" | "clone_reflow";

type FlowStep = "concept" | "model" | "company" | "print" | "final";

const FLOW_STEPS: Array<{ id: FlowStep; label: string }> = [
  { id: "concept", label: "1. 컨셉" },
  { id: "model", label: "2. 3D 배치" },
  { id: "company", label: "3. 기업정보" },
  { id: "print", label: "4. 인쇄물" },
  { id: "final", label: "5. 확정·견적" },
];

interface CloneSourceProject {
  id: string;
  title: string;
  area_input: number;
  area_unit: ExpoAreaUnit;
  scene: unknown;
  brand: unknown;
  event: unknown;
  confirmed_dimensions: unknown;
  concept_image_url: string | null;
  concept_images: unknown;
  contract_prep: unknown;
  official_services: unknown;
  estimate_overrides: unknown;
  quick_fields: { builderName?: string; clientName?: string; eventName?: string } | null;
  updated_at: string;
}

interface ExpoBriefDraft {
  version: 3;
  savedAt: string;
  startMode: StartMode;
  areaInput: string;
  unit: ExpoAreaUnit;
  selectedCandidateLabel: string | null;
  confirmedDimensions: ExpoConfirmedDimensions | null;
  scene: ExpoBoothScene | null;
  cameraPreset?: ExpoCameraPreset;
  /** Storage URL만 저장 (data URL 금지 — localStorage 용량 보호) */
  conceptImageUrl?: string;
  brandKit?: ExpoBrandKit;
  conceptGallery?: Array<{ url: string; prompt: string; createdAt: string }>;
  contractPrep?: { startedAt: string; note: string } | null;
  conceptWallTextureUrl?: string | null;
  conceptAccentHex?: string | null;
  eventInfo?: ExpoEventInfo;
  officialServices?: ExpoOfficialServices;
  estimateOverrides?: ExpoEstimateOverrides;
  serverProjectId: string | null;
  quickFields: {
    builderName: string;
    clientName: string;
    eventName: string;
  };
}

const DRAFT_KEY = "expo_brief_draft_v3";

const BOOTH_TYPE_LABELS: Record<ExpoBoothType, string> = {
  inline: "인라인 (오픈 1면)",
  corner: "코너 (오픈 2면)",
  peninsula: "반도형 (오픈 3면)",
  island: "아일랜드 (오픈 4면)",
};

export default function ExpoBriefPage() {
  // 확정 플로우: 컨셉 이미지 → 3D 배치 → 기업정보 → 인쇄물 → 확정·견적
  const [flowStep, setFlowStep] = useState<FlowStep>("concept");
  const [autoApplyConcept, setAutoApplyConcept] = useState(false);
  const [startMode, setStartMode] = useState<StartMode>("quick_area");
  const [areaInput, setAreaInput] = useState("");
  const [unit, setUnit] = useState<ExpoAreaUnit>("sqm");
  const [footprint, setFootprint] = useState<ExpoProvisionalFootprint | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [builderName, setBuilderName] = useState("");
  const [clientName, setClientName] = useState("");
  const [eventName, setEventName] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmedDims, setConfirmedDims] = useState<ExpoConfirmedDimensions | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [serverProjectId, setServerProjectId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"local" | "saving" | "saved" | "signed_out">("local");
  const [dimWidth, setDimWidth] = useState("");
  const [dimDepth, setDimDepth] = useState("");
  const [dimHeight, setDimHeight] = useState("2.5");
  const [dimBoothType, setDimBoothType] = useState<ExpoBoothType>("island");
  const [sceneHistory, setSceneHistory] = useState<ExpoSceneHistory>(() =>
    createSceneHistory(null),
  );
  const scene = sceneHistory.present;
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<ExpoCameraPreset>("hero");
  // AI 컨셉 — GPT Image 2 (본체 인픽과 동일 엔진·토큰 정책, 컨셉 전용)
  const [conceptPrompt, setConceptPrompt] = useState("");
  const [conceptImage, setConceptImage] = useState<string | null>(null);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [conceptGallery, setConceptGallery] = useState<
    Array<{ url: string; prompt: string; createdAt: string }>
  >([]);
  // 컨셉 → 3D 반영 (벽 텍스처·팔레트 악센트) — 컨셉 전용 표기 유지
  const [conceptWallTexture, setConceptWallTexture] = useState<string | null>(null);
  const [conceptAccent, setConceptAccent] = useState<string | null>(null);
  const [applyConceptState, setApplyConceptState] = useState<"idle" | "loading" | "error">("idle");
  // 선택 컴포넌트 크기 입력 (적용 버튼으로 확정)
  const [sizeDraftW, setSizeDraftW] = useState("");
  const [sizeDraftD, setSizeDraftD] = useState("");
  // 브랜드 — URL 후보 추출은 자동 확정 금지, 사용자가 선택+권한 확인 후 적용
  const [brandUrl, setBrandUrl] = useState("");
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandCandidates, setBrandCandidates] =
    useState<ExpoBrandCandidates | null>(null);
  const [brandLogoPick, setBrandLogoPick] = useState<string | null>(null);
  const [brandColorPick, setBrandColorPick] = useState<string | null>(null);
  const [brandKit, setBrandKit] = useState<ExpoBrandKit | null>(null);
  // 행사 규정 — 전부 사용자가 행사 매뉴얼에서 입력한 값 (source = 사용자 입력)
  const [eventInfo, setEventInfo] = useState<ExpoEventInfo>(createEmptyEventInfo);
  const [officialServices, setOfficialServices] = useState<ExpoOfficialServices>(
    createEmptyOfficialServices,
  );
  // 시공사 검토 단가 — 라인 id별 override (적용 라인은 quoted)
  const [estimateOverrides, setEstimateOverrides] = useState<ExpoEstimateOverrides>({});
  const [overrideEditId, setOverrideEditId] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState("");
  // Clone & Reflow — 저장된 프로젝트를 새 면적으로 복제
  const [cloneProjects, setCloneProjects] = useState<CloneSourceProject[] | null>(null);
  const [cloneState, setCloneState] = useState<"idle" | "loading" | "signed_out" | "error">("idle");
  const [cloneSelectedId, setCloneSelectedId] = useState<string | null>(null);
  const [cloneArea, setCloneArea] = useState("");
  // 제안 공유 — provisional 상태에서도 가능 (라벨이 함께 공유됨)
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [clientDecision, setClientDecision] = useState<ExpoClientDecision | null>(null);
  const [proposal, setProposal] = useState<ExpoProposalSnapshot | null>(null);
  // 계약 준비 기록 — contract 단계 아님 (계약서·법무 검토는 별도)
  const [contractPrep, setContractPrep] = useState<{ startedAt: string; note: string } | null>(null);
  const [publishState, setPublishState] = useState<"idle" | "loading" | "error">("idle");

  function updateScene(op: (current: ExpoBoothScene) => ExpoBoothScene) {
    setSceneHistory((history) =>
      history.present ? applySceneChange(history, op(history.present)) : history,
    );
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      event.preventDefault();
      setSceneHistory(event.shiftKey ? redoScene : undoScene);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!serverProjectId) {
      setClientDecision(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/expo/projects");
        if (cancelled || !response.ok) return;
        const payload = (await response.json().catch(() => ({}))) as {
          projects?: Array<{ id: string; client_decision?: unknown }>;
        };
        const row = payload.projects?.find((project) => project.id === serverProjectId) as
          | { id: string; client_decision?: unknown; proposal?: unknown }
          | undefined;
        if (row && isExpoClientDecision(row.client_decision)) {
          setClientDecision(row.client_decision);
        }
        if (row && isExpoProposalSnapshot(row.proposal)) {
          setProposal(row.proposal);
        }
      } catch {
        // 결정 조회 실패는 조용히 무시 (다음 로드에서 재시도)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serverProjectId]);

  useEffect(() => {
    if (startMode !== "clone_reflow" || cloneProjects !== null) return;
    let cancelled = false;
    (async () => {
      setCloneState("loading");
      try {
        const response = await fetch("/api/expo/projects");
        if (cancelled) return;
        if (response.status === 401) {
          setCloneState("signed_out");
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as {
          projects?: CloneSourceProject[];
        };
        if (response.ok && Array.isArray(payload.projects)) {
          setCloneProjects(payload.projects);
          setCloneState("idle");
          if (payload.projects[0]) {
            setCloneSelectedId(payload.projects[0].id);
            setCloneArea(String(payload.projects[0].area_input));
          }
        } else {
          setCloneState("error");
        }
      } catch {
        if (!cancelled) setCloneState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startMode, cloneProjects]);

  // 선택 변경 시 크기 입력칸을 현재 값으로 동기화
  useEffect(() => {
    if (!selectedComponentId) return;
    const component = sceneHistory.present?.components.find(
      (entry) => entry.id === selectedComponentId,
    );
    if (!component) return;
    const item = findCatalogItem(component.catalogId);
    setSizeDraftW(String(component.widthM ?? item?.widthM ?? 1));
    setSizeDraftD(String(component.depthM ?? item?.depthM ?? 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 선택 시점 스냅샷
  }, [selectedComponentId]);

  // 초기 복구 — 로컬 임시 저장분 (서버 저장은 다음 슬라이스, UI에 정직하게 표기)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as ExpoBriefDraft;
      if (draft.version !== 3) return;
      setStartMode(draft.startMode);
      setAreaInput(draft.areaInput);
      setUnit(draft.unit);
      setBuilderName(draft.quickFields.builderName);
      setClientName(draft.quickFields.clientName);
      setEventName(draft.quickFields.eventName);
      const area = Number(draft.areaInput);
      if (Number.isFinite(area) && area > 0) {
        try {
          const fp = createProvisionalFootprint(area, draft.unit);
          setFootprint(fp);
          setSelectedLabel(draft.selectedCandidateLabel);
          setConfirmedDims(draft.confirmedDimensions);
          setServerProjectId(draft.serverProjectId);
          const restoredScene = draft.scene;
          if (isExpoBoothScene(restoredScene)) {
            setSceneHistory(createSceneHistory(restoredScene));
          }
          if (draft.cameraPreset && CAMERA_PRESET_IDS.includes(draft.cameraPreset)) {
            setCameraPreset(draft.cameraPreset);
          }
          if (
            typeof draft.conceptImageUrl === "string" &&
            draft.conceptImageUrl.startsWith("https://")
          ) {
            setConceptImage(draft.conceptImageUrl);
          }
          if (isExpoBrandKit(draft.brandKit)) setBrandKit(draft.brandKit);
          if (
            typeof draft.conceptWallTextureUrl === "string" &&
            draft.conceptWallTextureUrl.startsWith("https://")
          ) {
            setConceptWallTexture(draft.conceptWallTextureUrl);
          }
          if (
            typeof draft.conceptAccentHex === "string" &&
            /^#[0-9a-f]{6}$/i.test(draft.conceptAccentHex)
          ) {
            setConceptAccent(draft.conceptAccentHex);
          }
          if (
            draft.contractPrep &&
            typeof draft.contractPrep.startedAt === "string"
          ) {
            setContractPrep({
              startedAt: draft.contractPrep.startedAt,
              note: typeof draft.contractPrep.note === "string" ? draft.contractPrep.note : "",
            });
          }
          if (Array.isArray(draft.conceptGallery)) {
            setConceptGallery(
              draft.conceptGallery
                .filter(
                  (item) =>
                    item &&
                    typeof item.url === "string" &&
                    item.url.startsWith("https://") &&
                    typeof item.prompt === "string" &&
                    typeof item.createdAt === "string",
                )
                .slice(0, 8),
            );
          }
          if (isExpoEventInfo(draft.eventInfo)) setEventInfo(draft.eventInfo);
          if (isExpoOfficialServices(draft.officialServices)) {
            setOfficialServices(draft.officialServices);
          }
          if (isExpoEstimateOverrides(draft.estimateOverrides)) {
            setEstimateOverrides(draft.estimateOverrides);
          }
        } catch {
          // 복구 실패는 새 입력으로 시작
        }
      }
      setRestored(true);
    } catch {
      // 손상된 draft는 무시
    }
  }, []);

  // 복구된 footprint가 있으면 마지막 단계에서 시작
  useEffect(() => {
    if (restored && footprint) setFlowStep("final");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 복구 직후 1회만
  }, [restored]);

  // autosave (로컬)
  useEffect(() => {
    const draft: ExpoBriefDraft = {
      version: 3,
      savedAt: new Date().toISOString(),
      startMode,
      areaInput,
      unit,
      selectedCandidateLabel: selectedLabel,
      confirmedDimensions: confirmedDims,
      scene,
      cameraPreset,
      conceptImageUrl:
        conceptImage && conceptImage.startsWith("https://")
          ? conceptImage
          : undefined,
      brandKit: brandKit ?? undefined,
      conceptGallery,
      contractPrep,
      conceptWallTextureUrl: conceptWallTexture ?? undefined,
      conceptAccentHex: conceptAccent ?? undefined,
      eventInfo,
      officialServices,
      estimateOverrides,
      serverProjectId,
      quickFields: { builderName, clientName, eventName },
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // 저장 실패는 치명적이지 않음 — 다음 저장 시 재시도
    }
  }, [startMode, areaInput, unit, selectedLabel, confirmedDims, scene, cameraPreset, conceptImage, conceptGallery, contractPrep, conceptWallTexture, conceptAccent, brandKit, eventInfo, officialServices, estimateOverrides, serverProjectId, builderName, clientName, eventName]);

  // 서버 저장 — 로그인 세션이 있으면 디바운스 업서트. 마이그레이션 미적용/
  // 미로그인 환경은 로컬 임시 저장으로 조용히 폴백한다.
  useEffect(() => {
    if (!footprint) return;
    const timer = window.setTimeout(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setSaveState("signed_out");
          return;
        }
        setSaveState("saving");
        const response = await fetch("/api/expo/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: serverProjectId,
            title: eventName || builderName || "새 부스 프로젝트",
            areaInput: Number(areaInput),
            areaUnit: unit,
            footprint,
            confirmedDimensions: confirmedDims,
            scene,
            conceptImageUrl:
              conceptImage && conceptImage.startsWith("https://")
                ? conceptImage
                : null,
            brand: brandKit,
            event: { ...eventInfo, eventName: eventInfo.eventName || eventName },
            officialServices,
            estimateOverrides,
            conceptGallery,
            contractPrep,
            quickFields: { builderName, clientName, eventName },
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          project?: { id?: string };
        };
        if (response.ok && payload.project?.id) {
          setServerProjectId(payload.project.id);
          setSaveState("saved");
        } else {
          setSaveState("local");
        }
      } catch {
        setSaveState("local");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [footprint, confirmedDims, scene, conceptImage, conceptGallery, contractPrep, brandKit, eventInfo, officialServices, estimateOverrides, areaInput, unit, serverProjectId, builderName, clientName, eventName]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const area = Number(areaInput);
    if (!Number.isFinite(area) || area <= 0) {
      setError("면적을 확인해 주세요.");
      return;
    }
    setError(null);
    void generateConcept();
  }

  /** 컨셉 확정 — 3D 부스 생성(무벽 기본, 프롬프트 벽 언급 시 그래픽 월) 후 배치 단계로 */
  function createBoothFromPrompt() {
    const area = Number(areaInput);
    setError(null);
    try {
      const fp = createProvisionalFootprint(area, unit);
      setFootprint(fp);
      setSelectedLabel(fp.selected.label);
      setConfirmedDims(null);
      setSelectedComponentId(null);
      const current = sceneHistory.present;
      let nextScene =
        current && current.components.length > 0
          ? resizeExpoScene(current, fp.selected.widthM, fp.selected.depthM)
          : createExpoScene(fp.selected.widthM, fp.selected.depthM);
      if (promptMentionsWall(conceptPrompt)) {
        nextScene = addWallFromPrompt(
          nextScene,
          `c_${Date.now().toString(36)}_wall`,
        );
      }
      setSceneHistory(createSceneHistory(nextScene));
      setDimWidth(String(fp.selected.widthM));
      setDimDepth(String(fp.selected.depthM));
      setDimHeight(String(fp.wallHeightM));
      setFlowStep("model");
      // 생성된 컨셉 이미지를 3D에 자동 반영 (벽 텍스처·팔레트·구성 제안)
      if (conceptImage && conceptImage.startsWith("https://")) {
        setAutoApplyConcept(true);
      }
    } catch (cause) {
      setFootprint(null);
      setSelectedLabel(null);
      setError(
        cause instanceof ExpoFootprintError
          ? footprintErrorMessage(cause.code)
          : "면적을 확인해 주세요.",
      );
      setFlowStep("concept");
    }
  }

  function applyKit(kit: (typeof BUILDER_KITS)[number]) {
    setStartMode("builder_kit");
    setUnit("sqm");
    setAreaInput(String(kit.areaSqm));
    setError(null);
  }

  function downloadEstimateCsv() {
    if (!catalogEstimate) return;
    const blob = new Blob([estimateToCsv(catalogEstimate)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `inpick-expo-estimate-${catalogEstimate.areaSqm}sqm.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function publishProposal() {
    if (!serverProjectId || publishState === "loading") return;
    setPublishState("loading");
    try {
      const response = await fetch("/api/expo/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: serverProjectId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        proposal?: unknown;
      };
      if (response.ok && isExpoProposalSnapshot(payload.proposal)) {
        setProposal(payload.proposal);
        setPublishState("idle");
      } else {
        setPublishState("error");
      }
    } catch {
      setPublishState("error");
    }
  }

  async function shareProposal() {
    if (!serverProjectId || shareState === "loading") return;
    setShareState("loading");
    try {
      const response = await fetch("/api/expo/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: serverProjectId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        path?: string;
      };
      if (response.ok && payload.path) {
        const url = `${window.location.origin}${payload.path}`;
        setShareUrl(url);
        try {
          await navigator.clipboard.writeText(url);
          setShareState("copied");
        } catch {
          setShareState("idle");
        }
      } else {
        setShareState("error");
      }
    } catch {
      setShareState("error");
    }
  }

  function resumeProject(project: CloneSourceProject) {
    setError(null);
    try {
      const fp = createProvisionalFootprint(project.area_input, project.area_unit);
      setStartMode("quick_area");
      setUnit(project.area_unit);
      setAreaInput(String(project.area_input));
      setFootprint(fp);
      setSelectedLabel(fp.selected.label);
      setSelectedComponentId(null);
      setServerProjectId(project.id); // 같은 프로젝트로 계속 저장
      const savedConfirmed = project.confirmed_dimensions as ExpoConfirmedDimensions | null;
      setConfirmedDims(savedConfirmed ?? null);
      const savedScene = isExpoBoothScene(project.scene) ? project.scene : null;
      setSceneHistory(
        createSceneHistory(
          savedScene ??
            createExpoScene(
              savedConfirmed?.widthM ?? fp.selected.widthM,
              savedConfirmed?.depthM ?? fp.selected.depthM,
            ),
        ),
      );
      setBrandKit(isExpoBrandKit(project.brand) ? project.brand : null);
      setEventInfo(
        isExpoEventInfo(project.event) ? project.event : createEmptyEventInfo(),
      );
      setOfficialServices(
        isExpoOfficialServices(project.official_services)
          ? project.official_services
          : createEmptyOfficialServices(),
      );
      setEstimateOverrides(
        isExpoEstimateOverrides(project.estimate_overrides)
          ? project.estimate_overrides
          : {},
      );
      setConceptImage(
        project.concept_image_url && project.concept_image_url.startsWith("https://")
          ? project.concept_image_url
          : null,
      );
      setConceptGallery(
        Array.isArray(project.concept_images)
          ? (project.concept_images as Array<{ url?: unknown; prompt?: unknown; createdAt?: unknown }>)
              .filter(
                (item): item is { url: string; prompt: string; createdAt: string } =>
                  Boolean(item) &&
                  typeof item.url === "string" &&
                  item.url.startsWith("https://") &&
                  typeof item.prompt === "string" &&
                  typeof item.createdAt === "string",
              )
              .slice(0, 8)
          : [],
      );
      const savedPrep = project.contract_prep as { startedAt?: unknown; note?: unknown } | null;
      setContractPrep(
        savedPrep && typeof savedPrep.startedAt === "string"
          ? {
              startedAt: savedPrep.startedAt,
              note: typeof savedPrep.note === "string" ? savedPrep.note : "",
            }
          : null,
      );
      if (project.quick_fields) {
        setBuilderName(project.quick_fields.builderName ?? "");
        setClientName(project.quick_fields.clientName ?? "");
        setEventName(project.quick_fields.eventName ?? "");
      }
      const dims = savedConfirmed ?? {
        widthM: fp.selected.widthM,
        depthM: fp.selected.depthM,
        wallHeightM: fp.wallHeightM,
      };
      setDimWidth(String(dims.widthM));
      setDimDepth(String(dims.depthM));
      setDimHeight(String(dims.wallHeightM));
      setFlowStep("final");
      setProposal(null); // serverProjectId 효과가 서버에서 다시 로드
      setContractPrep(null);
      setClientDecision(null);
    } catch (cause) {
      setError(
        cause instanceof ExpoFootprintError
          ? footprintErrorMessage(cause.code)
          : "프로젝트를 불러오지 못했습니다.",
      );
    }
  }

  function applyCloneReflow() {
    const source = cloneProjects?.find((project) => project.id === cloneSelectedId);
    const area = Number(cloneArea);
    if (!source || !Number.isFinite(area) || area <= 0) {
      setError("복제할 프로젝트와 새 면적을 확인해 주세요.");
      return;
    }
    setError(null);
    try {
      const fp = createProvisionalFootprint(area, source.area_unit);
      setUnit(source.area_unit);
      setAreaInput(String(area));
      setFootprint(fp);
      setSelectedLabel(fp.selected.label);
      setConfirmedDims(null);
      setSelectedComponentId(null);
      setConceptImage(null);
      setServerProjectId(null); // 복제본은 새 프로젝트로 저장
      setClientDecision(null);
      setProposal(null);
      setContractPrep(null);
      const sourceScene = isExpoBoothScene(source.scene) ? source.scene : null;
      setSceneHistory(
        createSceneHistory(
          sourceScene
            ? resizeExpoScene(sourceScene, fp.selected.widthM, fp.selected.depthM)
            : createExpoScene(fp.selected.widthM, fp.selected.depthM),
        ),
      );
      if (isExpoBrandKit(source.brand)) setBrandKit(source.brand);
      if (isExpoEventInfo(source.event)) setEventInfo(source.event);
      if (source.quick_fields) {
        setBuilderName(source.quick_fields.builderName ?? "");
        setClientName(source.quick_fields.clientName ?? "");
        setEventName(source.quick_fields.eventName ?? "");
      }
      setDimWidth(String(fp.selected.widthM));
      setDimDepth(String(fp.selected.depthM));
      setDimHeight(String(fp.wallHeightM));
      setFlowStep("final");
    } catch (cause) {
      setError(
        cause instanceof ExpoFootprintError
          ? footprintErrorMessage(cause.code)
          : "면적을 확인해 주세요.",
      );
    }
  }

  const displayFootprint = useMemo(() => {
    if (!footprint) return null;
    if (!selectedLabel || footprint.selected.label === selectedLabel) {
      return footprint;
    }
    const alternative = footprint.alternatives.find(
      (candidate) => candidate.label === selectedLabel,
    );
    if (!alternative) return footprint;
    return {
      ...footprint,
      selected: alternative,
      alternatives: [
        footprint.selected,
        ...footprint.alternatives.filter((c) => c.label !== selectedLabel),
      ],
    };
  }, [footprint, selectedLabel]);

  // 3D 진입 직후 — 컨셉 이미지를 씬에 자동 반영
  useEffect(() => {
    if (!autoApplyConcept || !displayFootprint) return;
    setAutoApplyConcept(false);
    void applyConceptToScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 1회 트리거
  }, [autoApplyConcept, displayFootprint]);

  // 견적 — 치수 확정 전엔 개념 범위, 확정 후엔 씬 기반 카탈로그 견적 (전부 allowance)
  const conceptualRange = useMemo(() => {
    if (!displayFootprint || confirmedDims) return null;
    try {
      return buildConceptualRange(displayFootprint.canonicalAreaSqm);
    } catch {
      return null;
    }
  }, [displayFootprint, confirmedDims]);

  const catalogEstimate = useMemo(() => {
    if (!confirmedDims) return null;
    try {
      return buildCatalogEstimate(scene, confirmedDims, {
        powerKw: eventInfo.powerKw,
        overrides: estimateOverrides,
      });
    } catch {
      return null;
    }
  }, [scene, confirmedDims, eventInfo.powerKw, estimateOverrides]);

  // 행사 규정 검토 — 사용자 입력값 기준 (source 명시)
  const mergedEventInfo = useMemo(
    () => ({ ...eventInfo, eventName: eventInfo.eventName || eventName }),
    [eventInfo, eventName],
  );
  const eventReviewItems = useMemo(
    () =>
      evaluateEventRules(
        mergedEventInfo,
        confirmedDims?.wallHeightM ?? displayFootprint?.wallHeightM ?? null,
      ),
    [mergedEventInfo, confirmedDims, displayFootprint],
  );

  // 제안 준비도 — 항목별 상태를 숨기지 않는다 (§3.16)
  const readiness = useMemo(
    () =>
      displayFootprint
        ? evaluateProposalReadiness({
            hasFootprint: true,
            dimensionsConfirmed: Boolean(confirmedDims),
            componentCount: scene?.components.length ?? 0,
            priceStage:
              proposal && scene && catalogEstimate && !isProposalStale(proposal, scene, catalogEstimate)
                ? "contractor_proposal"
                : catalogEstimate
                  ? "catalog_estimate"
                  : conceptualRange
                    ? "conceptual_range"
                    : null,
            brandConfirmed: Boolean(brandKit),
            eventRules: {
              entered: hasEventRuleInput(mergedEventInfo),
              violation: hasEventRuleViolation(eventReviewItems),
            },
            clientDecision: clientDecision?.decision ?? null,
            officialServicesEntered: hasOfficialServicesInput(officialServices),
          })
        : null,
    [displayFootprint, confirmedDims, scene, catalogEstimate, conceptualRange, brandKit, mergedEventInfo, eventReviewItems, clientDecision, officialServices, proposal],
  );

  async function importBrand() {
    if (!brandUrl.trim() || brandLoading) return;
    setBrandError(null);
    setBrandLoading(true);
    setBrandCandidates(null);
    try {
      const response = await fetch("/api/expo/brand-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: brandUrl.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        candidates?: ExpoBrandCandidates;
        error?: string;
      };
      if (response.ok && payload.candidates) {
        setBrandCandidates(payload.candidates);
        setBrandLogoPick(payload.candidates.logoCandidates[0] ?? null);
        setBrandColorPick(payload.candidates.colorCandidates[0] ?? null);
      } else if (response.status === 401) {
        setBrandError("로그인 후 이용할 수 있습니다.");
      } else if (payload.error === "UNSAFE_URL") {
        setBrandError("주소를 확인해 주세요 (https 공개 사이트만 지원).");
      } else {
        setBrandError("브랜드 정보를 가져오지 못했습니다. 주소를 확인해 주세요.");
      }
    } catch {
      setBrandError("네트워크 오류 — 잠시 후 다시 시도해 주세요.");
    } finally {
      setBrandLoading(false);
    }
  }

  async function applyBrand() {
    if (!brandCandidates || brandLoading) return;
    setBrandLoading(true);
    // 로고는 우리 스토리지로 재호스팅 (3D 데칼 CORS + 원본 변경 대비 스냅샷).
    // 실패하면 원본 URL 유지 — 데칼만 생략되고 킷은 살아 있다.
    let logoUrl = brandLogoPick;
    if (brandLogoPick) {
      try {
        const response = await fetch("/api/expo/brand-logo-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoUrl: brandLogoPick }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          hostedLogoUrl?: string;
        };
        if (response.ok && payload.hostedLogoUrl) {
          logoUrl = payload.hostedLogoUrl;
        }
      } catch {
        // 재호스팅 실패는 치명적이지 않음
      }
    }
    setBrandKit({
      name: brandCandidates.siteName ?? brandCandidates.title,
      logoUrl,
      colorHex: brandColorPick,
      sourceUrl: brandCandidates.sourceUrl,
      retrievedAt: brandCandidates.retrievedAt,
      rightsConfirmed: true,
    });
    setBrandCandidates(null);
    setBrandLoading(false);
  }

  async function applyConceptToScene() {
    if (!conceptImage || !conceptImage.startsWith("https://") || applyConceptState === "loading") {
      return;
    }
    setApplyConceptState("loading");
    try {
      const response = await fetch("/api/expo/apply-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: conceptImage }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        palette?: string[];
        components?: Array<{ catalogId: string; count: number }>;
      };
      if (!response.ok) {
        setApplyConceptState("error");
        return;
      }
      setConceptWallTexture(conceptImage);
      if (payload.palette?.[0] && /^#[0-9a-f]{6}$/i.test(payload.palette[0])) {
        setConceptAccent(payload.palette[0]);
      }
      const suggestions = [...(payload.components ?? [])];
      if (!suggestions.some((entry) => entry.catalogId === "graphic_wall")) {
        // 텍스처를 입힐 벽이 없으면 백월 1장 제안에 포함
        suggestions.unshift({ catalogId: "graphic_wall", count: 1 });
      }
      setSceneHistory((history) =>
        history.present
          ? applySceneChange(
              history,
              applyConceptSuggestions(
                history.present,
                suggestions,
                `ai_${Date.now().toString(36)}`,
              ),
            )
          : history,
      );
      setApplyConceptState("idle");
    } catch {
      setApplyConceptState("error");
    }
  }

  async function generateConcept() {
    if (conceptLoading) return;
    setConceptError(null);
    setConceptLoading(true);
    try {
      let dims: { widthM: number; depthM: number; wallHeightM: number; boothType: ExpoBoothType };
      if (confirmedDims) {
        dims = confirmedDims;
      } else if (displayFootprint) {
        dims = {
          widthM: displayFootprint.selected.widthM,
          depthM: displayFootprint.selected.depthM,
          wallHeightM: displayFootprint.wallHeightM,
          boothType: displayFootprint.boothType,
        };
      } else {
        // 컨셉 단계 — 아직 3D 전이라 면적으로 임시 치수 계산
        const fp = createProvisionalFootprint(Number(areaInput), unit);
        dims = {
          widthM: fp.selected.widthM,
          depthM: fp.selected.depthM,
          wallHeightM: fp.wallHeightM,
          boothType: fp.boothType,
        };
      }
      const response = await fetch("/api/expo/concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widthM: dims.widthM,
          depthM: dims.depthM,
          wallHeightM: dims.wallHeightM,
          boothType: dims.boothType,
          dimensionsConfirmed: Boolean(confirmedDims),
          scene,
          prompt: conceptPrompt,
          brandColorHex: brandKit?.colorHex ?? null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        imageUrl?: string;
        error?: string;
      };
      if (response.ok && payload.imageUrl) {
        setConceptImage(payload.imageUrl);
        if (payload.imageUrl.startsWith("https://")) {
          const entry = {
            url: payload.imageUrl,
            prompt: conceptPrompt,
            createdAt: new Date().toISOString(),
          };
          setConceptGallery((gallery) => [entry, ...gallery].slice(0, 8));
        }
      } else if (response.status === 401) {
        setConceptError("로그인 후 이용할 수 있습니다. (테스트 기간 무료)");
      } else if (response.status === 402) {
        setConceptError("토큰이 부족합니다 — 우측 상단에서 충전해 주세요.");
      } else if (response.status === 503) {
        setConceptError("AI 엔진이 아직 이 환경에 설정되지 않았습니다.");
      } else {
        setConceptError("컨셉 생성에 실패했습니다. 사용한 토큰은 자동 환불됩니다.");
      }
    } catch {
      setConceptError("네트워크 오류 — 잠시 후 다시 시도해 주세요.");
    } finally {
      setConceptLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white px-4 pb-8 sm:px-6"
      style={{
        // 독립 iOS 셸(kr.inpick.expo)의 노치/상태바 안전영역 대응
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
      }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs font-bold tracking-[0.2em] text-blue-600">
          INPICK EXPO
        </p>
        <h1 className="mt-2 text-2xl font-bold text-black sm:text-3xl">
          부스 면적으로 시작하세요
        </h1>
        <p className="mt-2 text-sm leading-6 text-black/60">
          면적만 입력하면 임시 3D 부스 셸을 바로 확인할 수 있습니다. 실제
          치수·오픈면·높이는 이후 단계에서 확정하며, 확정 전 결과는 모두
          &ldquo;가정&rdquo;으로 표시됩니다.
        </p>

        <nav aria-label="플로우 단계" className="mt-4 flex gap-1 overflow-x-auto pb-1">
          {FLOW_STEPS.map((step) => {
            const needsBooth = step.id === "model" || step.id === "print" || step.id === "final";
            const enabled = !needsBooth || Boolean(displayFootprint);
            return (
              <button
                key={step.id}
                type="button"
                disabled={!enabled}
                aria-current={flowStep === step.id ? "step" : undefined}
                onClick={() => setFlowStep(step.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                  flowStep === step.id
                    ? "bg-blue-600 text-white"
                    : enabled
                      ? "bg-white text-black/60 border border-black/10 hover:border-blue-300"
                      : "bg-zinc-100 text-black/30 cursor-not-allowed"
                }`}
              >
                {step.label}
              </button>
            );
          })}
        </nav>

        {flowStep === "concept" && (
          <>
        {/* 시작 방식 카드 (§7.1) */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setStartMode("quick_area")}
            aria-pressed={startMode === "quick_area"}
            className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition ${
              startMode === "quick_area"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-black/15 bg-white text-black/70 hover:border-blue-300"
            }`}
          >
            Quick Area
          </button>
          <button
            type="button"
            onClick={() => setStartMode("builder_kit")}
            aria-pressed={startMode === "builder_kit"}
            className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition ${
              startMode === "builder_kit"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-black/15 bg-white text-black/70 hover:border-blue-300"
            }`}
          >
            Builder Kit
          </button>
          <button
            type="button"
            onClick={() => setStartMode("clone_reflow")}
            aria-pressed={startMode === "clone_reflow"}
            className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition ${
              startMode === "clone_reflow"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-black/15 bg-white text-black/70 hover:border-blue-300"
            }`}
          >
            Clone & Reflow
          </button>
        </div>

        {startMode === "quick_area" ? (
          <form
            onSubmit={handleSubmit}
            className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
            noValidate
          >
            <label htmlFor="expo-area" className="block text-sm font-semibold text-black">
              부스 면적
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="expo-area"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.1"
                required
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                placeholder={unit === "sqm" ? "예: 18" : "예: 200"}
                className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <div role="group" aria-label="단위" className="flex overflow-hidden rounded-xl border border-black/15">
                {(["sqm", "sqft"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    aria-pressed={unit === u}
                    className={`px-3 text-sm font-bold ${
                      unit === u ? "bg-blue-600 text-white" : "bg-white text-black/60"
                    }`}
                  >
                    {u === "sqm" ? "㎡" : "ft²"}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-base font-bold text-white transition hover:opacity-95"
            >
              다음 — 컨셉 프롬프트 입력
            </button>
          </form>
        ) : startMode === "clone_reflow" ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            {cloneState === "signed_out" ? (
              <p className="text-sm text-black/60">
                로그인하면 저장된 프로젝트를 복제해 새 면적으로 리플로우할 수
                있습니다.
              </p>
            ) : cloneState === "loading" ? (
              <p className="text-sm text-black/50">저장된 프로젝트 불러오는 중…</p>
            ) : cloneState === "error" ? (
              <p className="text-sm text-red-600">
                프로젝트 목록을 불러오지 못했습니다 — 잠시 후 다시 시도해
                주세요.
              </p>
            ) : cloneProjects && cloneProjects.length === 0 ? (
              <p className="text-sm text-black/60">
                저장된 프로젝트가 없습니다 — Quick Area로 먼저 부스를 만들면
                자동 저장됩니다.
              </p>
            ) : (
              <>
                <p className="text-sm font-bold text-black">
                  복제할 프로젝트 선택
                </p>
                <ul className="mt-2 space-y-1.5">
                  {(cloneProjects ?? []).slice(0, 5).map((project) => (
                    <li key={project.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setCloneSelectedId(project.id);
                          setCloneArea(String(project.area_input));
                        }}
                        aria-pressed={cloneSelectedId === project.id}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                          cloneSelectedId === project.id
                            ? "border-blue-600 bg-blue-50"
                            : "border-black/10 bg-white hover:border-blue-300"
                        }`}
                      >
                        <span className="font-semibold text-black/80">
                          {project.title}
                        </span>
                        <span className="ml-2 text-xs text-black/45">
                          {project.area_input}
                          {project.area_unit === "sqm" ? "㎡" : "ft²"} ·{" "}
                          {new Date(project.updated_at).toLocaleDateString("ko-KR")}
                        </span>
                      </button>
                      {cloneSelectedId === project.id && (
                        <button
                          type="button"
                          onClick={() => resumeProject(project)}
                          className="mt-1 w-full rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100"
                        >
                          이 프로젝트 이어하기 (복제 아님 — 같은 프로젝트로 저장)
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <input
                    id="expo-clone-area"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="0.1"
                    value={cloneArea}
                    onChange={(e) => setCloneArea(e.target.value)}
                    placeholder="새 면적"
                    aria-label="새 면적"
                    className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    type="button"
                    onClick={applyCloneReflow}
                    className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:opacity-95"
                  >
                    복제 & 리플로우
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-black/40">
                  배치·브랜드·행사 규정을 가져와 새 경계에 맞게 재클램프합니다.
                  치수 확정과 컨셉 이미지는 초기화되며 새 프로젝트로 저장됩니다.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {BUILDER_KITS.map((kit) => (
              <button
                key={kit.id}
                type="button"
                onClick={() => applyKit(kit)}
                className={`rounded-2xl border p-4 text-left transition ${
                  footprint && Number(areaInput) === kit.areaSqm
                    ? "border-blue-600 bg-blue-50"
                    : "border-black/10 bg-white hover:border-blue-300"
                }`}
              >
                <p className="text-sm font-bold text-black">{kit.label}</p>
                <p className="mt-1 text-xs text-black/55">{kit.description}</p>
              </button>
            ))}
          </div>
        )}


            {/* AI 컨셉 — 프롬프트로 부스 컨셉 렌더 (GPT Image 2, 컨셉 전용) */}
            <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-black">AI 컨셉 렌더</p>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                  GPT Image 2 · 테스트 무료
                </span>
              </div>
              <p className="mt-1 text-xs text-black/50">
                원하는 분위기를 적으면 현재 부스 구성을 반영한 컨셉 이미지를
                만듭니다. 구조·치수의 기준은 항상 3D 씬이며, 로고·브랜드는
                이후 데칼 단계에서 정확히 적용됩니다.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  id="expo-concept-prompt"
                  type="text"
                  value={conceptPrompt}
                  maxLength={500}
                  onChange={(e) => setConceptPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") generateConcept();
                  }}
                  placeholder="예: 화이트+우드 톤 미니멀 테크 부스, 밝은 조명"
                  className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                />
                <button
                  type="button"
                  onClick={generateConcept}
                  disabled={conceptLoading}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {conceptLoading ? "생성 중…" : conceptImage ? "재생성" : "컨셉 생성"}
                </button>
              </div>
              {conceptLoading && (
                <p role="status" className="mt-2 flex items-center gap-2 text-xs font-medium text-violet-700">
                  <span
                    aria-hidden
                    className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700"
                  />
                  컨셉 이미지를 그리는 중입니다 — 최대 1~2분 걸립니다.
                </p>
              )}
              {conceptError && (
                <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {conceptError}
                </p>
              )}
              {conceptGallery.length > 1 && !conceptLoading && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {conceptGallery.map((item) => (
                    <button
                      key={item.url}
                      type="button"
                      onClick={() => setConceptImage(item.url)}
                      title={item.prompt || "컨셉 이미지"}
                      aria-pressed={conceptImage === item.url}
                      className={`relative shrink-0 overflow-hidden rounded-lg border-2 ${
                        conceptImage === item.url
                          ? "border-violet-600"
                          : "border-black/10"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- 갤러리 썸네일 */}
                      <img
                        src={item.url}
                        alt="컨셉 썸네일"
                        className="h-14 w-20 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              {conceptImage && !conceptLoading && (
                <div className="relative mt-3 overflow-hidden rounded-xl border border-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL 컨셉 이미지 */}
                  <img
                    src={conceptImage}
                    alt="AI 부스 컨셉 이미지"
                    className="w-full"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white">
                    AI 컨셉 — 시공 기준 아님
                  </span>
                </div>
              )}
              {conceptImage && conceptImage.startsWith("https://") && !conceptLoading && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={applyConceptToScene}
                    disabled={applyConceptState === "loading"}
                    className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                  >
                    {applyConceptState === "loading"
                      ? "이미지 분석 중…"
                      : "이 이미지를 3D에 반영"}
                  </button>
                  <span className="text-[10px] text-black/40">
                    벽 텍스처·팔레트·구성 제안 — 되돌리기로 취소 가능
                  </span>
                </div>
              )}
              {applyConceptState === "error" && (
                <p role="alert" className="mt-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  이미지 분석에 실패했습니다 — 잠시 후 다시 시도해 주세요.
                </p>
              )}
            </div>

            {displayFootprint === null && (
              <button
                type="button"
                onClick={createBoothFromPrompt}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-base font-bold text-white hover:opacity-95"
              >
                이 컨셉으로 3D 배치하기 →
              </button>
            )}
            {displayFootprint !== null && (
              <button
                type="button"
                onClick={() => {
                  if (conceptImage && conceptImage.startsWith("https://")) {
                    setAutoApplyConcept(true);
                  }
                  setFlowStep("model");
                }}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-base font-bold text-white hover:opacity-95"
              >
                3D 배치로 이동 →
              </button>
            )}
            <p className="mt-1.5 text-center text-[11px] text-black/40">
              이미지 없이도 3D 배치로 넘어갈 수 있습니다 — 부스는 무벽(4면
              오픈)으로 시작합니다.
            </p>
          </>
        )}

        {flowStep === "company" && (
          <>
            <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-black">행사 규정</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    hasEventRuleViolation(eventReviewItems)
                      ? "bg-red-50 text-red-700"
                      : hasEventRuleInput(mergedEventInfo)
                        ? "bg-green-50 text-green-700"
                        : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {hasEventRuleViolation(eventReviewItems)
                    ? "위반 있음"
                    : hasEventRuleInput(mergedEventInfo)
                      ? "매뉴얼 기준 입력됨"
                      : "미입력"}
                </span>
              </div>
              <p className="mt-1 text-xs text-black/50">
                행사 매뉴얼의 값을 직접 입력하세요 — 입력된 값만 검토 기준이
                되며, 일반 규칙을 가정하지 않습니다.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["expo-event-venue", "장소", "text", eventInfo.venue, (v: string) => setEventInfo((s) => ({ ...s, venue: v }))],
                    ["expo-event-booth", "부스 번호", "text", eventInfo.boothNumber, (v: string) => setEventInfo((s) => ({ ...s, boothNumber: v }))],
                  ] as const
                ).map(([id, label, type, value, setter]) => (
                  <div key={id}>
                    <label htmlFor={id} className="block text-[11px] font-semibold text-black/60">
                      {label}
                    </label>
                    <input
                      id={id}
                      type={type}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-black/15 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                ))}
                <div>
                  <label htmlFor="expo-event-maxh" className="block text-[11px] font-semibold text-black/60">
                    허용 높이 (m)
                  </label>
                  <input
                    id="expo-event-maxh"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={eventInfo.maxHeightM ?? ""}
                    onChange={(e) =>
                      setEventInfo((s) => ({
                        ...s,
                        maxHeightM: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className="mt-0.5 w-full rounded-lg border border-black/15 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label htmlFor="expo-event-power" className="block text-[11px] font-semibold text-black/60">
                    전기 용량 (kW)
                  </label>
                  <input
                    id="expo-event-power"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    value={eventInfo.powerKw ?? ""}
                    onChange={(e) =>
                      setEventInfo((s) => ({
                        ...s,
                        powerKw: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className="mt-0.5 w-full rounded-lg border border-black/15 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div className="mt-2">
                <label htmlFor="expo-event-source" className="block text-[11px] font-semibold text-black/60">
                  출처 메모 (예: 매뉴얼 p.12)
                </label>
                <input
                  id="expo-event-source"
                  type="text"
                  value={eventInfo.sourceNote}
                  onChange={(e) => setEventInfo((s) => ({ ...s, sourceNote: e.target.value }))}
                  className="mt-0.5 w-full rounded-lg border border-black/15 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mt-3 border-t border-black/[0.06] pt-2.5">
                <p className="text-xs font-bold text-black/70">
                  공식 서비스 신청 현황 (주최측)
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                  {(
                    [
                      ["expo-svc-power", "전기 신청함", officialServices.powerApplied, (v: boolean) => setOfficialServices((s) => ({ ...s, powerApplied: v }))],
                      ["expo-svc-rig", "리깅 신청함", officialServices.riggingApplied, (v: boolean) => setOfficialServices((s) => ({ ...s, riggingApplied: v }))],
                      ["expo-svc-net", "인터넷 신청함", officialServices.internetApplied, (v: boolean) => setOfficialServices((s) => ({ ...s, internetApplied: v }))],
                    ] as const
                  ).map(([id, label, checked, setter]) => (
                    <label key={id} htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-black/70">
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setter(e.target.checked)}
                        className="h-4 w-4 rounded border-black/20 accent-blue-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  value={officialServices.note}
                  onChange={(e) =>
                    setOfficialServices((s) => ({ ...s, note: e.target.value }))
                  }
                  placeholder="신청 메모 (예: 전기 3kW 6/30 신청 완료)"
                  aria-label="공식 서비스 신청 메모"
                  className="mt-2 w-full rounded-lg border border-black/15 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {eventReviewItems.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {eventReviewItems.map((item) => (
                    <li
                      key={item.code}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                        item.severity === "violation"
                          ? "bg-red-50 text-red-700"
                          : item.severity === "warning"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-green-50 text-green-700"
                      }`}
                    >
                      {item.severity === "violation" ? "✕ " : item.severity === "warning" ? "⚠ " : "✓ "}
                      {item.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* 브랜드 — 후보는 자동 확정하지 않는다 (§3.2) */}
            <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-black">브랜드</p>
                {brandKit ? (
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">
                    적용됨
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-500">
                    선택
                  </span>
                )}
              </div>

              {brandKit ? (
                <div className="mt-2 flex items-center gap-3">
                  {brandKit.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- 외부 브랜드 로고
                    <img
                      src={brandKit.logoUrl}
                      alt="브랜드 로고"
                      className="h-10 w-10 rounded-lg border border-black/10 object-contain"
                    />
                  )}
                  {brandKit.colorHex && (
                    <span
                      aria-label={`브랜드 컬러 ${brandKit.colorHex}`}
                      className="inline-block h-6 w-6 rounded-full border border-black/15"
                      style={{ backgroundColor: brandKit.colorHex }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-black/80">
                      {brandKit.name ?? "브랜드"}
                    </p>
                    <p className="text-[10px] text-black/40">
                      그래픽 월에 로고 데칼·브랜드 컬러 적용됨
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBrandKit(null)}
                    className="shrink-0 rounded-lg border border-black/15 px-2.5 py-1.5 text-xs font-semibold text-black/60 hover:bg-zinc-50"
                  >
                    해제
                  </button>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-xs text-black/50">
                    회사 웹사이트 주소를 입력하면 로고·브랜드 컬러 후보를
                    가져옵니다. 후보는 자동 적용되지 않습니다.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="expo-brand-url"
                      type="url"
                      value={brandUrl}
                      onChange={(e) => setBrandUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") importBrand();
                      }}
                      placeholder="예: www.회사도메인.com"
                      className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                    <button
                      type="button"
                      onClick={importBrand}
                      disabled={brandLoading}
                      className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {brandLoading && !brandCandidates ? "가져오는 중…" : "가져오기"}
                    </button>
                  </div>
                  {brandError && (
                    <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      {brandError}
                    </p>
                  )}
                  {brandCandidates && (
                    <div className="mt-3 rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs font-bold text-black/70">
                        {brandCandidates.siteName ?? brandCandidates.title ?? "후보"}
                      </p>
                      {brandCandidates.logoCandidates.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {brandCandidates.logoCandidates.map((logo) => (
                            <button
                              key={logo}
                              type="button"
                              aria-pressed={brandLogoPick === logo}
                              onClick={() =>
                                setBrandLogoPick(
                                  brandLogoPick === logo ? null : logo,
                                )
                              }
                              className={`rounded-lg border-2 bg-white p-1 ${
                                brandLogoPick === logo
                                  ? "border-blue-600"
                                  : "border-black/10"
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- 외부 로고 후보 */}
                              <img
                                src={logo}
                                alt="로고 후보"
                                className="h-9 w-9 object-contain"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                      {brandCandidates.colorCandidates.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {brandCandidates.colorCandidates.map((color) => (
                            <button
                              key={color}
                              type="button"
                              aria-label={`컬러 ${color}`}
                              aria-pressed={brandColorPick === color}
                              onClick={() =>
                                setBrandColorPick(
                                  brandColorPick === color ? null : color,
                                )
                              }
                              className={`h-7 w-7 rounded-full border-2 ${
                                brandColorPick === color
                                  ? "border-blue-600"
                                  : "border-black/10"
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={applyBrand}
                        disabled={!brandLogoPick && !brandColorPick}
                        className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {brandLoading
                          ? "적용 중…"
                          : "이 브랜드 사용 — 로고·컬러 사용 권한 보유를 확인합니다"}
                      </button>
                      <p className="mt-1.5 text-[10px] leading-4 text-black/40">
                        출처: {brandCandidates.sourceUrl} · 수집{" "}
                        {new Date(brandCandidates.retrievedAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
        <details
          className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
          open={detailsOpen}
          onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-sm font-bold text-blue-600">
            선택 정보 (업체·고객사·행사)
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["expo-builder", "시공사", builderName, setBuilderName],
                ["expo-client", "고객사", clientName, setClientName],
                ["expo-event", "행사명", eventName, setEventName],
              ] as const
            ).map(([id, label, value, setter]) => (
              <div key={id}>
                <label htmlFor={id} className="block text-xs font-semibold text-black/60">
                  {label}
                </label>
                <input
                  id={id}
                  type="text"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            ))}
          </div>
        </details>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setFlowStep("model")}
                className="rounded-xl border border-black/15 px-4 py-3 text-sm font-bold text-black/60 hover:bg-zinc-50"
              >
                ← 3D 배치
              </button>
              <button
                type="button"
                onClick={() => setFlowStep("print")}
                className="min-w-0 flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white hover:opacity-95"
              >
                다음 — 인쇄물 컨셉 →
              </button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {restored && !error && (
          <p role="status" className="mt-3 text-xs font-medium text-black/45">
            이전 작성 내용을 이 기기에서 복구했습니다. (서버 저장은 준비 중 —
            현재는 이 기기에만 임시 저장됩니다)
          </p>
        )}

        {flowStep === "print" && (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-black">인쇄물 컨셉</p>
            <p className="mt-1 text-xs text-black/50">
              부스에 부착할 인쇄물(백월 그래픽·라이트박스·사이니지)별 컨셉
              확정과 개별 이미지 생성 — 다음 업데이트에서 열립니다.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setFlowStep("company")}
                className="rounded-xl border border-black/15 px-4 py-3 text-sm font-bold text-black/60 hover:bg-zinc-50"
              >
                ← 기업정보
              </button>
              <button
                type="button"
                onClick={() => setFlowStep("final")}
                className="min-w-0 flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white hover:opacity-95"
              >
                확정하고 견적 보기 →
              </button>
            </div>
          </div>
        )}

        {(flowStep === "model" || flowStep === "final") && displayFootprint && (
          <section aria-label="3D 부스 셸" className="mt-5">
            <button
              type="button"
              onClick={() =>
                setFlowStep(flowStep === "final" ? "print" : "concept")
              }
              className="mb-2 rounded-lg border border-black/15 px-3 py-1.5 text-[11px] font-bold text-black/60 hover:bg-zinc-50"
            >
              {flowStep === "final" ? "← 인쇄물" : "← 컨셉으로"}
            </button>

            <BoothShell3D
              footprint={
                confirmedDims
                  ? {
                      ...displayFootprint,
                      selected: {
                        widthM: confirmedDims.widthM,
                        depthM: confirmedDims.depthM,
                        areaSqm: confirmedDims.areaSqm,
                        standardMatch: false,
                        label: `${confirmedDims.widthM}m × ${confirmedDims.depthM}m`,
                      },
                      boothType: confirmedDims.boothType,
                      openSides: confirmedDims.openSides,
                      wallHeightM: confirmedDims.wallHeightM,
                    }
                  : displayFootprint
              }
              confirmed={Boolean(confirmedDims)}
              scene={scene}
              selectedComponentId={selectedComponentId}
              onSelectComponent={setSelectedComponentId}
              cameraPreset={cameraPreset}
              onCameraPresetChange={setCameraPreset}
              brandColorHex={brandKit?.colorHex ?? conceptAccent}
              brandLogoUrl={brandKit?.logoUrl ?? null}
              wallTextureUrl={conceptWallTexture}
            />

            {/* 컴포넌트 카탈로그 — 모든 오브젝트는 카탈로그에서만 온다 */}
            {scene && (
              <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-black">부스 구성 요소</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="되돌리기"
                      disabled={!canUndoScene(sceneHistory)}
                      onClick={() => setSceneHistory(undoScene)}
                      className="h-7 rounded-lg border border-black/15 px-2.5 text-xs font-bold text-black/70 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      ↺ 되돌리기
                    </button>
                    <button
                      type="button"
                      aria-label="다시 실행"
                      disabled={!canRedoScene(sceneHistory)}
                      onClick={() => setSceneHistory(redoScene)}
                      className="h-7 rounded-lg border border-black/15 px-2.5 text-xs font-bold text-black/70 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      ↻
                    </button>
                    <span className="text-xs text-black/45">
                      {scene.components.length}개 배치됨
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {EXPO_BASE_CATALOG.map((item) => (
                    <button
                      key={item.catalogId}
                      type="button"
                      onClick={() => {
                        const componentId = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
                        updateScene((current) =>
                          addExpoComponent(current, item.catalogId, componentId),
                        );
                        setSelectedComponentId(componentId);
                      }}
                      className="shrink-0 rounded-xl border border-black/15 px-3 py-2 text-xs font-bold text-black/70 hover:border-blue-400 hover:text-blue-700"
                    >
                      <span
                        aria-hidden
                        className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                        style={{ backgroundColor: item.color }}
                      />
                      + {item.nameKo}
                    </button>
                  ))}
                </div>

                {selectedComponentId && scene.components.some((c) => c.id === selectedComponentId) && (
                  <div className="mt-3 rounded-xl bg-blue-50 p-3">
                    <p className="text-xs font-bold text-blue-800">
                      선택됨:{" "}
                      {EXPO_BASE_CATALOG.find(
                        (i) =>
                          i.catalogId ===
                          scene.components.find((c) => c.id === selectedComponentId)?.catalogId,
                      )?.nameKo ?? "구성 요소"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          ["←", -0.5, 0, "왼쪽으로 0.5m"],
                          ["→", 0.5, 0, "오른쪽으로 0.5m"],
                          ["↑", 0, -0.5, "안쪽으로 0.5m"],
                          ["↓", 0, 0.5, "앞쪽으로 0.5m"],
                        ] as const
                      ).map(([label, dx, dz, aria]) => (
                        <button
                          key={aria}
                          type="button"
                          aria-label={aria}
                          onClick={() =>
                            updateScene((current) =>
                              moveExpoComponent(current, selectedComponentId, dx, dz),
                            )
                          }
                          className="h-9 w-9 rounded-lg border border-blue-200 bg-white text-sm font-bold text-blue-700 hover:bg-blue-100"
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          updateScene((current) =>
                            rotateExpoComponent(current, selectedComponentId),
                          )
                        }
                        className="h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-blue-700 hover:bg-blue-100"
                      >
                        90° 회전
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateScene((current) =>
                            removeExpoComponent(current, selectedComponentId),
                          );
                          setSelectedComponentId(null);
                        }}
                        className="h-9 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      {(
                        [
                          ["expo-size-w", "가로 (m)", sizeDraftW, setSizeDraftW],
                          ["expo-size-d", "세로 (m)", sizeDraftD, setSizeDraftD],
                        ] as const
                      ).map(([id, label, value, setter]) => (
                        <div key={id}>
                          <label htmlFor={id} className="block text-[10px] font-semibold text-blue-800/70">
                            {label}
                          </label>
                          <input
                            id={id}
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min="0.1"
                            max="20"
                            value={value}
                            onChange={(e) => setter(e.target.value)}
                            className="mt-0.5 w-20 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const w = Number(sizeDraftW);
                          const d = Number(sizeDraftD);
                          if (!Number.isFinite(w) || !Number.isFinite(d) || w <= 0 || d <= 0) return;
                          updateScene((current) =>
                            resizeExpoComponent(current, selectedComponentId, w, d),
                          );
                        }}
                        className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        크기 적용
                      </button>
                    </div>
                  </div>
                )}

                {scene && evaluateExpoScene(scene).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {evaluateExpoScene(scene).map((warning, index) => (
                      <li
                        key={`${warning.code}-${index}`}
                        className="rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800"
                      >
                        {warning.code === "components_overlap"
                          ? "⚠ 구성 요소가 서로 겹칩니다 — 위치를 조정해 주세요."
                          : "⚠ 구성 요소가 벽면에 붙어 있습니다 — 통로/설치 여유를 확인하세요."}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-black">
                  임시 치수 후보
                </p>
                <span className="text-xs font-semibold text-black/45">
                  {displayFootprint.canonicalAreaSqm}㎡ 기준
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[displayFootprint.selected, ...displayFootprint.alternatives].map(
                  (candidate) => (
                    <button
                      key={candidate.label}
                      type="button"
                      onClick={() => setSelectedLabel(candidate.label)}
                      aria-pressed={candidate.label === displayFootprint.selected.label}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        candidate.label === displayFootprint.selected.label
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-black/15 bg-white text-black/65"
                      }`}
                    >
                      {candidate.label}
                      {candidate.standardMatch ? "" : " (비표준)"}
                    </button>
                  ),
                )}
              </div>
              <ul className="mt-3 space-y-1 text-xs leading-5 text-black/55">
                <li>
                  · 부스 타입 <b>아일랜드(4면 오픈·무벽)</b>, 벽 높이{" "}
                  <b>{displayFootprint.wallHeightM}m</b>는 기본 가정입니다.
                </li>
                <li>
                  · 실제 폭·깊이·오픈면·높이 제한은 행사 매뉴얼 기준으로
                  확정해야 견적 단계로 진행됩니다.
                </li>
              </ul>
            </div>

            {/* 치수 확정 — provisional 해제 단계 */}
            <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              {confirmedDims ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-green-700">
                      치수 확정됨 — {confirmedDims.widthM}m ×{" "}
                      {confirmedDims.depthM}m ·{" "}
                      {BOOTH_TYPE_LABELS[confirmedDims.boothType]} · 높이{" "}
                      {confirmedDims.wallHeightM}m
                    </p>
                    <p className="mt-0.5 text-xs text-black/50">
                      확정 면적 {confirmedDims.areaSqm}㎡ — 이 값이 이후
                      견적·BOM의 기준이 됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmedDims(null)}
                    className="shrink-0 rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold text-black/70 hover:bg-zinc-50"
                  >
                    수정
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setConfirmError(null);
                    try {
                      const next = confirmExpoDimensions(
                        {
                          widthM: Number(dimWidth),
                          depthM: Number(dimDepth),
                          boothType: dimBoothType,
                          wallHeightM: Number(dimHeight),
                        },
                        new Date().toISOString(),
                      );
                      setSceneHistory((history) =>
                        resetSceneHistory(
                          history,
                          history.present
                            ? resizeExpoScene(history.present, next.widthM, next.depthM)
                            : createExpoScene(next.widthM, next.depthM),
                        ),
                      );
                      setConfirmedDims(next);

                    } catch (cause) {
                      setConfirmError(
                        cause instanceof ExpoDimensionError
                          ? dimensionErrorMessage(cause.code)
                          : "치수를 확인해 주세요.",
                      );
                    }
                  }}
                  noValidate
                >
                  <p className="text-sm font-bold text-black">치수 확정</p>
                  <p className="mt-0.5 text-xs text-black/50">
                    행사 매뉴얼/실측 기준의 실제 값을 입력하면 가정 상태가
                    해제됩니다.
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(
                      [
                        ["expo-dim-width", "폭 (m)", dimWidth, setDimWidth],
                        ["expo-dim-depth", "깊이 (m)", dimDepth, setDimDepth],
                        ["expo-dim-height", "벽 높이 (m)", dimHeight, setDimHeight],
                      ] as const
                    ).map(([id, label, value, setter]) => (
                      <div key={id}>
                        <label htmlFor={id} className="block text-[11px] font-semibold text-black/60">
                          {label}
                        </label>
                        <input
                          id={id}
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          className="mt-0.5 w-full rounded-lg border border-black/15 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <label htmlFor="expo-dim-type" className="sr-only">
                      부스 타입
                    </label>
                    <select
                      id="expo-dim-type"
                      value={dimBoothType}
                      onChange={(e) => setDimBoothType(e.target.value as ExpoBoothType)}
                      className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm"
                    >
                      {(Object.keys(BOOTH_TYPE_LABELS) as ExpoBoothType[]).map(
                        (type) => (
                          <option key={type} value={type}>
                            {BOOTH_TYPE_LABELS[type]}
                          </option>
                        ),
                      )}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white"
                    >
                      치수 확정
                    </button>
                  </div>
                  {confirmError && (
                    <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      {confirmError}
                    </p>
                  )}
                </form>
              )}
            </div>

            {flowStep === "model" && (
              <button
                type="button"
                onClick={() => setFlowStep("company")}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-base font-bold text-white hover:opacity-95"
              >
                배치 완료 — 기업정보 입력 →
              </button>
            )}

            {flowStep === "final" && (
              <>
            {(conceptualRange || catalogEstimate) && (
              <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-black">예상 금액</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      catalogEstimate
                        ? "bg-blue-50 text-blue-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {catalogEstimate
                      ? catalogEstimate.quotedLineCount > 0
                        ? `카탈로그 견적 · 검토 단가 ${catalogEstimate.quotedLineCount}/${catalogEstimate.directLineCount}`
                        : "카탈로그 견적 · 가정 단가"
                      : "개념 범위 · 치수 확정 전"}
                  </span>
                </div>

                {catalogEstimate ? (
                  <>
                    <ul className="mt-3 divide-y divide-black/[0.06]">
                      {catalogEstimate.lines.map((line) => (
                        <li key={line.id} className="py-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setOverrideEditId(
                                overrideEditId === line.id ? null : line.id,
                              );
                              setOverrideDraft(String(line.unitAmountKrw));
                            }}
                            className="flex w-full items-baseline justify-between gap-3 text-left"
                            title="단가 검토 (탭하여 편집)"
                          >
                            <span className="min-w-0 flex-1 truncate font-medium text-black/70">
                              {line.label}
                              <span className="ml-1.5 text-black/40">
                                {line.unit === "sqm"
                                  ? `${line.quantity}㎡`
                                  : line.unit === "ea"
                                    ? `${line.quantity}개`
                                    : line.unit === "kw"
                                      ? `${line.quantity}kW`
                                      : "1식"}
                              </span>
                              {line.source === "quoted" && (
                                <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                                  {EXPO_MONEY_SOURCE_LABELS.quoted}
                                </span>
                              )}
                            </span>
                            <span className="tabular-nums font-semibold text-black/80">
                              {formatKrw(line.amountKrw)}
                            </span>
                          </button>
                          {overrideEditId === line.id && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1000"
                                value={overrideDraft}
                                onChange={(e) => setOverrideDraft(e.target.value)}
                                aria-label={`${line.label} 단가`}
                                className="w-32 rounded-lg border border-blue-300 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-200"
                              />
                              <span className="text-[10px] text-black/40">
                                원/{line.unit === "sqm" ? "㎡" : line.unit === "ea" ? "개" : line.unit === "kw" ? "kW" : "식"}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const value = Number(overrideDraft);
                                  if (Number.isFinite(value) && value >= 0) {
                                    setEstimateOverrides((prev) => ({
                                      ...prev,
                                      [line.id]: { unitAmountKrw: value },
                                    }));
                                  }
                                  setOverrideEditId(null);
                                }}
                                className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-bold text-white"
                              >
                                검토 단가 적용
                              </button>
                              {estimateOverrides[line.id] && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEstimateOverrides((prev) => {
                                      const next = { ...prev };
                                      delete next[line.id];
                                      return next;
                                    });
                                    setOverrideEditId(null);
                                  }}
                                  className="rounded-lg border border-black/15 px-2.5 py-1.5 text-[10px] font-bold text-black/60"
                                >
                                  가정으로 되돌리기
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                      {catalogEstimate.markupLines.map((line) => (
                        <li
                          key={line.id}
                          className="flex items-baseline justify-between gap-3 py-1.5 text-xs"
                        >
                          <span className="min-w-0 flex-1 truncate font-medium text-black/70">
                            {line.label}
                            <span className="ml-1.5 text-black/40">
                              {line.quantity}%
                            </span>
                          </span>
                          <span className="tabular-nums font-semibold text-black/80">
                            {formatKrw(line.amountKrw)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-baseline justify-between border-t border-black/10 pt-2">
                      <span className="text-sm font-bold text-black">
                        합계 (부가세 별도)
                      </span>
                      <span className="tabular-nums text-lg font-bold text-blue-700">
                        {formatKrw(catalogEstimate.totalKrw)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={downloadEstimateCsv}
                        className="rounded-lg border border-black/15 px-3 py-1.5 text-[11px] font-bold text-black/70 hover:bg-zinc-50"
                      >
                        BOM/견적 CSV 내보내기
                      </button>
                      {(() => {
                        const gate = canPublishProposal(catalogEstimate, Boolean(confirmedDims));
                        const fresh =
                          proposal && scene && catalogEstimate
                            ? !isProposalStale(proposal, scene, catalogEstimate)
                            : false;
                        if (fresh && proposal) {
                          return (
                            <span className="rounded-lg bg-green-50 px-3 py-1.5 text-[11px] font-bold text-green-700">
                              제안 발행됨 ·{" "}
                              {new Date(proposal.publishedAt).toLocaleDateString("ko-KR")}
                            </span>
                          );
                        }
                        return (
                          <button
                            type="button"
                            onClick={publishProposal}
                            disabled={!gate.ok || !serverProjectId || publishState === "loading"}
                            title={!gate.ok ? gate.detail : !serverProjectId ? "로그인·저장 후 발행할 수 있습니다" : undefined}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {publishState === "loading"
                              ? "발행 중…"
                              : proposal
                                ? "재발행 (변경 반영)"
                                : "시공사 제안 발행"}
                          </button>
                        );
                      })()}
                    </div>
                    {(() => {
                      const gate = canPublishProposal(catalogEstimate, Boolean(confirmedDims));
                      if (gate.ok) return null;
                      return (
                        <p className="mt-1 text-[10px] text-black/40">{gate.detail}</p>
                      );
                    })()}
                    {proposal && scene && catalogEstimate &&
                      isProposalStale(proposal, scene, catalogEstimate) && (
                        <p className="mt-1 rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-800">
                          발행본이 현재 상태와 다릅니다 — 변경 사항을 반영하려면
                          재발행하세요.
                        </p>
                      )}
                    {publishState === "error" && (
                      <p className="mt-1 text-[10px] font-semibold text-red-600">
                        발행 실패 — 저장 완료 후 다시 시도해 주세요.
                      </p>
                    )}
                  </>
                ) : conceptualRange ? (
                  <>
                    <p className="mt-2 tabular-nums text-xl font-bold text-black">
                      {formatKrw(conceptualRange.lowKrw)} ~{" "}
                      {formatKrw(conceptualRange.highKrw)}
                    </p>
                    <p className="mt-0.5 text-xs text-black/50">
                      가정 면적 {conceptualRange.areaSqm}㎡ 기준 — 치수를
                      확정하면 배치 기반 카탈로그 견적으로 전환됩니다.
                    </p>
                  </>
                ) : null}

                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-semibold text-black/45">
                    가정 및 제외 항목 보기
                  </summary>
                  <ul className="mt-1.5 space-y-1 text-[11px] leading-4 text-black/50">
                    {(catalogEstimate ?? conceptualRange)?.assumptions.map(
                      (assumption, index) => (
                        <li key={index}>· {assumption}</li>
                      ),
                    )}
                  </ul>
                </details>

                <button
                  type="button"
                  disabled
                  className="mt-3 w-full cursor-not-allowed rounded-xl border border-black/10 bg-zinc-50 px-4 py-2.5 text-sm font-bold text-black/35"
                >
                  시공사 견적 요청 — 준비 중
                </button>
              </div>
            )}

            {readiness && (
              <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-black">제안 준비도</p>
                  <span className="text-xs font-semibold text-black/45">
                    참고 진행률 {readinessPercent(readiness)}%
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {readiness.map((item) => (
                    <li
                      key={item.dimension}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="w-14 shrink-0 font-bold text-black/70">
                        {item.label}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${READINESS_CHIP_CLASSES[item.state]}`}
                      >
                        {EXPO_READINESS_STATE_LABELS[item.state]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-black/45">
                        {item.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {clientDecision && (
              <p
                className={`mt-2 rounded-xl px-3 py-2.5 text-xs font-bold ${
                  clientDecision.decision === "approved"
                    ? "bg-green-50 text-green-700"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                {EXPO_DECISION_LABELS[clientDecision.decision]}
                {clientDecision.comment && (
                  <span className="ml-1.5 font-medium text-black/60">
                    &ldquo;{clientDecision.comment}&rdquo;
                  </span>
                )}
                <span className="ml-1.5 font-medium text-black/40">
                  {new Date(clientDecision.decidedAt).toLocaleString("ko-KR")}
                </span>
              </p>
            )}
            {(() => {
              const fresh =
                proposal && scene && catalogEstimate
                  ? !isProposalStale(proposal, scene, catalogEstimate)
                  : false;
              if (contractPrep) {
                return (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2.5">
                    <p className="text-xs font-bold text-emerald-700">
                      계약 준비 중 —{" "}
                      {new Date(contractPrep.startedAt).toLocaleDateString("ko-KR")}{" "}
                      기록
                      <span className="ml-1.5 font-medium text-black/50">
                        (계약서·법무 검토는 별도 진행 — 상태 표시용)
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setContractPrep(null)}
                      className="shrink-0 rounded-lg border border-black/15 px-2 py-1 text-[10px] font-semibold text-black/60"
                    >
                      해제
                    </button>
                  </div>
                );
              }
              if (fresh && clientDecision?.decision === "approved") {
                return (
                  <button
                    type="button"
                    onClick={() =>
                      setContractPrep({
                        startedAt: new Date().toISOString(),
                        note: "",
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    계약 준비 시작 기록 — 발행 제안 + 고객 승인 완료됨
                  </button>
                );
              }
              return null;
            })()}
            <div className="mt-2 flex items-center justify-between gap-2">
              {serverProjectId ? (
                <button
                  type="button"
                  onClick={shareProposal}
                  disabled={shareState === "loading"}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  {shareState === "loading"
                    ? "링크 만드는 중…"
                    : shareState === "copied"
                      ? "링크 복사됨 ✓"
                      : "제안 공유 링크"}
                </button>
              ) : (
                <span />
              )}
              <p role="status" className="text-right text-[11px] font-medium text-black/40">
                {saveState === "saved"
                  ? "서버에 저장됨"
                  : saveState === "saving"
                    ? "서버 저장 중…"
                    : saveState === "signed_out"
                      ? "로그인하면 서버에 저장됩니다 (현재 이 기기에만 저장)"
                      : "이 기기에 임시 저장됨"}
              </p>
            </div>
            {shareUrl && (
              <p className="mt-1 break-all rounded-lg bg-zinc-50 px-3 py-2 text-[11px] text-black/60">
                {shareUrl}
                {shareState === "error" && " — 복사 실패, 직접 복사해 주세요"}
              </p>
            )}
              </>
            )}
          </section>
        )}

      </div>
    </main>
  );
}

function dimensionErrorMessage(code: ExpoDimensionError["code"]): string {
  switch (code) {
    case "EXPO_DIM_WIDTH_INVALID":
      return "폭은 1m~60m 사이여야 합니다.";
    case "EXPO_DIM_DEPTH_INVALID":
      return "깊이는 1m~60m 사이여야 합니다.";
    case "EXPO_DIM_HEIGHT_INVALID":
      return "벽 높이는 2m~8m 사이여야 합니다.";
    case "EXPO_DIM_BOOTH_TYPE_INVALID":
      return "부스 타입을 선택해 주세요.";
  }
}

function footprintErrorMessage(code: ExpoFootprintError["code"]): string {
  switch (code) {
    case "EXPO_AREA_NOT_A_NUMBER":
      return "면적을 숫자로 입력해 주세요.";
    case "EXPO_AREA_NOT_POSITIVE":
      return "면적은 0보다 커야 합니다.";
    case "EXPO_AREA_TOO_SMALL":
      return "최소 4㎡(약 43ft²)부터 시작할 수 있습니다.";
    case "EXPO_AREA_TOO_LARGE":
      return "1,000㎡ 이하 면적만 지원합니다. 대형 프로젝트는 문의해 주세요.";
  }
}
