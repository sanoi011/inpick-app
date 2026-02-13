"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, ArrowDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_type: "consumer" | "contractor";
  sender_name: string | null;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
}

interface ChatWindowProps {
  roomId: string;
  currentUserId: string;
  currentUserType: "consumer" | "contractor";
  currentUserName: string;
  otherUserName?: string;
  className?: string;
}

export function ChatWindow({
  roomId,
  currentUserId,
  currentUserType,
  currentUserName,
  otherUserName,
  className = "",
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 메시지 로드
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?roomId=${roomId}&limit=50`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // 읽음 처리
  useEffect(() => {
    if (messages.length > 0) {
      fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, readerId: currentUserId }),
      }).catch(() => {});
    }
  }, [messages.length, roomId, currentUserId]);

  // Supabase Realtime 구독
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { new: ChatMessage }) => {
          setMessages((prev) => {
            // 중복 방지
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // 자동 스크롤
  useEffect(() => {
    if (!showScrollBtn) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, showScrollBtn]);

  // 스크롤 감지
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  };

  // 메시지 전송
  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const content = input.trim();
    setInput("");
    setSending(true);

    // 옵티미스틱 업데이트
    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      room_id: roomId,
      sender_id: currentUserId,
      sender_type: currentUserType,
      sender_name: currentUserName,
      content,
      message_type: "text",
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          senderId: currentUserId,
          senderType: currentUserType,
          senderName: currentUserName,
          content,
        }),
      });
    } catch {
      // 실패 시 옵티미스틱 제거
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 날짜 구분선
  const shouldShowDate = (idx: number) => {
    if (idx === 0) return true;
    const prev = new Date(messages[idx - 1].created_at).toDateString();
    const curr = new Date(messages[idx].created_at).toDateString();
    return prev !== curr;
  };

  return (
    <div className={`flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden ${className}`}>
      {/* 헤더 */}
      {otherUserName && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">{otherUserName}</h3>
        </div>
      )}

      {/* 메시지 영역 */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[300px] max-h-[500px]"
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            대화를 시작해보세요
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id}>
                {shouldShowDate(idx) && (
                  <div className="flex items-center justify-center my-3">
                    <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] rounded-full">
                      {formatDate(msg.created_at)}
                    </span>
                  </div>
                )}
                {msg.message_type === "system" ? (
                  <div className="text-center text-xs text-gray-400 py-1">{msg.content}</div>
                ) : (
                  <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && msg.sender_name && (
                        <p className="text-[10px] text-gray-400 mb-0.5 ml-1">{msg.sender_name}</p>
                      )}
                      <div className="flex items-end gap-1">
                        {isMe && (
                          <span className="text-[9px] text-gray-300 mb-0.5">{formatTime(msg.created_at)}</span>
                        )}
                        <div
                          className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                            isMe
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-gray-100 text-gray-800 rounded-bl-md"
                          }`}
                        >
                          {msg.content}
                        </div>
                        {!isMe && (
                          <span className="text-[9px] text-gray-300 mb-0.5">{formatTime(msg.created_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 스크롤 다운 버튼 */}
      {showScrollBtn && (
        <div className="flex justify-center -mt-10 mb-2 relative z-10">
          <button
            onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="p-1.5 bg-white border border-gray-200 rounded-full shadow-md hover:bg-gray-50"
          >
            <ArrowDown className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}

      {/* 입력 */}
      <div className="px-3 py-2 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="메시지를 입력하세요..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
