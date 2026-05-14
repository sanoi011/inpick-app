"use client";

/**
 * KitchenPlanModal — 주방 카운터 길이/레이아웃/후드·쿡탑 등 사용자 직접 입력.
 * 가이드: inpick-material-category-taxonomy-base-20260513.md §16-2
 *
 * 사용자가 입력하면 견적 재계산 시 KitchenPlan source = "user_input"으로 격상되어
 * EstimatePrecisionLevel이 L3 → L4로 올라간다.
 */
import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import type { KitchenPlan, KitchenLayoutType, PlumbingRelocation } from "@/lib/inpick/estimate-v2/kitchen-plan-builder";

interface Props {
  open: boolean;
  initialPlan?: Partial<KitchenPlan>;
  onClose: () => void;
  onSubmit: (input: Partial<KitchenPlan>) => void;
}

const COUNTER_PRESETS = [
  { label: "2.4m 이하 (소형)", value: 2.4 },
  { label: "2.7m (소형 표준)", value: 2.7 },
  { label: "3.0m (표준)", value: 3.0 },
  { label: "3.3m (중형)", value: 3.3 },
  { label: "3.6m (중형 표준)", value: 3.6 },
  { label: "4.2m (대형)", value: 4.2 },
  { label: "4.8m (대형 이상)", value: 4.8 },
];

const LAYOUT_OPTIONS: Array<{ value: KitchenLayoutType; label: string; desc: string }> = [
  { value: "linear", label: "일자형", desc: "벽 한 면 카운터" },
  { value: "l_shape", label: "ㄱ자형", desc: "두 벽 모서리 활용" },
  { value: "u_shape", label: "ㄷ자형", desc: "세 벽 둘러싸기" },
  { value: "island", label: "아일랜드", desc: "벽 + 중앙 독립" },
];

const PLUMBING_OPTIONS: Array<{ value: PlumbingRelocation; label: string }> = [
  { value: "none", label: "기존 위치 유지" },
  { value: "minor", label: "소폭 이동 (1m 이내)" },
  { value: "major", label: "대폭 이동 (1m 이상)" },
];

export default function KitchenPlanModal({ open, initialPlan, onClose, onSubmit }: Props) {
  const [counterLengthM, setCounterLengthM] = useState<number>(initialPlan?.counterLengthM ?? 3.0);
  const [layoutType, setLayoutType] = useState<KitchenLayoutType>(initialPlan?.layoutType ?? "linear");
  const [tallCabinetEa, setTallCabinetEa] = useState<number>(initialPlan?.tallCabinetEa ?? 1);
  const [hoodEa, setHoodEa] = useState<number>(initialPlan?.hoodEa ?? 1);
  const [cooktopEa, setCooktopEa] = useState<number>(initialPlan?.cooktopEa ?? 1);
  const [plumbingRelocation, setPlumbingRelocation] = useState<PlumbingRelocation>(
    initialPlan?.plumbingRelocation ?? "none",
  );
  const [electricalAdditionsEa, setElectricalAdditionsEa] = useState<number>(
    initialPlan?.electricalAdditionsEa ?? 0,
  );

  useEffect(() => {
    if (open) {
      setCounterLengthM(initialPlan?.counterLengthM ?? 3.0);
      setLayoutType(initialPlan?.layoutType ?? "linear");
      setTallCabinetEa(initialPlan?.tallCabinetEa ?? 1);
      setHoodEa(initialPlan?.hoodEa ?? 1);
      setCooktopEa(initialPlan?.cooktopEa ?? 1);
      setPlumbingRelocation(initialPlan?.plumbingRelocation ?? "none");
      setElectricalAdditionsEa(initialPlan?.electricalAdditionsEa ?? 0);
    }
  }, [open, initialPlan]);

  if (!open) return null;

  const handleSubmit = () => {
    const upperCabinetLengthM = +(counterLengthM * 0.8).toFixed(2);
    const backsplashM2 = +(counterLengthM * 0.6).toFixed(2);
    const sinkEa = layoutType === "u_shape" || layoutType === "island" ? 1 : 1;
    onSubmit({
      counterLengthM,
      layoutType,
      lowerCabinetLengthM: counterLengthM,
      upperCabinetLengthM,
      tallCabinetEa,
      worktopLengthM: counterLengthM,
      sinkEa,
      faucetEa: 1,
      hoodEa,
      cooktopEa,
      backsplashM2,
      plumbingRelocation,
      electricalAdditionsEa,
      source: "user_input",
      confidence: 0.95,
      assumptions: ["사용자 직접 입력"],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">주방 정보 입력</h2>
            <p className="text-xs text-gray-500">정확도 L4 확정 견적으로 격상됩니다.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <Section title="카운터 길이">
            <div className="grid grid-cols-2 gap-2">
              {COUNTER_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setCounterLengthM(p.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    Math.abs(counterLengthM - p.value) < 0.01
                      ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span>직접 입력:</span>
              <input
                type="number"
                step={0.1}
                min={1.5}
                max={8}
                value={counterLengthM}
                onChange={(e) => setCounterLengthM(Number(e.target.value) || 3.0)}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-right"
              />
              <span>m</span>
            </div>
          </Section>

          <Section title="배치 형태">
            <div className="grid grid-cols-2 gap-2">
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLayoutType(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    layoutType === opt.value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="설비">
            <NumberRow label="키큰장 (냉장고장 + 팬트리)" value={tallCabinetEa} onChange={setTallCabinetEa} min={0} max={3} unit="ea" />
            <NumberRow label="후드 교체" value={hoodEa} onChange={setHoodEa} min={0} max={2} unit="ea" />
            <NumberRow label="쿡탑 교체" value={cooktopEa} onChange={setCooktopEa} min={0} max={2} unit="ea" />
            <NumberRow
              label="추가 콘센트/전용회로"
              value={electricalAdditionsEa}
              onChange={setElectricalAdditionsEa}
              min={0}
              max={10}
              unit="ea"
            />
          </Section>

          <Section title="배관 이전">
            <div className="grid grid-cols-3 gap-2">
              {PLUMBING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPlumbingRelocation(opt.value)}
                  className={`rounded-lg border px-2 py-2 text-sm transition ${
                    plumbingRelocation === opt.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Check className="h-4 w-4" />
            적용 후 재계산
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-7 w-7 rounded border border-gray-200 text-gray-600 hover:bg-gray-100"
        >
          −
        </button>
        <span className="w-12 text-center text-sm font-semibold tabular-nums">
          {value} {unit}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="h-7 w-7 rounded border border-gray-200 text-gray-600 hover:bg-gray-100"
        >
          +
        </button>
      </div>
    </div>
  );
}
