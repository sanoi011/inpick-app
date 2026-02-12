"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  ArrowLeft,
  MapPin,
  Clock,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  CONSUMER_PROJECT_STATUS_LABELS,
  CONSUMER_PROJECT_STATUS_COLORS,
} from "@/types/consumer-project";
import type { ConsumerProjectStatus, ProjectAddress } from "@/types/consumer-project";

interface ProjectSummary {
  id: string;
  user_id: string;
  status: string;
  address: ProjectAddress | null;
  drawing_id: string | null;
  created_at: string;
  updated_at: string;
}

function mergeProjects(
  remoteProjects: ProjectSummary[],
  localProjects: { id: string; status: string; address?: ProjectAddress; updatedAt: string }[]
): ProjectSummary[] {
  const merged = new Map<string, ProjectSummary>();

  // 서버 데이터 먼저
  for (const rp of remoteProjects) {
    merged.set(rp.id, rp);
  }

  // 로컬 데이터 병합 (서버에 없는 것만 추가)
  for (const lp of localProjects) {
    if (!merged.has(lp.id)) {
      merged.set(lp.id, {
        id: lp.id,
        user_id: "",
        status: lp.status,
        address: lp.address || null,
        drawing_id: null,
        created_at: lp.updatedAt,
        updated_at: lp.updatedAt,
      });
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function getLocalProjects(): { id: string; status: string; address?: ProjectAddress; updatedAt: string }[] {
  const projects: { id: string; status: string; address?: ProjectAddress; updatedAt: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("inpick_project_")) {
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        if (data.id) {
          projects.push({
            id: data.id,
            status: data.status || "ADDRESS_SELECTION",
            address: data.address,
            updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
          });
        }
      }
    }
  } catch {
    // ignore
  }
  return projects;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    const localProjects = getLocalProjects();

    if (user) {
      fetch(`/api/consumer-projects?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          const merged = mergeProjects(data.projects || [], localProjects);
          setProjects(merged);
        })
        .catch(() => {
          // 서버 실패 → 로컬만
          setProjects(
            mergeProjects([], localProjects)
          );
        })
        .finally(() => setLoading(false));
    } else {
      setProjects(mergeProjects([], localProjects));
      setLoading(false);
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <a href="/" className="text-xl font-bold text-blue-600">
              INPICK
            </a>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">
              내 프로젝트
            </span>
          </div>
          <button
            onClick={() => router.push("/project/new")}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> 새 프로젝트
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {projects.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              프로젝트가 없습니다
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              새 프로젝트를 시작해보세요
            </p>
            <button
              onClick={() => router.push("/project/new")}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              프로젝트 시작하기
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const status = (p.status as ConsumerProjectStatus) || "ADDRESS_SELECTION";
              return (
                <button
                  key={p.id}
                  onClick={() => router.push(`/project/${p.id}/home`)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">
                        {p.address?.buildingName || p.address?.roadAddress || "새 프로젝트"}
                      </h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                        CONSUMER_PROJECT_STATUS_COLORS[status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {CONSUMER_PROJECT_STATUS_LABELS[status] || status}
                    </span>
                  </div>

                  {p.address?.roadAddress && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                      <MapPin className="w-3 h-3" />
                      {p.address.roadAddress}
                      {p.address.dongName && ` ${p.address.dongName}`}
                      {p.address.hoName && ` ${p.address.hoName}`}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {p.address?.exclusiveArea && (
                      <span>전용 {p.address.exclusiveArea}m²</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(p.updated_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
