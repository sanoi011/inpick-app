"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";

const STEPS = [
  { label: "데이터 로드", desc: "계약·도면·자재 데이터" },
  { label: "입면도 계산", desc: "벽면 전개 + 전기 배치" },
  { label: "평면도 생성", desc: "가구배치도 + 전기배선도" },
  { label: "입면도 생성", desc: "방별 벽면 전개도" },
  { label: "AI 보강", desc: "가구 분석 + 3D 렌더 묘사" },
  { label: "이미지 업로드", desc: "Supabase Storage" },
  { label: "DB 저장", desc: "도면 세트 완성" },
];

interface DrawingResult {
  drawingSetId: string;
  drawingCount: number;
  processingTimeMs: number;
  drawings: Array<{
    drawingType: string;
    finalUrl?: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface Props {
  contractId: string;
  onComplete: (result: DrawingResult) => void;
  onCancel: () => void;
}

export default function DrawingGenerationProgress({ contractId, onComplete, onCancel }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("도면 생성 준비 중...");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const abortController = new AbortController();

    async function run() {
      try {
        // 기존 도면 확인
        const checkRes = await fetch(
          `/api/project/generate-drawings?contractId=${contractId}`,
          { signal: abortController.signal }
        );
        const checkData = await checkRes.json();

        if (checkData.exists && checkData.drawingSet?.status === "completed") {
          setProgress(100);
          setCompleted(true);
          setMessage("기존 도면 세트를 불러왔습니다.");
          onCompleteRef.current({
            drawingSetId: checkData.drawingSet.id,
            drawingCount: checkData.drawings?.length || 0,
            processingTimeMs: 0,
            drawings: (checkData.drawings || []).map((d: Record<string, unknown>) => ({
              drawingType: d.drawing_type,
              finalUrl: d.final_url,
              metadata: d.metadata,
            })),
          });
          return;
        }

        // SSE 시작
        setMessage("도면 생성 시작...");
        const res = await fetch("/api/project/generate-drawings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId }),
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.replace(/^data: /, "").trim();
            if (!trimmed) continue;

            try {
              const data = JSON.parse(trimmed);

              if (data.event === "progress") {
                setCurrentStep(data.step || 0);
                setProgress(data.progress || 0);
                setMessage(data.message || "처리 중...");
              } else if (data.event === "complete") {
                setProgress(100);
                setCompleted(true);
                setMessage("도면 생성 완료!");
                onCompleteRef.current(data as DrawingResult);
              } else if (data.event === "error") {
                setError(data.message || "알 수 없는 오류");
              }
            } catch {
              // JSON 파싱 에러 무시
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "연결 오류");
      }
    }

    run();
    return () => abortController.abort();
  }, [contractId, retryCount]);

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setCurrentStep(0);
    setMessage("도면 생성 재시도...");
    setRetryCount(c => c + 1);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-4">시공도면 생성</h3>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {STEPS.map((step, idx) => (
          <div key={idx} className="flex items-center shrink-0">
            <div className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium
              ${idx < currentStep
                ? "bg-green-50 text-green-700"
                : idx === currentStep && !completed
                ? "bg-blue-50 text-blue-700"
                : completed
                ? "bg-green-50 text-green-700"
                : "bg-gray-50 text-gray-400"
              }
            `}>
              {idx < currentStep || completed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              ) : idx === currentStep && !error ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`w-4 h-px mx-0.5 ${idx < currentStep ? "bg-green-300" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* 프로그레스 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">{message}</span>
          <span className="text-gray-500 font-medium">{progress}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              error ? "bg-red-500" : completed ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 현재 단계 설명 */}
      {!error && !completed && currentStep < STEPS.length && (
        <p className="text-xs text-gray-500">
          Step {currentStep + 1}/{STEPS.length}: {STEPS[currentStep].desc}
        </p>
      )}

      {/* 에러 */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">오류 발생</span>
          </div>
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              다시 시도
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 완료 */}
      {completed && (
        <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">도면 생성이 완료되었습니다!</span>
          </div>
        </div>
      )}
    </div>
  );
}
