"use client";

import { useParams } from "next/navigation";

export default function AIDesignPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🎨</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">AI 디자인 상담</h2>
        <p className="text-gray-500 text-sm">
          프로젝트 {projectId.slice(0, 8)}... 의 AI 디자인 상담 페이지
        </p>
        <p className="text-gray-400 text-xs mt-2">Phase 3에서 구현 예정</p>
      </div>
    </div>
  );
}
