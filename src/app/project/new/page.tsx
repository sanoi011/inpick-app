"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function NewProjectPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth?returnUrl=/project/new");
      return;
    }
    const id = crypto.randomUUID();
    router.replace(`/project/${id}/design`);
  }, [router, user, loading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-3 text-sm text-gray-500">
          {loading ? "로그인 확인 중..." : "새 프로젝트를 생성하고 있습니다..."}
        </p>
      </div>
    </div>
  );
}
