"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ExpoFootprintError,
  createProvisionalFootprint,
  type ExpoAreaUnit,
  type ExpoProvisionalFootprint,
} from "@/lib/expo/footprint";

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
  version: 1;
  savedAt: string;
  startMode: StartMode;
  areaInput: string;
  unit: ExpoAreaUnit;
  selectedCandidateLabel: string | null;
  quickFields: {
    builderName: string;
    clientName: string;
    eventName: string;
  };
}

const DRAFT_KEY = "expo_brief_draft_v1";

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

  // 초기 복구 — 로컬 임시 저장분 (서버 저장은 다음 슬라이스, UI에 정직하게 표기)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as ExpoBriefDraft;
      if (draft.version !== 1) return;
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
      version: 1,
      savedAt: new Date().toISOString(),
      startMode,
      areaInput,
      unit,
      selectedCandidateLabel: selectedLabel,
      quickFields: { builderName, clientName, eventName },
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // 저장 실패는 치명적이지 않음 — 다음 저장 시 재시도
    }
  }, [startMode, areaInput, unit, selectedLabel, builderName, clientName, eventName]);

  function generate(areaValue: number, areaUnit: ExpoAreaUnit) {
    setError(null);
    try {
      const fp = createProvisionalFootprint(areaValue, areaUnit);
      setFootprint(fp);
      setSelectedLabel(fp.selected.label);
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
          <section aria-label="임시 3D 부스 셸" className="mt-5">
            <BoothShell3D footprint={displayFootprint} />

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
