"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Send, Loader2, X, Sparkles, Maximize2, Coins, ThumbsUp, ThumbsDown, Zap, WifiOff } from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import { useCredits } from "@/hooks/useCredits";
import { useAuth } from "@/hooks/useAuth";
import type { DesignChatMessage, GeneratedImage } from "@/types/consumer-project";
import type { ParsedFloorPlan, RoomData } from "@/types/floorplan";
import { loadFloorPlan } from "@/lib/services/drawing-service";
import { ROOM_TYPE_LABELS } from "@/types/floorplan";
import { CREDITS_PER_GENERATION, FREE_GENERATION_LIMIT } from "@/types/credits";
import FloorPlan2D from "@/components/viewer/FloorPlan2D";
import dynamic from "next/dynamic";

const CreditChargeModal = dynamic(() => import("@/components/project/CreditChargeModal"), {
  ssr: false,
});

const QUICK_PROMPTS = [
  "모던 미니멀 스타일로 전체 디자인 해줘",
  "북유럽 스칸디나비안 스타일 추천해줘",
  "동유럽 클래식 스타일로 꾸며줘",
  "내추럴 우드톤 따뜻한 느낌으로",
  "화이트 & 그레이 모노톤 인테리어",
];

// AI 대화 로깅
async function logDesignConversation(
  sessionId: string,
  userMessage: string,
  assistantResponse: string,
  userId?: string,
  responseTimeMs?: number
): Promise<string | null> {
  try {
    const res = await fetch("/api/ai-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        userId: userId || null,
        agentType: "consumer_design",
        userMessage,
        assistantResponse,
        contextType: "floor_plan",
        modelName: "gemini-2.5-flash-image",
        responseTimeMs,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.id;
    }
  } catch { /* silent */ }
  return null;
}

export default function AIDesignPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project, addChatMessage, addGeneratedImage, removeGeneratedImage, updateStatus } = useProjectState(projectId);
  const { user } = useAuth();
  const { credits, canGenerate, spendCredits } = useCredits();

  const [messages, setMessages] = useState<DesignChatMessage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [floorPlan, setFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [mobileView, setMobileView] = useState<"chat" | "canvas">("chat");
  const [feedbackSent, setFeedbackSent] = useState<Record<string, "up" | "down">>({});
  const [msgLogIds, setMsgLogIds] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const [geminiStatus, setGeminiStatus] = useState<"loading" | "active" | "mock">("loading");

  // 데이터 로드
  useEffect(() => {
    if (project?.design?.chatMessages) setMessages(project.design.chatMessages);
    if (project?.design?.generatedImages) setGeneratedImages(project.design.generatedImages);
    if (project?.drawingId) {
      loadFloorPlan(project.drawingId).then((plan) => { if (plan) setFloorPlan(plan); });
    }
  }, [project?.drawingId, project?.design?.chatMessages, project?.design?.generatedImages]);

  // 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Gemini API 상태 확인
  useEffect(() => {
    fetch("/api/project/gemini-status")
      .then((res) => res.json())
      .then((data) => setGeminiStatus(data.status === "configured" ? "active" : "mock"))
      .catch(() => setGeminiStatus("mock"));
  }, []);

  // 방 클릭 → 프롬프트에 컨텍스트 추가
  const handleRoomClick = (room: RoomData) => {
    setSelectedRoom(room);
    const label = ROOM_TYPE_LABELS[room.type] || room.name;
    setInput((prev) => prev ? prev : `${label} (${room.area}m²) 공간을 `);
  };

  // 메시지 전송 + 이미지 생성
  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;

    // 크레딧 확인
    if (!canGenerate()) {
      setShowChargeModal(true);
      return;
    }

    const userMsg: DesignChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    addChatMessage(userMsg);
    setInput("");
    setIsGenerating(true);
    const startTime = Date.now();

    try {
      // 크레딧 차감
      await spendCredits();

      // 이미지 생성 API 호출
      const roomContext = selectedRoom
        ? `${ROOM_TYPE_LABELS[selectedRoom.type]} ${selectedRoom.area}m²`
        : floorPlan ? `전체 ${floorPlan.totalArea}m², ${floorPlan.rooms.length}개 공간` : "";

      const res = await fetch("/api/project/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input.trim(),
          roomContext,
          floorPlanContext: floorPlan
            ? floorPlan.rooms.map((r) => `${r.name}(${r.area}m²)`).join(", ")
            : "",
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Gemini 상태 반영
        if (data.isMock) setGeminiStatus("mock");
        else if (data.isMock === false) setGeminiStatus("active");

        // 생성 이미지 저장
        const newImage: GeneratedImage = {
          id: crypto.randomUUID(),
          prompt: input.trim(),
          imageData: data.imageData,
          roomId: selectedRoom?.id,
          roomName: selectedRoom ? ROOM_TYPE_LABELS[selectedRoom.type] : "전체",
          description: data.description,
          createdAt: new Date().toISOString(),
        };
        setGeneratedImages((prev) => [...prev, newImage]);
        addGeneratedImage(newImage);

        // AI 응답 메시지
        const responseText = data.description || "디자인 이미지를 생성했습니다. 오른쪽 캔버스에서 확인해주세요.";
        const assistantMsg: DesignChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: responseText,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        addChatMessage(assistantMsg);

        // 대화 로깅 (fire-and-forget)
        const elapsed = Date.now() - startTime;
        logDesignConversation(
          sessionIdRef.current, input.trim(), responseText, user?.id, elapsed
        ).then((logId) => {
          if (logId) setMsgLogIds((prev) => ({ ...prev, [assistantMsg.id]: logId }));
        });
      } else {
        throw new Error("API error");
      }
    } catch {
      const errorMsg: DesignChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "이미지 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setIsGenerating(false);
    setSelectedRoom(null);
  }, [input, isGenerating, canGenerate, spendCredits, selectedRoom, floorPlan, addChatMessage, addGeneratedImage]);

  // 피드백 전송
  const handleFeedback = async (msgId: string, isHelpful: boolean) => {
    const logId = msgLogIds[msgId];
    if (!logId || feedbackSent[msgId]) return;
    setFeedbackSent((prev) => ({ ...prev, [msgId]: isHelpful ? "up" : "down" }));
    try {
      await fetch("/api/ai-log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: logId, wasHelpful: isHelpful }),
      });
    } catch { /* silent */ }
  };

  // 이미지 삭제
  const handleRemoveImage = (imageId: string) => {
    setGeneratedImages((prev) => prev.filter((img) => img.id !== imageId));
    removeGeneratedImage(imageId);
  };

  // 다음 단계
  const handleNext = () => {
    updateStatus("RENDERING");
    router.push(`/project/${projectId}/rendering`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-white border-b border-gray-200 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 whitespace-nowrap">AI 디자인</h2>
          {/* Gemini 상태 */}
          <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
            geminiStatus === "active"
              ? "bg-green-50 text-green-700 border border-green-200"
              : geminiStatus === "mock"
              ? "bg-orange-50 text-orange-600 border border-orange-200"
              : "bg-gray-50 text-gray-400 border border-gray-200"
          }`}>
            {geminiStatus === "active" ? (
              <><Zap className="w-3 h-3" /> Gemini API</>
            ) : geminiStatus === "mock" ? (
              <><WifiOff className="w-3 h-3" /> Mock 모드</>
            ) : (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
          </span>
          {selectedRoom && (
            <span className="hidden sm:inline px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
              {ROOM_TYPE_LABELS[selectedRoom.type]} 선택됨
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* 크레딧 표시 */}
          <button
            onClick={() => setShowChargeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            <Coins className="w-3.5 h-3.5" />
            {credits ? (
              credits.freeGenerationsUsed < FREE_GENERATION_LIMIT
                ? `무료 ${FREE_GENERATION_LIMIT - credits.freeGenerationsUsed}회`
                : `${credits.balance} 크레딧`
            ) : "로그인 필요"}
          </button>
          {generatedImages.length > 0 && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              3D 렌더링 <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 모바일 탭 전환 */}
      <div className="flex md:hidden border-b border-gray-200 bg-white">
        <button
          onClick={() => setMobileView("chat")}
          className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
            mobileView === "chat" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"
          }`}
        >
          AI 채팅
        </button>
        <button
          onClick={() => setMobileView("canvas")}
          className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
            mobileView === "canvas" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"
          }`}
        >
          디자인 갤러리 {generatedImages.length > 0 && `(${generatedImages.length})`}
        </button>
      </div>

      {/* 메인: 좌 채팅 | 우 캔버스 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: AI 채팅 */}
        <div className={`w-full md:w-[380px] md:min-w-[320px] flex-shrink-0 border-r border-gray-200 flex-col bg-white ${
          mobileView === "chat" ? "flex" : "hidden md:flex"
        }`}>
          {/* 채팅 메시지 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Sparkles className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-gray-900 mb-1">AI 디자인 어시스턴트</h3>
                <p className="text-xs text-gray-500 mb-4">
                  원하는 인테리어 스타일을 설명하면<br />AI가 디자인 이미지를 생성합니다
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-full hover:bg-blue-100 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "assistant" && msgLogIds[msg.id] && !isGenerating && (
                    <div className="flex items-center gap-1 mt-1 ml-1">
                      <button
                        onClick={() => handleFeedback(msg.id, true)}
                        className={`p-1 rounded transition-colors ${
                          feedbackSent[msg.id] === "up"
                            ? "text-green-600 bg-green-50"
                            : "text-gray-300 hover:text-green-500 hover:bg-green-50"
                        }`}
                        title="도움이 됐어요"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, false)}
                        className={`p-1 rounded transition-colors ${
                          feedbackSent[msg.id] === "down"
                            ? "text-red-600 bg-red-50"
                            : "text-gray-300 hover:text-red-500 hover:bg-red-50"
                        }`}
                        title="개선이 필요해요"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  디자인 이미지를 생성하고 있습니다...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 퀵 프롬프트 */}
          {messages.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 overflow-x-auto">
              <div className="flex gap-1.5">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="px-2.5 py-1 bg-gray-50 text-gray-600 text-[11px] rounded-full hover:bg-gray-100 whitespace-nowrap shrink-0"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 입력 */}
          <div className="p-3 border-t border-gray-200">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="원하는 인테리어 스타일을 입력하세요..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={isGenerating}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                className="self-end px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              이미지 생성 1회 = {CREDITS_PER_GENERATION} 크레딧 ({(CREDITS_PER_GENERATION * 100).toLocaleString()}원)
            </p>
          </div>
        </div>

        {/* 우측: 캔버스 */}
        <div className={`flex-1 flex-col min-w-0 bg-gray-50 ${
          mobileView === "canvas" ? "flex" : "hidden md:flex"
        }`}>
          {/* 평면도 (공간 클릭 가능) */}
          {floorPlan && (
            <div className="border-b border-gray-200 bg-white">
              <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-600">
                  평면도 (공간 클릭 → 해당 공간 디자인)
                </span>
              </div>
              <FloorPlan2D
                floorPlan={floorPlan}
                onRoomClick={handleRoomClick}
                selectedRoomId={selectedRoom?.id}
                className="max-h-[180px] border-0 rounded-none"
              />
            </div>
          )}

          {/* 생성된 이미지 갤러리 */}
          <div className="flex-1 overflow-y-auto p-4">
            {generatedImages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">AI가 생성한 디자인 이미지가 여기에 표시됩니다</p>
                  <p className="text-xs mt-1">왼쪽에서 원하는 스타일을 입력해보세요</p>
                  {geminiStatus === "mock" && (
                    <p className="text-xs text-orange-500 mt-2">
                      Mock 모드: 실제 이미지 대신 플레이스홀더가 생성됩니다
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {generatedImages.map((img) => (
                  <div key={img.id} className="relative group bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <img
                      src={img.imageData}
                      alt={img.prompt}
                      className="w-full aspect-[4/3] object-cover cursor-pointer"
                      onClick={() => setExpandedImage(img.id)}
                    />
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setExpandedImage(img.id)}
                        className="p-1.5 bg-white/90 rounded-lg shadow-sm hover:bg-white"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleRemoveImage(img.id)}
                        className="p-1.5 bg-white/90 rounded-lg shadow-sm hover:bg-red-50"
                      >
                        <X className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-500 truncate">{img.roomName} | {img.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 이미지 확대 모달 */}
      {expandedImage && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8" onClick={() => setExpandedImage(null)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={generatedImages.find((img) => img.id === expandedImage)?.imageData}
              alt="확대 보기"
              className="w-full rounded-xl"
            />
            <p className="text-white text-sm mt-3 text-center">
              {generatedImages.find((img) => img.id === expandedImage)?.prompt}
            </p>
          </div>
        </div>
      )}

      {/* 크레딧 충전 모달 */}
      <CreditChargeModal open={showChargeModal} onClose={() => setShowChargeModal(false)} />
    </div>
  );
}
