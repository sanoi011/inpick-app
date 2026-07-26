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
  createExpoScene,
  evaluateExpoScene,
  isExpoBoothScene,
  moveExpoComponent,
  removeExpoComponent,
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
  buildCatalogEstimate,
  buildConceptualRange,
  formatKrw,
} from "@/lib/expo/estimate";

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

type StartMode = "quick_area" | "builder_kit";

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
  const [dimBoothType, setDimBoothType] = useState<ExpoBoothType>("inline");
  const [sceneHistory, setSceneHistory] = useState<ExpoSceneHistory>(() =>
    createSceneHistory(null),
  );
  const scene = sceneHistory.present;
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<ExpoCameraPreset>("hero");

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
        } catch {
          // 복구 실패는 새 입력으로 시작
        }
      }
      setRestored(true);
    } catch {
      // 손상된 draft는 무시
    }
  }, []);

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
      serverProjectId,
      quickFields: { builderName, clientName, eventName },
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // 저장 실패는 치명적이지 않음 — 다음 저장 시 재시도
    }
  }, [startMode, areaInput, unit, selectedLabel, confirmedDims, scene, cameraPreset, serverProjectId, builderName, clientName, eventName]);

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
  }, [footprint, confirmedDims, scene, areaInput, unit, serverProjectId, builderName, clientName, eventName]);

  function generate(areaValue: number, areaUnit: ExpoAreaUnit) {
    setError(null);
    try {
      const fp = createProvisionalFootprint(areaValue, areaUnit);
      setFootprint(fp);
      setSelectedLabel(fp.selected.label);
      setConfirmedDims(null);
      setSelectedComponentId(null);
      setSceneHistory((history) =>
        resetSceneHistory(
          history,
          history.present && history.present.components.length > 0
            ? resizeExpoScene(history.present, fp.selected.widthM, fp.selected.depthM)
            : createExpoScene(fp.selected.widthM, fp.selected.depthM),
        ),
      );
      setDimWidth(String(fp.selected.widthM));
      setDimDepth(String(fp.selected.depthM));
      setDimHeight(String(fp.wallHeightM));
    } catch (cause) {
      setFootprint(null);
      setSelectedLabel(null);
      setError(
        cause instanceof ExpoFootprintError
          ? footprintErrorMessage(cause.code)
          : "면적을 확인해 주세요.",
      );
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const area = Number(areaInput);
    generate(area, unit);
  }

  function applyKit(kit: (typeof BUILDER_KITS)[number]) {
    setStartMode("builder_kit");
    setUnit("sqm");
    setAreaInput(String(kit.areaSqm));
    generate(kit.areaSqm, "sqm");
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
      return buildCatalogEstimate(scene, confirmedDims);
    } catch {
      return null;
    }
  }, [scene, confirmedDims]);

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
          <div
            aria-disabled="true"
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/15 bg-zinc-50 px-2 py-2 text-center"
          >
            <span className="text-xs font-bold text-black/40">Clone & Reflow</span>
            <span className="mt-0.5 text-[10px] font-semibold text-amber-600">
              준비 중
            </span>
          </div>
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
              3D 부스 만들기
            </button>
          </form>
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

        {displayFootprint && (
          <section aria-label="3D 부스 셸" className="mt-5">
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
                  · 부스 타입 <b>인라인(오픈 1면)</b>, 벽 높이{" "}
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
                      ? "카탈로그 견적 · 가정 단가"
                      : "개념 범위 · 치수 확정 전"}
                  </span>
                </div>

                {catalogEstimate ? (
                  <>
                    <ul className="mt-3 divide-y divide-black/[0.06]">
                      {[...catalogEstimate.lines, ...catalogEstimate.markupLines].map(
                        (line) => (
                          <li
                            key={line.id}
                            className="flex items-baseline justify-between gap-3 py-1.5 text-xs"
                          >
                            <span className="min-w-0 flex-1 truncate font-medium text-black/70">
                              {line.label}
                              <span className="ml-1.5 text-black/40">
                                {line.unit === "sqm"
                                  ? `${line.quantity}㎡`
                                  : line.unit === "ea"
                                    ? `${line.quantity}개`
                                    : line.unit === "pct"
                                      ? `${line.quantity}%`
                                      : "1식"}
                              </span>
                            </span>
                            <span className="tabular-nums font-semibold text-black/80">
                              {formatKrw(line.amountKrw)}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                    <div className="mt-2 flex items-baseline justify-between border-t border-black/10 pt-2">
                      <span className="text-sm font-bold text-black">
                        합계 (부가세 별도)
                      </span>
                      <span className="tabular-nums text-lg font-bold text-blue-700">
                        {formatKrw(catalogEstimate.totalKrw)}
                      </span>
                    </div>
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

            <p role="status" className="mt-2 text-right text-[11px] font-medium text-black/40">
              {saveState === "saved"
                ? "서버에 저장됨"
                : saveState === "saving"
                  ? "서버 저장 중…"
                  : saveState === "signed_out"
                    ? "로그인하면 서버에 저장됩니다 (현재 이 기기에만 저장)"
                    : "이 기기에 임시 저장됨"}
            </p>
          </section>
        )}

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
