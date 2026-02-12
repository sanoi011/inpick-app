"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import type {
  ConsumerProject,
  ConsumerProjectStatus,
  ProjectAddress,
  ProjectDesign,
  DesignChatMessage,
  ProjectImage,
  DesignDecision,
  GeneratedImage,
  ProjectRendering,
  RenderView,
  SelectedMaterial,
  ProjectEstimate,
  ProjectRfq,
} from "@/types/consumer-project";
import { createNewProject } from "@/types/consumer-project";

const STORAGE_KEY_PREFIX = "inpick_project_";

function getStorageKey(id: string) {
  return `${STORAGE_KEY_PREFIX}${id}`;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Supabase에 동기화
function syncToSupabase(
  project: ConsumerProject,
  userId: string,
  onStatus?: (status: SaveStatus) => void,
) {
  // base64 이미지를 제외한 design state
  const designState = project.design
    ? {
        decisions: project.design.decisions,
        chatMessages: project.design.chatMessages.slice(-50), // 최근 50개만
        generatedImages: (project.design.generatedImages || []).map((img) => ({
          id: img.id,
          prompt: img.prompt,
          roomId: img.roomId,
          roomName: img.roomName,
          description: img.description,
          createdAt: img.createdAt,
          // imageData 제외 (base64 너무 큼)
        })),
      }
    : null;

  // rendering state (base64 제외)
  const renderingState = project.rendering
    ? {
        materials: project.rendering.materials,
        allConfirmed: project.rendering.allConfirmed,
        views: project.rendering.views.map((v) => ({
          id: v.id,
          roomId: v.roomId,
          roomName: v.roomName,
          prompt: v.prompt,
          confirmed: v.confirmed,
          createdAt: v.createdAt,
          // imageData 제외
        })),
      }
    : null;

  onStatus?.("saving");
  fetch("/api/consumer-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: project.id,
      userId,
      status: project.status,
      address: project.address || null,
      drawingId: project.drawingId || null,
      estimateId: project.estimateId || null,
      designState,
      renderingState,
      estimateState: project.estimate || null,
      rfqState: project.rfq || null,
    }),
  })
    .then((res) => {
      onStatus?.(res.ok ? "saved" : "error");
    })
    .catch(() => {
      onStatus?.("error");
    });
}

export function useProjectState(projectId: string) {
  const [project, setProject] = useState<ConsumerProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const { user } = useAuth();
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // localStorage에서 로드 + Supabase fallback
  useEffect(() => {
    let localProject: ConsumerProject | null = null;

    // 1) localStorage 먼저 로드
    try {
      const stored = localStorage.getItem(getStorageKey(projectId));
      if (stored) {
        localProject = JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    if (localProject) {
      setProject(localProject);
      setLoading(false);
    }

    // 2) 로그인 유저면 Supabase에서도 가져와서 비교
    if (user) {
      fetch(`/api/consumer-projects?id=${projectId}`)
        .then((res) => {
          if (!res.ok) throw new Error("not found");
          return res.json();
        })
        .then((data) => {
          if (data.project) {
            const remote = data.project;
            const remoteUpdated = new Date(remote.updated_at).getTime();
            const localUpdated = localProject
              ? new Date(localProject.updatedAt).getTime()
              : 0;

            // 서버가 더 최신이면 서버 데이터 사용 (단, 로컬 base64 데이터 보존)
            if (remoteUpdated > localUpdated && localProject) {
              const merged: ConsumerProject = {
                ...localProject,
                status: (remote.status as ConsumerProjectStatus) || localProject.status,
                address: remote.address || localProject.address,
                drawingId: remote.drawing_id || localProject.drawingId,
                estimateId: remote.estimate_id || localProject.estimateId,
                estimate: remote.estimate_state || localProject.estimate,
                rfq: remote.rfq_state || localProject.rfq,
                updatedAt: remote.updated_at,
              };
              localStorage.setItem(
                getStorageKey(projectId),
                JSON.stringify(merged)
              );
              setProject(merged);
            } else if (!localProject) {
              // 로컬에 없고 서버에만 있는 경우
              const reconstructed = createNewProject(projectId);
              reconstructed.status = (remote.status as ConsumerProjectStatus) || "ADDRESS_SELECTION";
              reconstructed.address = remote.address;
              reconstructed.drawingId = remote.drawing_id;
              reconstructed.estimateId = remote.estimate_id;
              reconstructed.estimate = remote.estimate_state;
              reconstructed.rfq = remote.rfq_state;
              reconstructed.updatedAt = remote.updated_at;
              localStorage.setItem(
                getStorageKey(projectId),
                JSON.stringify(reconstructed)
              );
              setProject(reconstructed);
            }
          }
        })
        .catch(() => {
          // 서버 실패 → 로컬 데이터만 사용
        })
        .finally(() => {
          if (!localProject) {
            // 로컬도 서버도 없으면 신규
            const newProject = createNewProject(projectId);
            localStorage.setItem(
              getStorageKey(projectId),
              JSON.stringify(newProject)
            );
            setProject(newProject);
            setLoading(false);
          }
        });
    } else if (!localProject) {
      const newProject = createNewProject(projectId);
      localStorage.setItem(
        getStorageKey(projectId),
        JSON.stringify(newProject)
      );
      setProject(newProject);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user?.id]);

  // 프로젝트 저장 (localStorage 즉시 + Supabase background)
  const saveProject = useCallback(
    (updated: ConsumerProject) => {
      const withTimestamp = { ...updated, updatedAt: new Date().toISOString() };
      localStorage.setItem(getStorageKey(projectId), JSON.stringify(withTimestamp));
      setProject(withTimestamp);

      // Supabase 동기화 (디바운스 1초)
      if (user) {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          syncToSupabase(withTimestamp, user.id, (s) => {
            setSaveStatus(s);
            if (s === "saved") {
              if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
              savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
            }
          });
        }, 1000);
      }
    },
    [projectId, user]
  );

  // 상태 업데이트
  const updateStatus = useCallback(
    (status: ConsumerProjectStatus) => {
      if (!project) return;
      saveProject({ ...project, status });
    },
    [project, saveProject]
  );

  // 주소 업데이트
  const updateAddress = useCallback(
    (address: ProjectAddress) => {
      if (!project) return;
      saveProject({ ...project, address, status: "FLOOR_PLAN" });
    },
    [project, saveProject]
  );

  // 디자인 전체 업데이트
  const updateDesign = useCallback(
    (designUpdate: Partial<ProjectDesign>) => {
      if (!project) return;
      const current = project.design || { images: [], decisions: [], chatMessages: [], generatedImages: [] };
      saveProject({
        ...project,
        design: { ...current, ...designUpdate },
      });
    },
    [project, saveProject]
  );

  // 채팅 메시지 추가
  const addChatMessage = useCallback(
    (message: DesignChatMessage) => {
      if (!project) return;
      const current = project.design || { images: [], decisions: [], chatMessages: [], generatedImages: [] };
      saveProject({
        ...project,
        design: {
          ...current,
          chatMessages: [...current.chatMessages, message],
        },
      });
    },
    [project, saveProject]
  );

  // 이미지 추가
  const addImage = useCallback(
    (image: ProjectImage) => {
      if (!project) return;
      const current = project.design || { images: [], decisions: [], chatMessages: [], generatedImages: [] };
      saveProject({
        ...project,
        design: {
          ...current,
          images: [...current.images, image],
          activeImageId: image.id,
        },
      });
    },
    [project, saveProject]
  );

  // 활성 이미지 변경
  const setActiveImage = useCallback(
    (imageId: string) => {
      if (!project) return;
      const current = project.design || { images: [], decisions: [], chatMessages: [], generatedImages: [] };
      saveProject({
        ...project,
        design: { ...current, activeImageId: imageId },
      });
    },
    [project, saveProject]
  );

  // 디자인 결정 추가
  const addDecision = useCallback(
    (decision: DesignDecision) => {
      if (!project) return;
      const current = project.design || { images: [], decisions: [], chatMessages: [], generatedImages: [] };
      saveProject({
        ...project,
        design: {
          ...current,
          decisions: [...current.decisions, decision],
        },
      });
    },
    [project, saveProject]
  );

  // 도면 ID 설정
  const setDrawingId = useCallback(
    (drawingId: string) => {
      if (!project) return;
      saveProject({ ...project, drawingId });
    },
    [project, saveProject]
  );

  // AI 생성 이미지 추가
  const addGeneratedImage = useCallback(
    (image: GeneratedImage) => {
      if (!project) return;
      const current = project.design || { images: [], decisions: [], chatMessages: [], generatedImages: [] };
      saveProject({
        ...project,
        design: {
          ...current,
          generatedImages: [...(current.generatedImages || []), image],
        },
      });
    },
    [project, saveProject]
  );

  // AI 생성 이미지 삭제
  const removeGeneratedImage = useCallback(
    (imageId: string) => {
      if (!project) return;
      const current = project.design || { images: [], decisions: [], chatMessages: [], generatedImages: [] };
      saveProject({
        ...project,
        design: {
          ...current,
          generatedImages: (current.generatedImages || []).filter((img) => img.id !== imageId),
        },
      });
    },
    [project, saveProject]
  );

  // 렌더링 상태 업데이트
  const updateRendering = useCallback(
    (renderingUpdate: Partial<ProjectRendering>) => {
      if (!project) return;
      const current = project.rendering || { views: [], materials: [], allConfirmed: false };
      saveProject({
        ...project,
        rendering: { ...current, ...renderingUpdate },
      });
    },
    [project, saveProject]
  );

  // 렌더링 뷰 추가
  const addRenderView = useCallback(
    (view: RenderView) => {
      if (!project) return;
      const current = project.rendering || { views: [], materials: [], allConfirmed: false };
      saveProject({
        ...project,
        rendering: {
          ...current,
          views: [...current.views, view],
        },
      });
    },
    [project, saveProject]
  );

  // 자재 업데이트
  const updateMaterial = useCallback(
    (material: SelectedMaterial) => {
      if (!project) return;
      const current = project.rendering || { views: [], materials: [], allConfirmed: false };
      const existing = current.materials.findIndex((m) => m.id === material.id);
      const materials = [...current.materials];
      if (existing >= 0) {
        materials[existing] = material;
      } else {
        materials.push(material);
      }
      saveProject({
        ...project,
        rendering: { ...current, materials },
      });
    },
    [project, saveProject]
  );

  // 견적 설정
  const setEstimate = useCallback(
    (estimate: ProjectEstimate) => {
      if (!project) return;
      saveProject({ ...project, estimate, status: "RFQ" });
    },
    [project, saveProject]
  );

  // Supabase estimateId 설정
  const setEstimateId = useCallback(
    (estimateId: string) => {
      if (!project) return;
      saveProject({ ...project, estimateId });
    },
    [project, saveProject]
  );

  // RFQ 업데이트
  const updateRfq = useCallback(
    (rfqUpdate: Partial<ProjectRfq>) => {
      if (!project) return;
      const current = project.rfq || { specialNotes: "", livingDuringWork: false, bidIds: [] };
      saveProject({
        ...project,
        rfq: { ...current, ...rfqUpdate },
      });
    },
    [project, saveProject]
  );

  const forceSave = useCallback(() => {
    if (!project || !user) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncToSupabase(project, user.id, (s) => {
      setSaveStatus(s);
      if (s === "saved") {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      }
    });
  }, [project, user]);

  return {
    project,
    loading,
    saveStatus,
    updateStatus,
    updateAddress,
    updateDesign,
    addChatMessage,
    addImage,
    setActiveImage,
    addDecision,
    setDrawingId,
    addGeneratedImage,
    removeGeneratedImage,
    updateRendering,
    addRenderView,
    updateMaterial,
    setEstimate,
    setEstimateId,
    updateRfq,
    saveProject: () => project && saveProject(project),
    forceSave,
  };
}
