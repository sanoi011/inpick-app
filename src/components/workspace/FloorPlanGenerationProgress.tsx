"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, RefreshCw } from "lucide-react";

export interface GenerationResult {
  finalUrl: string;
  finalMirrorUrl: string;
  processingTimeMs: number;
  maskUrl?: string | null;
  maskMirrorUrl?: string | null;
  roomColorMap?: import("@/lib/constants/room-segmentation").RoomColorMap | null;
}

interface Props {
  complexNo: string;
  pyeongNo: number;
  grandPlanUrl: string;
  complexName?: string;
  pyeongName?: string;
  exclusiveArea?: number;
  isExpanded?: boolean;
  onComplete: (result: GenerationResult) => void;
  onCancel: () => void;
}

export default function FloorPlanGenerationProgress({
  complexNo,
  pyeongNo,
  grandPlanUrl,
  complexName,
  pyeongName,
  exclusiveArea,
  isExpanded,
  onComplete,
  onCancel,
}: Props) {
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
        // ① 캐시 확인
        const checkRes = await fetch(
          `/api/project/generate-floorplan?complexNo=${complexNo}&pyeongNo=${pyeongNo}`,
          { signal: abortController.signal }
        );
        const checkData = await checkRes.json();

        if (checkData.exists) {
          setProgress(100);
          setCompleted(true);
          setMessage("캐시된 도면 로드 완료!");
          onCompleteRef.current({
            finalUrl: checkData.finalUrl,
            finalMirrorUrl: checkData.finalMirrorUrl,
            processingTimeMs: 0,
            maskUrl: checkData.maskUrl || null,
            maskMirrorUrl: checkData.maskMirrorUrl || null,
            roomColorMap: checkData.roomColorMap || null,
          });
          return;
        }

        // ② SSE 파이프라인 시작
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
            isExpanded,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "서버 오류" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        // JSON 캐시 응답 체크
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (data.cached) {
            setProgress(100);
            setCompleted(true);
            setMessage("캐시된 도면 로드 완료!");
            onCompleteRef.current({
              finalUrl: data.finalUrl,
              finalMirrorUrl: data.finalMirrorUrl,
              processingTimeMs: 0,
              maskUrl: data.maskUrl || null,
              maskMirrorUrl: data.maskMirrorUrl || null,
              roomColorMap: data.roomColorMap || null,
            });
            return;
          }
        }

        // ③ SSE 스트림 파싱
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
                setMessage(data.message || "처리 중...");
              } else if (data.event === "complete") {
                setProgress(100);
                setCompleted(true);
                setMessage("도면 생성 완료!");
                onCompleteRef.current({
                  finalUrl: data.finalUrl,
                  finalMirrorUrl: data.finalMirrorUrl,
                  processingTimeMs: data.processingTimeMs,
                  maskUrl: data.maskUrl || null,
                  maskMirrorUrl: data.maskMirrorUrl || null,
                  roomColorMap: data.roomColorMap || null,
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
    }

    run();

    return () => {
      abortController.abort();
    };
  }, [complexNo, pyeongNo, grandPlanUrl, complexName, pyeongName, exclusiveArea, isExpanded, retryCount]);

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setMessage("도면 생성 준비 중...");
    setCompleted(false);
    setRetryCount((c) => c + 1);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="mb-6">
          {completed ? (
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          ) : error ? (
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <span className="text-2xl">!</span>
            </div>
          ) : (
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto animate-spin" />
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          {completed ? "도면 생성 완료" : error ? "도면 생성 실패" : "AI 도면 생성 중"}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {complexName && <span>{complexName} </span>}
          {pyeongName && <span>{pyeongName}평형</span>}
          {exclusiveArea && <span className="text-gray-400"> ({exclusiveArea}m²)</span>}
        </p>

        {/* Progress bar */}
        {!error && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completed ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Status message */}
        <p className={`text-sm font-medium mb-2 ${error ? "text-red-600" : completed ? "text-green-600" : "text-gray-700"}`}>
          {error ? error : message}
        </p>
        {!error && !completed && (
          <p className="text-xs text-gray-400">
            {progress}% · 약 1~2분 소요
          </p>
        )}

        {/* Error: retry button */}
        {error && (
          <div className="flex gap-2 justify-center mt-4">
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
          <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
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
