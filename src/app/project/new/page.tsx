"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const router = useRouter();

  useEffect(() => {
    const id = crypto.randomUUID();
    router.replace(`/project/${id}/home`);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-3 text-sm text-gray-500">새 프로젝트를 생성하고 있습니다...</p>
      </div>
    </div>
  );
}
