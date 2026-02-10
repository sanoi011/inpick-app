"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ConsumerProject,
  ConsumerProjectStatus,
  ProjectAddress,
  ProjectDesign,
  DesignChatMessage,
  ProjectImage,
  DesignDecision,
} from "@/types/consumer-project";
import { createNewProject } from "@/types/consumer-project";

const STORAGE_KEY_PREFIX = "inpick_project_";

function getStorageKey(id: string) {
  return `${STORAGE_KEY_PREFIX}${id}`;
}

export function useProjectState(projectId: string) {
  const [project, setProject] = useState<ConsumerProject | null>(null);
  const [loading, setLoading] = useState(true);

  // localStorage에서 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(projectId));
      if (stored) {
        setProject(JSON.parse(stored));
      } else {
        const newProject = createNewProject(projectId);
        localStorage.setItem(getStorageKey(projectId), JSON.stringify(newProject));
        setProject(newProject);
      }
    } catch {
      const newProject = createNewProject(projectId);
      setProject(newProject);
    }
    setLoading(false);
  }, [projectId]);

  // 프로젝트 저장
  const saveProject = useCallback(
    (updated: ConsumerProject) => {
      const withTimestamp = { ...updated, updatedAt: new Date().toISOString() };
      localStorage.setItem(getStorageKey(projectId), JSON.stringify(withTimestamp));
      setProject(withTimestamp);
    },
    [projectId]
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
      saveProject({ ...project, address, status: "DESIGNING" });
    },
    [project, saveProject]
  );

  // 디자인 전체 업데이트
  const updateDesign = useCallback(
    (designUpdate: Partial<ProjectDesign>) => {
      if (!project) return;
      const current = project.design || { images: [], decisions: [], chatMessages: [] };
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
      const current = project.design || { images: [], decisions: [], chatMessages: [] };
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
      const current = project.design || { images: [], decisions: [], chatMessages: [] };
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
      const current = project.design || { images: [], decisions: [], chatMessages: [] };
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
      const current = project.design || { images: [], decisions: [], chatMessages: [] };
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

  // 견적 ID 설정
  const setEstimateId = useCallback(
    (estimateId: string) => {
      if (!project) return;
      saveProject({ ...project, estimateId, status: "BIDDING" });
    },
    [project, saveProject]
  );

  return {
    project,
    loading,
    updateStatus,
    updateAddress,
    updateDesign,
    addChatMessage,
    addImage,
    setActiveImage,
    addDecision,
    setDrawingId,
    setEstimateId,
    saveProject: () => project && saveProject(project),
  };
}
