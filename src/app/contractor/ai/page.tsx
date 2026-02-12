"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, AlertTriangle, Lightbulb, BarChart3, RotateCcw, ThumbsUp, ThumbsDown } from "lucide-react";
import { useContractorAuth } from "@/hooks/useContractorAuth";
import { parseAIResponseTags, type AIResponseTagType } from "@/types/contractor-ai";

interface Message {
  role: "user" | "assistant";
  content: string;
  logId?: string; // ai_conversations ID (for feedback)
}

const QUICK_PROMPTS = [
  { label: "견적 검토", prompt: "현재 진행 중인 프로젝트의 견적서를 검토하고 적정성을 분석해줘" },
  { label: "리스크 분석", prompt: "현재 사업 현황을 바탕으로 리스크 요인을 분석하고 대응 방안을 제시해줘" },
  { label: "입찰 전략", prompt: "입찰 낙찰률을 높이기 위한 전략을 조언해줘" },
  { label: "일정 최적화", prompt: "공사 일정을 최적화하는 방법을 알려줘" },
  { label: "재무 분석", prompt: "현재 재무 현황을 분석하고 현금흐름 개선 방안을 제안해줘" },
  { label: "단가 확인", prompt: "타일 시공 적정 단가가 얼마야?" },
];

const TAG_CONFIG: Record<AIResponseTagType, { bg: string; border: string; text: string; icon: typeof AlertTriangle }> = {
  ALERT: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: AlertTriangle },
  SUGGESTION: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: Lightbulb },
  DATA: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", icon: BarChart3 },
};

const HISTORY_KEY = "inpick_ai_history";

// AI 대화 로깅 (fire-and-forget)
async function logConversation(
  sessionId: string,
  userMessage: string,
  assistantResponse: string,
  contractorId?: string,
  responseTimeMs?: number
): Promise<string | null> {
  try {
    const res = await fetch("/api/ai-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        userId: contractorId || null,
        agentType: "contractor_ai",
        userMessage,
        assistantResponse,
        contextType: "general",
        modelName: "claude-sonnet-4-5-20250929",
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

export default function ContractorAIPage() {
  const { contractorId, authChecked } = useContractorAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, "up" | "down">>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  // 대화 이력 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        setMessages([{ role: "assistant", content: "안녕하세요! INPICK 사업자 AI 비서입니다.\n\n입찰 전략, 견적 검토, 일정 관리, 재무 분석 등 무엇이든 도와드리겠습니다. 귀사의 현황을 바탕으로 맞춤 조언을 드립니다." }]);
      }
    } catch {
      setMessages([{ role: "assistant", content: "안녕하세요! INPICK 사업자 AI 비서입니다.\n\n입찰 전략, 견적 검토, 일정 관리, 재무 분석 등 무엇이든 도와드리겠습니다." }]);
    }
  }, []);

  // 대화 이력 저장
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    localStorage.removeItem(HISTORY_KEY);
    setMessages([{ role: "assistant", content: "새 대화를 시작합니다. 무엇을 도와드릴까요?" }]);
  };

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isStreaming) return;

    const userMsg: Message = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const startTime = Date.now();

    try {
      const res = await fetch("/api/contractor-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          contractorId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: err.error || "오류가 발생했습니다." };
          return copy;
        });
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullResponse += parsed.text;
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  copy[copy.length - 1] = { ...last, content: last.content + parsed.text };
                  return copy;
                });
              }
            } catch { /* skip */ }
          }
        }
      }

      // 대화 로깅 (fire-and-forget)
      if (fullResponse) {
        const elapsed = Date.now() - startTime;
        logConversation(sessionIdRef.current, msg, fullResponse, contractorId || undefined, elapsed).then((logId) => {
          if (logId) {
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { ...copy[copy.length - 1], logId };
              return copy;
            });
          }
        });
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "네트워크 오류가 발생했습니다." };
        return copy;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  // 피드백 전송
  const handleFeedback = async (logId: string, isHelpful: boolean) => {
    if (feedbackSent[logId]) return;
    setFeedbackSent((prev) => ({ ...prev, [logId]: isHelpful ? "up" : "down" }));
    try {
      await fetch("/api/ai-log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: logId, wasHelpful: isHelpful }),
      });
    } catch { /* silent */ }
  };

  if (!authChecked) return null;

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col">
      {/* 대화 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
            )}
            <div className={`max-w-lg ${msg.role === "user" ? "" : ""}`}>
              {msg.role === "user" ? (
                <div className="px-4 py-3 rounded-2xl text-sm bg-indigo-600 text-white whitespace-pre-wrap">
                  {msg.content}
                </div>
              ) : (
                <>
                  <AIMessageBlock content={msg.content} isStreaming={isStreaming && i === messages.length - 1} />
                  {msg.logId && !isStreaming && (
                    <div className="flex items-center gap-1 mt-1 ml-1">
                      <button
                        onClick={() => handleFeedback(msg.logId!, true)}
                        className={`p-1 rounded transition-colors ${
                          feedbackSent[msg.logId] === "up"
                            ? "text-green-600 bg-green-50"
                            : "text-gray-300 hover:text-green-500 hover:bg-green-50"
                        }`}
                        title="도움이 됐어요"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.logId!, false)}
                        className={`p-1 rounded transition-colors ${
                          feedbackSent[msg.logId] === "down"
                            ? "text-red-600 bg-red-50"
                            : "text-gray-300 hover:text-red-500 hover:bg-red-50"
                        }`}
                        title="개선이 필요해요"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 빠른 액션 */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((q) => (
              <button key={q.label} onClick={() => handleSend(q.prompt)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <button onClick={handleNewChat} title="새 대화"
            className="p-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RotateCcw className="w-5 h-5" />
          </button>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="입찰, 견적, 일정, 재무 관련 질문을 해주세요..."
            disabled={isStreaming}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50" />
          <button onClick={() => handleSend()} disabled={isStreaming || !input.trim()}
            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40">
            {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function AIMessageBlock({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  if (!content && isStreaming) {
    return (
      <div className="px-4 py-3 rounded-2xl text-sm bg-white border border-gray-200">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      </div>
    );
  }

  const parsed = parseAIResponseTags(content);

  return (
    <div className="space-y-2">
      {/* 태그 블록 */}
      {parsed.tags.map((tag, idx) => {
        const config = TAG_CONFIG[tag.type];
        const Icon = config.icon;
        return (
          <div key={idx} className={`${config.bg} ${config.border} border rounded-xl px-4 py-3`}>
            <div className="flex items-start gap-2">
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.text}`} />
              <p className={`text-sm ${config.text} whitespace-pre-wrap`}>{tag.content}</p>
            </div>
          </div>
        );
      })}

      {/* 일반 텍스트 */}
      {parsed.text && (
        <div className="px-4 py-3 rounded-2xl text-sm bg-white border border-gray-200 text-gray-800 whitespace-pre-wrap">
          {parsed.text}
        </div>
      )}
    </div>
  );
}
