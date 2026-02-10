"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import AnnotationCanvas from "@/components/project/AnnotationCanvas";
import DesignChat from "@/components/project/DesignChat";
import ImageUploader, { ImageThumbnailList } from "@/components/project/ImageUploader";
import type { CanvasAnnotation, DesignChatMessage, ProjectImage } from "@/types/consumer-project";

// 이미지 리사이즈 유틸
function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Mock AI 응답
const MOCK_RESPONSES = [
  "해당 부분에 대해 분석해 보겠습니다.\n\n**바닥재 추천:**\n- 거실: LX 하우시스 디아망 오크 (내구성 우수, 평당 약 45,000원)\n- 침실: 한화 아쿠아텍 자작나무 (방수 기능, 평당 약 38,000원)\n\n선택하신 공간의 면적과 용도를 고려했을 때, 복합 마루가 가장 적합합니다. 추가 문의사항이 있으시면 말씀해 주세요.",
  "좋은 선택이시네요! 해당 공간을 분석했습니다.\n\n**벽 색상 제안:**\n1. 베이지 톤 (NCS S 1005-Y20R) - 따뜻하고 넓어 보이는 효과\n2. 라이트 그레이 (NCS S 1502-B) - 모던하고 깔끔한 느낌\n3. 소프트 민트 (NCS S 1010-G10Y) - 밝고 산뜻한 분위기\n\n현재 공간의 채광과 크기를 고려하면 1번 베이지 톤을 추천드립니다.",
  "공간 활용도를 높이는 수납 솔루션을 제안드립니다.\n\n**수납 확장 방안:**\n- 붙박이장 설치 (벽면 활용, 약 120만원~)\n- 시스템 행거 (드레스룸 구성, 약 80만원~)\n- 키큰수납장 (주방/거실 벽면, 약 60만원~)\n\n표시하신 영역이 약 2m 폭으로 보이는데, 이 공간에 맞춤형 붙박이장을 설치하면 수납량을 약 3배 늘릴 수 있습니다.",
  "조명 배치를 분석해 보겠습니다.\n\n**추천 조명 계획:**\n- 거실: 매입 다운라이트 6개 + 간접 LED 라인 (약 45만원)\n- 주방: 펜던트 2개 + 하부장 LED (약 30만원)\n- 침실: 매입등 4개 + 간접등 (약 25만원)\n\n현재 도면 기준으로 최적의 조명 배치를 계산했습니다. 밝기는 거실 300lx, 주방 500lx, 침실 150lx를 기준으로 합니다.",
];

export default function DesignPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project, addChatMessage, addImage, setActiveImage } = useProjectState(projectId);

  const [messages, setMessages] = useState<DesignChatMessage[]>(
    project?.design?.chatMessages || []
  );
  const [images, setImages] = useState<ProjectImage[]>(
    project?.design?.images || []
  );
  const [activeImageId, setActiveImageId] = useState<string | undefined>(
    project?.design?.activeImageId
  );
  const [annotations, setAnnotations] = useState<CanvasAnnotation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const activeImage = images.find((img) => img.id === activeImageId);

  // 이미지 업로드 처리
  const handleImageSelect = useCallback(async (file: File, type: "photo" | "camera") => {
    const dataUrl = await resizeImage(file, 2000);
    const newImage: ProjectImage = {
      id: crypto.randomUUID(),
      url: dataUrl,
      type,
      name: file.name || (type === "camera" ? "카메라 촬영" : "업로드 사진"),
      annotations: [],
      createdAt: new Date().toISOString(),
    };
    setImages((prev) => [...prev, newImage]);
    setActiveImageId(newImage.id);
    setAnnotations([]);
    addImage(newImage);
  }, [addImage]);

  // 이미지 선택
  const handleSelectImage = (id: string) => {
    setActiveImageId(id);
    const img = images.find((i) => i.id === id);
    setAnnotations(img?.annotations || []);
    setActiveImage(id);
  };

  // 이미지 삭제
  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (activeImageId === id) {
      setActiveImageId(undefined);
      setAnnotations([]);
    }
  };

  // 주석 변경
  const handleAnnotationsChange = (newAnnotations: CanvasAnnotation[]) => {
    setAnnotations(newAnnotations);
    // 활성 이미지의 주석 업데이트
    if (activeImageId) {
      setImages((prev) =>
        prev.map((img) =>
          img.id === activeImageId ? { ...img, annotations: newAnnotations } : img
        )
      );
    }
  };

  // 메시지 전송 (Mock AI)
  const handleSendMessage = async (content: string, imageData?: string) => {
    const userMsg: DesignChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      imageId: imageData ? "attached" : undefined,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    addChatMessage(userMsg);

    setIsStreaming(true);
    setStreamingText("");

    // API 호출 시도, 실패 시 Mock
    try {
      const body: Record<string, unknown> = {
        messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        projectId,
      };
      if (imageData) {
        body.image = imageData;
      }
      if (annotations.length > 0) {
        body.annotations = annotations;
      }

      const res = await fetch("/api/project/design-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  fullText += data.text;
                  setStreamingText(fullText);
                }
              } catch {
                // JSON 파싱 실패 무시
              }
            }
          }
        }

        const assistantMsg: DesignChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullText,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        addChatMessage(assistantMsg);
      } else {
        throw new Error("API not available");
      }
    } catch {
      // Mock 폴백
      const mockResponse = MOCK_RESPONSES[messages.length % MOCK_RESPONSES.length];
      let fullText = "";
      for (let i = 0; i < mockResponse.length; i += 3) {
        fullText = mockResponse.slice(0, i + 3);
        setStreamingText(fullText);
        await new Promise((r) => setTimeout(r, 15));
      }
      const assistantMsg: DesignChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: mockResponse,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      addChatMessage(assistantMsg);
    }

    setIsStreaming(false);
    setStreamingText("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* 이미지 썸네일 + 업로더 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <ImageUploader onImageSelect={handleImageSelect} />
        <div className="w-px h-6 bg-gray-300" />
        <ImageThumbnailList
          images={images}
          activeImageId={activeImageId}
          onSelect={handleSelectImage}
          onRemove={handleRemoveImage}
        />
        {images.length === 0 && (
          <p className="text-xs text-gray-400">도면 또는 사진을 업로드하세요</p>
        )}

        <button
          onClick={() => router.push(`/project/${projectId}/estimate`)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          견적산출 <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 메인: 좌 채팅 | 우 캔버스 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: AI 채팅 */}
        <DesignChat
          messages={messages}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          streamingText={streamingText}
          onRequestSnapshot={() => window.dispatchEvent(new Event("request-canvas-snapshot"))}
          className="w-[380px] min-w-[320px] flex-shrink-0 border-r border-gray-200"
        />

        {/* 우측: 캔버스 */}
        <div className="flex-1 flex flex-col min-w-0">
          <AnnotationCanvas
            backgroundImage={activeImage?.url}
            annotations={annotations}
            onAnnotationsChange={handleAnnotationsChange}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
