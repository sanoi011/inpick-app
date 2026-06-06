"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// AI 디자인 탭이 디자인하기 탭으로 통합됨 → 리다이렉트
export default function AIDesignRedirect() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  useEffect(() => {
    router.replace(`/project/${projectId}/design`);
  }, [router, projectId]);

  return null;
}
