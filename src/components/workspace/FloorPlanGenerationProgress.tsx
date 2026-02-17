"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Download, FlipHorizontal, Ruler, Sparkles } from "lucide-react";

interface GenerationResult {
  finalUrl: string;
  finalMirrorUrl: string;
  processingTimeMs: number;
}

interface Props {
  complexNo: string;
  pyeongNo: number;
  grandPlanUrl: string;
  complexName?: string;
  pyeongName?: string;
  exclusiveArea?: number;
  onComplete: (result: GenerationResult) => void;
  onCancel: () => void;
}

const STEPS = [
  { label: "다운로드", icon: Download },
  { label: "AI 클린", icon: Sparkles },
  { label: "미러", icon: FlipHorizontal },
  { label: "치수", icon: Ruler },
  { label: "미러치수", icon: Ruler },
];

export default function FloorPlanGenerationProgress({
  complexNo,
  pyeongNo,
  grandPlanUrl,
  complexName,
  pyeongName,
  exclusiveArea,
  onComplete,
  onCancel,
}: Props) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [message, setMessage] = useState("도면 생성 준비 중...");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const startGeneration = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // First check if already completed
      const checkRes = await fetch(
        `/api/project/generate-floorplan?complexNo=${complexNo}&pyeongNo=${pyeongNo}`
      );
      const checkData = await checkRes.json();

      if (checkData.exists) {
        setProgress(100);
        setCurrentStep(4);
        setCompleted(true);
        setMessage("캐시된 도면 로드 완료!");
        onComplete({
          finalUrl: checkData.finalUrl,
          finalMirrorUrl: checkData.finalMirrorUrl,
          processingTimeMs: 0,
        });
        return;
      }

      // Start SSE pipeline
      const res = await fetch("/api/project/generate-floorplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complexNo,
          pyeongNo,
          grandPlanUrl,
          complexName,
          pyeongName,
          exclusiveArea,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      // Check for cached response (non-SSE)
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.cached) {
          setProgress(100);
          setCurrentStep(4);
          setCompleted(true);
          setMessage("캐시된 도면 로드 완료!");
          onComplete({
            finalUrl: data.finalUrl,
            finalMirrorUrl: data.finalMirrorUrl,
            processingTimeMs: 0,
          });
          return;
        }
      }

      // Parse SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("스트림 읽기 실패");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.event === "progress") {
              setProgress(data.progress || 0);
              setCurrentStep(data.step || 0);
              setMessage(data.message || "처리 중...");
            } else if (data.event === "complete") {
              setProgress(100);
              setCurrentStep(4);
              setCompleted(true);
              setMessage("도면 생성 완료!");
              onComplete({
                finalUrl: data.finalUrl,
                finalMirrorUrl: data.finalMirrorUrl,
                processingTimeMs: data.processingTimeMs,
              });
            } else if (data.event === "error") {
              setError(data.message || "알 수 없는 오류");
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "알 수 없는 오류");
    }
  }, [complexNo, pyeongNo, grandPlanUrl, complexName, pyeongName, exclusiveArea, onComplete]);

  useEffect(() => {
    startGeneration();
    return () => {
      abortRef.current?.abort();
    };
  }, [startGeneration]);

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setCurrentStep(0);
    setMessage("도면 생성 준비 중...");
    startedRef.current = false;
    startGeneration();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-1">AI 도면 생성</h3>
          <p className="text-sm text-gray-500">
            {complexName && <span>{complexName} </span>}
            {pyeongName && <span>{pyeongName}평형</span>}
            {exclusiveArea && <span className="text-gray-400"> ({exclusiveArea}m²)</span>}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep && !completed && !error;
            const isDone = i < currentStep || completed;
            const isFailed = !!error && i === currentStep;

            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isDone
                      ? "bg-green-500 text-white"
                      : isActive
                      ? "bg-blue-500 text-white animate-pulse"
                      : isFailed
                      ? "bg-red-500 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isFailed ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-[10px] ${
                    isDone ? "text-green-600 font-medium" : isActive ? "text-blue-600 font-medium" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={`absolute h-0.5 w-full ${isDone ? "bg-green-300" : "bg-gray-200"}`}
                    style={{ display: "none" }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              error ? "bg-red-500" : completed ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status message */}
        <div className="text-center mb-4">
          <p className={`text-sm font-medium ${error ? "text-red-600" : completed ? "text-green-600" : "text-gray-700"}`}>
            {error ? error : message}
          </p>
          {!error && !completed && (
            <p className="text-xs text-gray-400 mt-1">
              {progress}% · 총 약 3~4분 소요
            </p>
          )}
        </div>

        {/* Error: retry button */}
        {error && (
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              다시 시도
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
          </div>
        )}

        {/* Processing notice */}
        {!error && !completed && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-700">
              Gemini Pro AI가 도면을 생성하고 있습니다. 창을 닫지 마세요.
              완료된 도면은 자동 저장되어 다음부터 즉시 제공됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
