"use client";

import { Cloud, CloudOff, Check, Loader2 } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveIndicatorProps {
  status: SaveStatus;
}

export function SaveIndicator({ status }: SaveIndicatorProps) {
  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-1 text-xs">
      {status === "saving" && (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          <span className="text-blue-500">저장 중...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="w-3 h-3 text-green-500" />
          <span className="text-green-500">저장됨</span>
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff className="w-3 h-3 text-red-500" />
          <span className="text-red-500">저장 실패</span>
        </>
      )}
    </div>
  );
}

export function SaveButton({
  status,
  onClick,
}: {
  status: SaveStatus;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <SaveIndicator status={status} />
      <button
        onClick={onClick}
        disabled={status === "saving"}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
      >
        <Cloud className="w-3.5 h-3.5" />
        저장하기
      </button>
    </div>
  );
}
