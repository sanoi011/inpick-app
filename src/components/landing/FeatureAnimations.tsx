"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare, Sparkles, Bot, Send,
  Building2, Shield, Star, FileCheck, Award, ChevronRight,
  Database, ArrowRight, RefreshCw, TrendingUp,
  Maximize, Layers, PaintBucket,
} from "lucide-react";

// ─── 1. AI 상담 애니메이션 ─────────────────────────────
// 프롬프트 입력 → AI 응답 → 완성된 디자인 이미지

const AI_PROMPTS = [
  "거실을 모던한 스타일로 바꾸고 싶어요",
  "화이트 톤 마루 + 그레이 벽지로요",
];

const AI_RESPONSES = [
  "네, 모던 스타일 거실을 추천드릴게요!",
  "강마루 화이트오크 + 실크벽지 추천합니다",
  "예상 견적: 1,850만원 (25평 기준)",
];

export function AIConsultAnimation() {
  const [phase, setPhase] = useState(0); // 0: typing, 1: AI respond, 2: design reveal, 3: reset pause
  const [charIdx, setCharIdx] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string; visible: boolean }[]>([]);
  const [showDesign, setShowDesign] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const tick = () => {
      if (phase === 0) {
        // User typing
        const prompt = AI_PROMPTS[msgIdx % AI_PROMPTS.length];
        if (charIdx < prompt.length) {
          setCharIdx((c) => c + 1);
          timerRef.current = setTimeout(tick, 40 + Math.random() * 30);
        } else {
          // Finish typing → add message
          setMessages((prev) => [...prev, { role: "user", text: prompt, visible: true }]);
          setCharIdx(0);
          setPhase(1);
          timerRef.current = setTimeout(tick, 600);
        }
      } else if (phase === 1) {
        // AI responds one by one
        if (msgIdx < AI_RESPONSES.length) {
          setMessages((prev) => [...prev, { role: "ai", text: AI_RESPONSES[msgIdx], visible: true }]);
          setMsgIdx((i) => i + 1);
          timerRef.current = setTimeout(tick, 700);
        } else {
          setPhase(2);
          setShowDesign(true);
          timerRef.current = setTimeout(tick, 3000);
        }
      } else if (phase === 2) {
        // Show design, then reset
        setPhase(3);
        timerRef.current = setTimeout(tick, 1000);
      } else {
        // Reset
        setMessages([]);
        setCharIdx(0);
        setMsgIdx(0);
        setShowDesign(false);
        setPhase(0);
        timerRef.current = setTimeout(tick, 500);
      }
    };
    timerRef.current = setTimeout(tick, 800);
    return () => clearTimeout(timerRef.current);
  }, [phase, charIdx, msgIdx]);

  const currentTyping = phase === 0 ? AI_PROMPTS[msgIdx % AI_PROMPTS.length].slice(0, charIdx) : "";

  return (
    <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl overflow-hidden p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
        <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <span className="text-white/90 text-sm font-medium">INPICK AI 상담</span>
        <span className="ml-auto flex items-center gap-1 text-green-400 text-xs">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> 온라인
        </span>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden space-y-2 relative">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slideUp`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-500 text-white rounded-br-md"
                  : "bg-white/10 text-white/90 rounded-bl-md"
              }`}
            >
              {msg.role === "ai" && <Sparkles className="w-3 h-3 text-yellow-400 inline mr-1" />}
              {msg.text}
            </div>
          </div>
        ))}

        {/* Design reveal overlay */}
        {showDesign && (
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent flex items-end justify-center pb-4 animate-fadeIn">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 w-[90%]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-white text-xs font-semibold">AI 디자인 완성</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {["bg-amber-700/60", "bg-stone-400/60", "bg-slate-500/60"].map((bg, i) => (
                  <div key={i} className={`${bg} rounded-lg aspect-square flex items-center justify-center animate-scaleIn`} style={{ animationDelay: `${i * 150}ms` }}>
                    <span className="text-white/80 text-[9px]">{["마루", "벽지", "천장"][i]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-center">
                <span className="text-lg font-bold text-white">1,850</span>
                <span className="text-white/60 text-xs ml-0.5">만원</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mt-2 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
        <MessageSquare className="w-4 h-4 text-white/40" />
        <span className="flex-1 text-xs text-white/60">
          {currentTyping}
          {phase === 0 && <span className="animate-blink text-white/80">|</span>}
          {phase !== 0 && "메시지를 입력하세요..."}
        </span>
        <Send className="w-4 h-4 text-blue-400" />
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-fadeIn { animation: fadeIn 0.6s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.4s ease-out both; }
        .animate-blink { animation: blink 0.8s infinite; }
      `}</style>
    </div>
  );
}

// ─── 2. 실시간 단가연동 애니메이션 ──────────────────────
// 3대 공식 기관에서 데이터가 중앙으로 흘러오는 모션

const SOURCES = [
  { name: "한국물가협회", icon: Database, color: "blue", label: "자재 단가" },
  { name: "대한건설협회", icon: TrendingUp, color: "indigo", label: "노임 단가" },
  { name: "조달청", icon: Building2, color: "violet", label: "관급 단가" },
];

const PRICE_ITEMS = [
  { name: "강마루 (화이트오크)", price: "42,000", unit: "m²" },
  { name: "실크벽지 (LG)", price: "8,500", unit: "m²" },
  { name: "방수공사 (욕실)", price: "85,000", unit: "m²" },
  { name: "타일시공 (300x600)", price: "45,000", unit: "m²" },
  { name: "도배 인건비", price: "280,000", unit: "일" },
  { name: "전기 배선공사", price: "65,000", unit: "개소" },
];

export function PriceSyncAnimation() {
  const [activeSource, setActiveSource] = useState(0);
  const [priceIdx, setPriceIdx] = useState(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSource((prev) => (prev + 1) % 3);
      setUpdating(true);
      setTimeout(() => {
        setPriceIdx((prev) => (prev + 1) % PRICE_ITEMS.length);
        setUpdating(false);
      }, 600);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl overflow-hidden p-4 flex flex-col">
      {/* Sources row */}
      <div className="flex justify-between gap-2 mb-4">
        {SOURCES.map((src, i) => {
          const Icon = src.icon;
          const isActive = activeSource === i;
          const colors: Record<string, string> = {
            blue: isActive ? "bg-blue-500 text-white shadow-lg shadow-blue-200" : "bg-blue-50 text-blue-600",
            indigo: isActive ? "bg-indigo-500 text-white shadow-lg shadow-indigo-200" : "bg-indigo-50 text-indigo-600",
            violet: isActive ? "bg-violet-500 text-white shadow-lg shadow-violet-200" : "bg-violet-50 text-violet-600",
          };
          return (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${colors[src.color]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[9px] text-gray-500 font-medium text-center leading-tight">{src.name}</span>
            </div>
          );
        })}
      </div>

      {/* Data flow arrows */}
      <div className="flex justify-center mb-3 relative h-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="absolute" style={{ left: `${17 + i * 33}%` }}>
            <div
              className={`flex flex-col items-center transition-opacity duration-300 ${activeSource === i ? "opacity-100" : "opacity-20"}`}
            >
              <div className="w-0.5 h-3 bg-blue-400 rounded-full" />
              <ChevronRight className="w-3 h-3 text-blue-500 rotate-90 -mt-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Central price display */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-3 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${updating ? "animate-spin" : ""}`} />
            <span className="text-xs font-semibold text-gray-800">실시간 단가 업데이트</span>
          </div>
          <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">LIVE</span>
        </div>

        {/* Price items with scroll effect */}
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map((offset) => {
            const item = PRICE_ITEMS[(priceIdx + offset) % PRICE_ITEMS.length];
            const isNew = offset === 0 && updating;
            return (
              <div
                key={`${priceIdx}-${offset}`}
                className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-all duration-500 ${
                  isNew ? "bg-blue-50 border border-blue-200" : offset === 0 ? "bg-gray-50" : ""
                }`}
              >
                <span className={`text-[11px] ${offset === 0 ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                  {item.name}
                </span>
                <div className="flex items-center gap-1">
                  <span className={`text-[11px] font-bold ${isNew ? "text-blue-600" : "text-gray-900"}`}>
                    {isNew ? "..." : `${item.price}원`}
                  </span>
                  <span className="text-[9px] text-gray-400">/{item.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Shimmer on update */}
        {updating && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/40 to-transparent animate-shimmer" />
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer { animation: shimmer 0.8s ease-out; }
      `}</style>
    </div>
  );
}

// ─── 3. 3D 견적뷰어 애니메이션 ──────────────────────────
// 견적 항목이 자동 스크롤되며 보이는 모션

const ESTIMATE_ROWS = [
  { room: "거실", trade: "바닥재", item: "강마루 화이트오크", qty: "16.2m²", price: "680,400" },
  { room: "거실", trade: "도배", item: "실크벽지 (LG하우시스)", qty: "48.5m²", price: "412,250" },
  { room: "거실", trade: "천장", item: "텍스 천장 도배", qty: "16.2m²", price: "129,600" },
  { room: "안방", trade: "바닥재", item: "강마루 내추럴오크", qty: "11.4m²", price: "478,800" },
  { room: "안방", trade: "도배", item: "합지벽지 (신한)", qty: "38.2m²", price: "248,300" },
  { room: "욕실", trade: "방수", item: "우레탄 방수 (바닥+벽)", qty: "8.2m²", price: "697,000" },
  { room: "욕실", trade: "타일", item: "300x600 포세린 타일", qty: "22.6m²", price: "1,017,000" },
  { room: "욕실", trade: "위생", item: "양변기 (TOTO)", qty: "1대", price: "450,000" },
  { room: "주방", trade: "타일", item: "600x600 벽 타일", qty: "6.8m²", price: "306,000" },
  { room: "주방", trade: "설비", item: "싱크대 교체", qty: "1식", price: "1,200,000" },
  { room: "현관", trade: "타일", item: "포세린 바닥타일", qty: "3.4m²", price: "153,000" },
  { room: "현관", trade: "도배", item: "합지벽지", qty: "12.1m²", price: "78,650" },
];

export function EstimateViewerAnimation() {
  const [scrollY, setScrollY] = useState(0);
  const [activeRoom, setActiveRoom] = useState(0);
  const rooms = ["거실", "안방", "욕실", "주방"];

  useEffect(() => {
    const interval = setInterval(() => {
      setScrollY((prev) => {
        const next = prev + 1;
        if (next > ESTIMATE_ROWS.length * 32) return 0;
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRoom((prev) => (prev + 1) % rooms.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [rooms.length]);

  return (
    <div className="relative w-full aspect-[4/3] bg-white rounded-xl overflow-hidden border border-gray-200 flex flex-col">
      {/* 3D mockup header */}
      <div className="bg-slate-800 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-white/80" />
          <span className="text-xs font-semibold text-white/90">INPICK 3D 견적 뷰어</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Maximize className="w-3 h-3 text-white/50" />
          <PaintBucket className="w-3 h-3 text-white/50" />
        </div>
      </div>

      {/* Split view: 3D preview + estimate */}
      <div className="flex-1 flex min-h-0">
        {/* Left: 3D room mockup */}
        <div className="w-[45%] bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden border-r border-gray-200">
          {/* Simple room wireframe */}
          <svg viewBox="0 0 200 160" className="w-full h-full">
            {/* Floor */}
            <polygon points="30,100 170,100 190,140 10,140" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5" />
            {/* Back wall */}
            <polygon points="30,30 170,30 170,100 30,100" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="0.5" />
            {/* Left wall */}
            <polygon points="10,140 30,100 30,30 10,50" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5" />

            {/* Room highlight */}
            <rect
              x={40 + activeRoom * 30}
              y={50}
              width={35}
              height={45}
              fill="rgba(59,130,246,0.15)"
              stroke="#3B82F6"
              strokeWidth="1"
              strokeDasharray="3 2"
              className="transition-all duration-700"
            />

            {/* Room label */}
            <text
              x={57 + activeRoom * 30}
              y={76}
              textAnchor="middle"
              className="fill-blue-600 text-[8px] font-semibold transition-all duration-700"
            >
              {rooms[activeRoom]}
            </text>
          </svg>
        </div>

        {/* Right: scrolling estimate */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {rooms.map((room, i) => (
              <button
                key={room}
                className={`flex-1 text-[9px] py-1.5 font-medium transition-colors ${
                  activeRoom === i ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50" : "text-gray-400"
                }`}
              >
                {room}
              </button>
            ))}
          </div>

          {/* Table header */}
          <div className="flex items-center px-2 py-1 bg-gray-50 border-b border-gray-100 text-[8px] text-gray-500 font-medium">
            <span className="w-[30%]">공종</span>
            <span className="w-[35%]">품명</span>
            <span className="w-[15%] text-right">수량</span>
            <span className="w-[20%] text-right">금액</span>
          </div>

          {/* Scrolling rows */}
          <div className="flex-1 overflow-hidden relative">
            <div
              className="transition-transform duration-100 ease-linear"
              style={{ transform: `translateY(-${scrollY}px)` }}
            >
              {[...ESTIMATE_ROWS, ...ESTIMATE_ROWS].map((row, i) => (
                <div
                  key={i}
                  className={`flex items-center px-2 py-1.5 border-b border-gray-50 ${
                    row.room === rooms[activeRoom] ? "bg-blue-50/30" : ""
                  }`}
                >
                  <span className="w-[30%] text-[8px] text-gray-500">{row.trade}</span>
                  <span className="w-[35%] text-[8px] text-gray-800 truncate">{row.item}</span>
                  <span className="w-[15%] text-[8px] text-gray-500 text-right">{row.qty}</span>
                  <span className="w-[20%] text-[9px] text-gray-900 font-semibold text-right">{row.price}</span>
                </div>
              ))}
            </div>

            {/* Gradient overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          </div>

          {/* Total */}
          <div className="px-2 py-1.5 bg-blue-600 flex items-center justify-between">
            <span className="text-[9px] text-blue-100">총 견적</span>
            <span className="text-sm font-bold text-white">18,520,000원</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 4. 전문업체 매칭 애니메이션 ─────────────────────────
// 사업자등록증 → 면허 → 포트폴리오 → 검증 완료

const VERIFY_STEPS = [
  {
    title: "사업자등록증",
    icon: FileCheck,
    color: "blue",
    detail: "인테리어 종합건설업",
    sub: "사업자번호: 123-45-*****",
  },
  {
    title: "건설업 면허",
    icon: Shield,
    color: "emerald",
    detail: "실내건축공사업 면허",
    sub: "면허번호: 서울-인테리어-2024-***",
  },
  {
    title: "시공 포트폴리오",
    icon: Star,
    color: "amber",
    detail: "84m² 아파트 시공 42건",
    sub: "평균 평점: 4.8 / 5.0",
  },
  {
    title: "검증 완료",
    icon: Award,
    color: "violet",
    detail: "INPICK 인증 전문업체",
    sub: "종합 신뢰도: 96점",
  },
];

export function ContractorMatchAnimation() {
  const [step, setStep] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<number[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVerifying(true);
      setTimeout(() => {
        setVerified((prev) => {
          const next = [...prev, step];
          return next;
        });
        setVerifying(false);

        setTimeout(() => {
          setStep((prev) => {
            const next = (prev + 1) % VERIFY_STEPS.length;
            if (next === 0) {
              setVerified([]);
            }
            return next;
          });
        }, 800);
      }, 1200);
    }, 2500);
    return () => clearInterval(interval);
  }, [step]);

  const current = VERIFY_STEPS[step];
  const Icon = current.icon;
  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string; progress: string }> = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", iconBg: "bg-blue-500", progress: "bg-blue-500" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", iconBg: "bg-emerald-500", progress: "bg-emerald-500" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", iconBg: "bg-amber-500", progress: "bg-amber-500" },
    violet: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", iconBg: "bg-violet-500", progress: "bg-violet-500" },
  };
  const colors = colorMap[current.color];

  return (
    <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-gray-50 to-indigo-50 rounded-xl overflow-hidden p-4 flex flex-col">
      {/* Header */}
      <div className="text-center mb-3">
        <span className="text-[10px] text-gray-500 font-medium">업체 검증 프로세스</span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-3 mb-4">
        {VERIFY_STEPS.map((s, i) => {
          const StepIcon = s.icon;
          const isVerified = verified.includes(i);
          const isCurrent = i === step;
          return (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                isVerified
                  ? "bg-green-500 text-white scale-100"
                  : isCurrent
                  ? `${colorMap[s.color].iconBg} text-white scale-110`
                  : "bg-gray-200 text-gray-400 scale-100"
              }`}>
                {isVerified ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <StepIcon className="w-4 h-4" />
                )}
              </div>
              {i < 3 && <ArrowRight className={`w-3 h-3 ${isVerified ? "text-green-400" : "text-gray-300"}`} />}
            </div>
          );
        })}
      </div>

      {/* Current verification card */}
      <div className={`flex-1 rounded-xl border-2 ${colors.border} ${colors.bg} p-4 flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden`}>
        <div className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center mb-3 shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <span className={`text-sm font-bold ${colors.text} mb-1`}>{current.title}</span>
        <span className="text-xs text-gray-600 mb-0.5">{current.detail}</span>
        <span className="text-[10px] text-gray-400">{current.sub}</span>

        {/* Verification progress bar */}
        {verifying && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
            <div className={`h-full ${colors.progress} animate-fillBar rounded-r-full`} />
          </div>
        )}

        {/* Verified stamp */}
        {verified.includes(step) && !verifying && (
          <div className="absolute top-3 right-3 animate-stampIn">
            <div className="bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <path d="M5 13l4 4L19 7" />
              </svg>
              확인
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fillBar {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes stampIn {
          0% { opacity: 0; transform: scale(2) rotate(-12deg); }
          50% { opacity: 1; transform: scale(0.9) rotate(-12deg); }
          100% { opacity: 1; transform: scale(1) rotate(-12deg); }
        }
        .animate-fillBar { animation: fillBar 1.2s ease-out; }
        .animate-stampIn { animation: stampIn 0.4s ease-out; }
      `}</style>
    </div>
  );
}
