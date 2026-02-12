"use client";

import { useState, useEffect } from "react";
import { Shield, Key, Server, Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export default function AdminSettingsPage() {
  const { adminEmail, adminName, authChecked } = useAdminAuth();
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authChecked) checkEnv();
  }, [authChecked]);

  async function checkEnv() {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      if (res.ok) {
        // API가 동작하면 Supabase는 연결된 것
        setEnvStatus({ supabase: true });
      }
    } catch { /* ignore */ }
  }

  if (!authChecked) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">설정</h2>

      {/* 플랫폼 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Server className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">플랫폼 정보</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">회사명</p>
            <p className="font-medium text-gray-900">AIOD</p>
          </div>
          <div>
            <p className="text-gray-500">플랫폼</p>
            <p className="font-medium text-gray-900">INPICK (인픽)</p>
          </div>
          <div>
            <p className="text-gray-500">스택</p>
            <p className="font-medium text-gray-900">Next.js 14 + TypeScript + Supabase + Vercel</p>
          </div>
          <div>
            <p className="text-gray-500">버전</p>
            <p className="font-medium text-gray-900">2026.02</p>
          </div>
        </div>
      </div>

      {/* 관리자 계정 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-gray-900">관리자 계정</h3>
        </div>
        <div className="text-sm space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div>
              <p className="font-medium text-gray-900">{adminName || "AIOD Admin"}</p>
              <p className="text-gray-500">{adminEmail}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">super_admin</span>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          관리자 계정은 admin_profiles 테이블에서 관리됩니다.
          비밀번호는 환경변수 ADMIN_PASSWORD로 설정합니다.
        </p>
      </div>

      {/* 환경 변수 상태 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">환경 변수 상태</h3>
        </div>
        <div className="space-y-2">
          {[
            { key: "SUPABASE", label: "Supabase 연결", status: envStatus.supabase ? "connected" : "unknown" },
            { key: "JUSO_API", label: "행안부 주소 API", status: "configured" },
            { key: "ANTHROPIC_API", label: "Anthropic Claude API", status: "configured" },
            { key: "GEMINI_API", label: "Google Gemini API", status: "check_needed" },
            { key: "TOSS_PAYMENTS", label: "Toss Payments", status: "check_needed" },
            { key: "ADMIN_PASSWORD", label: "관리자 비밀번호", status: "configured" },
          ].map((env) => (
            <div key={env.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-700">{env.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                env.status === "connected" || env.status === "configured"
                  ? "bg-green-100 text-green-700"
                  : env.status === "check_needed"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-500"
              }`}>
                {env.status === "connected" ? "연결됨" :
                 env.status === "configured" ? "설정됨" :
                 env.status === "check_needed" ? "확인 필요" : "미확인"}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          GEMINI_API: 키 미설정 시 Mock 이미지 생성 | TOSS_PAYMENTS: 키 미설정 시 Mock 결제 모드
        </p>
      </div>

      {/* 관리자 모드 안내 */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <h3 className="font-semibold text-red-800 mb-2">관리자 모드 안내</h3>
        <ul className="text-sm text-red-700 space-y-1">
          <li>- 관리자 로그인 상태에서는 크레딧이 소모되지 않습니다</li>
          <li>- 소비자 워크플로우 전체를 무제한 테스트할 수 있습니다</li>
          <li>- AI 이미지 생성, 렌더링 등 모든 크레딧 기능 무료 사용</li>
        </ul>
      </div>
    </div>
  );
}
