"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Paperclip, Sparkles, Bot, User } from "lucide-react";
import type { DesignChatMessage } from "@/types/consumer-project";

interface DesignChatProps {
  messages: DesignChatMessage[];
  onSendMessage: (content: string, imageData?: string) => void;
  isStreaming: boolean;
  streamingText?: string;
  onRequestSnapshot?: () => void;
  className?: string;
}

const QUICK_PROMPTS = [
  "이 부분 바닥재 추천해줘",
  "벽 색상 변경하고 싶어",
  "수납공간 늘리는 방법은?",
  "조명 배치 추천해줘",
  "예산 맞추려면 어디를 줄여야 해?",
];

export default function DesignChat({
  messages,
  onSendMessage,
  isStreaming,
  streamingText,
  onRequestSnapshot,
  className = "",
}: DesignChatProps) {
  const [input, setInput] = useState("");
  const [attachImage, setAttachImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    if (attachImage && onRequestSnapshot) {
      // 캔버스 스냅샷 요청 → 이벤트로 받아서 전송
      const handler = (ev: Event) => {
        const snapshot = (ev as CustomEvent).detail;
        onSendMessage(input.trim(), snapshot);
        window.removeEventListener("canvas-snapshot", handler);
      };
      window.addEventListener("canvas-snapshot", handler);
      window.dispatchEvent(new Event("request-canvas-snapshot"));
    } else {
      onSendMessage(input.trim());
    }
    setInput("");
    setAttachImage(false);
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isStreaming) return;
    onSendMessage(prompt);
  };

  return (
    <div className={`flex flex-col bg-white ${className}`}>
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">AI 디자인 어시스턴트</h3>
          <p className="text-xs text-gray-500">Gemini AI 기반</p>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !streamingText && (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-purple-300 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-700 mb-2">디자인을 시작해볼까요?</h4>
            <p className="text-sm text-gray-500 mb-6">
              오른쪽 캔버스에서 도면이나 사진의 부위를 표시하고<br />
              AI에게 디자인 관련 질문을 해보세요.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium hover:bg-purple-100 transition-colors border border-purple-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-purple-600" />
              </div>
            )}
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-900 rounded-bl-md"
              }`}
            >
              {msg.imageId && (
                <div className="mb-2 text-xs opacity-70">
                  [캔버스 이미지 첨부됨]
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
            )}
          </div>
        ))}

        {/* 스트리밍 중인 메시지 */}
        {isStreaming && streamingText && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-purple-600" />
            </div>
            <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md bg-gray-100 text-sm text-gray-900 leading-relaxed">
              <div className="whitespace-pre-wrap">{streamingText}</div>
              <span className="inline-block w-1.5 h-4 bg-purple-500 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-purple-600" />
            </div>
            <div className="px-4 py-3 bg-gray-100 rounded-2xl rounded-bl-md">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 빠른 프롬프트 (메시지 있을 때) */}
      {messages.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleQuickPrompt(prompt)}
              disabled={isStreaming}
              className="flex-shrink-0 px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-xs hover:bg-gray-100 transition-colors border border-gray-200 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* 입력 바 */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAttachImage(!attachImage)}
            className={`p-2 rounded-lg transition-colors ${
              attachImage ? "bg-purple-100 text-purple-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
            title="캔버스 이미지 첨부"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={attachImage ? "이미지와 함께 질문하세요..." : "디자인 관련 질문을 입력하세요..."}
            className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        {attachImage && (
          <p className="text-xs text-purple-600 mt-1 ml-12">
            캔버스의 현재 화면이 AI에게 함께 전송됩니다
          </p>
        )}
      </form>
    </div>
  );
}
