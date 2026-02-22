"use client";

import { useState, useEffect } from "react";

// ─── 1. AI 상담 애니메이션 ─────────────────────────────
// 클린 대시보드 스타일 — 입력 → 분석 → 결과 플로우

export function AIConsultAnimation() {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((p) => (p + 1) % 60);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (phase < 15) setProgress(Math.round((phase / 14) * 30));
    else if (phase < 35) setProgress(30 + Math.round(((phase - 15) / 19) * 50));
    else if (phase < 50) setProgress(80 + Math.round(((phase - 35) / 14) * 20));
    else setProgress(100);
  }, [phase]);

  const isAnalyzing = phase >= 10 && phase < 40;
  const showResult = phase >= 42;

  return (
    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)" }}>
      {/* Grid pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]">
        <defs>
          <pattern id="grid-ai" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-ai)" />
      </svg>

      <div className="relative h-full p-5 flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-medium text-slate-400 tracking-wide uppercase">Design Analysis</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-[3px] bg-slate-700/50 rounded-full mb-5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #3B82F6, #06B6D4)",
            }} />
        </div>

        {/* Main visualization area */}
        <div className="flex-1 flex gap-3">
          {/* Left: Input fields */}
          <div className="w-[42%] flex flex-col gap-2">
            {["공간 유형", "선호 스타일", "예산 범위", "면적"].map((label, i) => (
              <div key={label}
                className="rounded-lg px-3 py-2 transition-all duration-500"
                style={{
                  backgroundColor: phase > i * 3 ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${phase > i * 3 ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.05)"}`,
                }}>
                <span className="text-[9px] text-slate-500 block mb-0.5">{label}</span>
                <div className="h-2.5 rounded-sm overflow-hidden"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.03)",
                    width: phase > i * 3 + 2 ? "100%" : "0%",
                  }}>
                  <div className="h-full rounded-sm transition-all duration-700"
                    style={{
                      width: phase > i * 3 + 2 ? `${60 + i * 10}%` : "0%",
                      background: "linear-gradient(90deg, rgba(59,130,246,0.3), rgba(6,182,212,0.3))",
                    }} />
                </div>
              </div>
            ))}
          </div>

          {/* Right: Analysis visualization */}
          <div className="flex-1 flex flex-col gap-2">
            {/* Processing node graph */}
            <div className="flex-1 rounded-lg p-3 relative overflow-hidden"
              style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              {isAnalyzing && (
                <svg className="absolute inset-0 w-full h-full">
                  {/* Animated connection lines */}
                  {[0, 1, 2].map((i) => (
                    <line key={i}
                      x1={`${20 + i * 15}%`} y1={`${30 + i * 15}%`}
                      x2={`${50 + i * 10}%`} y2={`${25 + i * 20}%`}
                      stroke="rgba(59,130,246,0.2)" strokeWidth="1"
                      strokeDasharray="4 4"
                      className="anim-dash" />
                  ))}
                  {/* Nodes */}
                  {[
                    { cx: "25%", cy: "35%", r: 4 },
                    { cx: "45%", cy: "25%", r: 5 },
                    { cx: "65%", cy: "50%", r: 4 },
                    { cx: "35%", cy: "65%", r: 3 },
                    { cx: "75%", cy: "35%", r: 6 },
                    { cx: "55%", cy: "70%", r: 3 },
                  ].map((n, i) => (
                    <circle key={i} cx={n.cx} cy={n.cy} r={n.r}
                      fill={i === 4 ? "rgba(6,182,212,0.6)" : "rgba(59,130,246,0.4)"}
                      className="anim-pulse-node"
                      style={{ animationDelay: `${i * 0.3}s` }} />
                  ))}
                </svg>
              )}

              {showResult && (
                <div className="absolute inset-0 flex items-center justify-center anim-fade-in">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1 tracking-tight"
                      style={{ fontFeatureSettings: "'tnum'" }}>1,850
                      <span className="text-sm font-normal text-slate-400 ml-1">만원</span>
                    </div>
                    <div className="text-[10px] text-cyan-400/80 font-medium">견적 산출 완료</div>
                  </div>
                </div>
              )}

              {!isAnalyzing && !showResult && (
                <div className="h-full flex items-center justify-center">
                  <span className="text-[10px] text-slate-600">AI 분석 대기</span>
                </div>
              )}
            </div>

            {/* Bottom metric cards */}
            <div className="flex gap-1.5">
              {[
                { label: "자재", value: "42", unit: "항목" },
                { label: "공종", value: "17", unit: "개" },
                { label: "정확도", value: "98", unit: "%" },
              ].map((m) => (
                <div key={m.label}
                  className="flex-1 rounded-lg px-2 py-1.5 text-center transition-all duration-500"
                  style={{
                    backgroundColor: showResult ? "rgba(59,130,246,0.06)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${showResult ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)"}`,
                  }}>
                  <div className="text-xs font-semibold text-white/80"
                    style={{ opacity: showResult ? 1 : 0.3, transition: "opacity 0.5s" }}>
                    {showResult ? m.value : "—"}
                  </div>
                  <div className="text-[8px] text-slate-500">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes dash { to { stroke-dashoffset: -24; } }
        @keyframes pulseNode { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .anim-dash { animation: dash 1.5s linear infinite; }
        .anim-pulse-node { animation: pulseNode 2s ease-in-out infinite; }
        .anim-fade-in { animation: fadeIn 0.6s ease-out; }
      `}</style>
    </div>
  );
}

// ─── 2. 실시간 단가연동 애니메이션 ──────────────────────
// 데이터 스트림 시각화 — 3개 소스에서 중앙으로 흐르는 파이프라인

const SOURCES = [
  { name: "한국물가협회", label: "자재", color: "#3B82F6" },
  { name: "대한건설협회", label: "노임", color: "#6366F1" },
  { name: "조달청", label: "관급", color: "#8B5CF6" },
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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      if (tick % 15 === 0) {
        setActiveSource((prev) => (prev + 1) % 3);
        setPriceIdx((prev) => (prev + 1) % PRICE_ITEMS.length);
      }
    }, 130);
    return () => clearInterval(interval);
  }, [tick]);

  return (
    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)" }}>
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]">
        <defs>
          <pattern id="grid-ps" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-ps)" />
      </svg>

      <div className="relative h-full p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 anim-status-pulse" />
            <span className="text-[11px] font-medium text-slate-400 tracking-wide uppercase">Live Data Feed</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            SYNCED
          </span>
        </div>

        {/* Source indicators */}
        <div className="flex gap-2 mb-4">
          {SOURCES.map((src, i) => (
            <div key={i}
              className="flex-1 rounded-lg px-2.5 py-2 transition-all duration-500"
              style={{
                backgroundColor: activeSource === i ? `${src.color}10` : "rgba(255,255,255,0.02)",
                border: `1px solid ${activeSource === i ? `${src.color}30` : "rgba(255,255,255,0.05)"}`,
              }}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: activeSource === i ? src.color : "rgba(255,255,255,0.15)" }} />
                <span className="text-[8px] text-slate-500 font-medium">{src.label}</span>
              </div>
              <span className="text-[9px] text-slate-400 leading-none">{src.name}</span>
            </div>
          ))}
        </div>

        {/* Data stream visualization */}
        <div className="h-5 mb-3 flex items-center justify-center">
          <svg className="w-full h-5" viewBox="0 0 300 20">
            {/* Flowing particles */}
            {[0, 1, 2, 3, 4].map((i) => (
              <circle key={i} r="2"
                fill={SOURCES[activeSource].color}
                opacity={0.4 + (i * 0.12)}
                className="anim-flow-dot"
                style={{ animationDelay: `${i * 0.3}s` }}>
                <animate attributeName="cx" from="40" to="260" dur="1.5s"
                  repeatCount="indefinite" begin={`${i * 0.3}s`} />
                <animate attributeName="cy" from="10" to="10" dur="1.5s"
                  repeatCount="indefinite" begin={`${i * 0.3}s`} />
              </circle>
            ))}
            {/* Track line */}
            <line x1="40" y1="10" x2="260" y2="10"
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </svg>
        </div>

        {/* Price table */}
        <div className="flex-1 rounded-lg overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {/* Table header */}
          <div className="flex items-center px-3 py-1.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="flex-1 text-[9px] text-slate-500 font-medium">품목</span>
            <span className="w-24 text-right text-[9px] text-slate-500 font-medium">단가</span>
            <span className="w-10 text-right text-[9px] text-slate-500 font-medium">단위</span>
          </div>
          {/* Table rows */}
          {[0, 1, 2, 3].map((offset) => {
            const item = PRICE_ITEMS[(priceIdx + offset) % PRICE_ITEMS.length];
            const isHighlighted = offset === 0;
            return (
              <div key={`${priceIdx}-${offset}`}
                className="flex items-center px-3 py-2 transition-all duration-500"
                style={{
                  backgroundColor: isHighlighted ? `${SOURCES[activeSource].color}08` : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}>
                <span className={`flex-1 text-[10px] ${isHighlighted ? "text-white/80" : "text-slate-400"}`}>
                  {item.name}
                </span>
                <span className={`w-24 text-right text-[10px] font-mono ${isHighlighted ? "text-cyan-400" : "text-slate-300"}`}>
                  ₩{item.price}
                </span>
                <span className="w-10 text-right text-[9px] text-slate-500">/{item.unit}</span>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes statusPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .anim-status-pulse { animation: statusPulse 2s ease-in-out infinite; }
        .anim-flow-dot { opacity: 0; animation: flowFade 1.5s ease-in-out infinite; }
        @keyframes flowFade { 0% { opacity: 0; } 30% { opacity: 0.6; } 70% { opacity: 0.6; } 100% { opacity: 0; } }
      `}</style>
    </div>
  );
}

// ─── 3. 3D 견적뷰어 애니메이션 ──────────────────────────
// VR-like 3D 인테리어 공간 + 견적 데이터 오버레이

const ROOMS_3D = [
  { label: "거실", area: "29.4", cost: "680", floor: "linear-gradient(135deg, #8B7355 0%, #A0896C 50%, #8B7355 100%)", wall: "linear-gradient(180deg, #E8E0D4 0%, #D4C8B8 100%)", accent: "#3B82F6" },
  { label: "안방", area: "14.2", cost: "478", floor: "linear-gradient(135deg, #6B8A6B 0%, #7FA07F 50%, #5D7A5D 100%)", wall: "linear-gradient(180deg, #DDE5DD 0%, #C8D4C8 100%)", accent: "#6366F1" },
  { label: "욕실", area: "5.8", cost: "697", floor: "linear-gradient(135deg, #5A7A8A 0%, #6B8B9A 50%, #4A6A7A 100%)", wall: "linear-gradient(180deg, #D0DDE5 0%, #B8C8D4 100%)", accent: "#06B6D4" },
  { label: "주방", area: "8.6", cost: "306", floor: "linear-gradient(135deg, #7A6A5A 0%, #8A7A6A 50%, #6A5A4A 100%)", wall: "linear-gradient(180deg, #E5DDD4 0%, #D4C8BC 100%)", accent: "#8B5CF6" },
];

const ESTIMATE_ITEMS = [
  { trade: "바닥재", item: "강마루 (화이트오크)", qty: "29.4m²", cost: "123만" },
  { trade: "도배", item: "실크벽지 (LG하우시스)", qty: "86.2m²", cost: "73만" },
  { trade: "타일", item: "포세린 (600×600)", qty: "14.4m²", cost: "65만" },
  { trade: "천장", item: "텍스 + LED 조명", qty: "29.4m²", cost: "88만" },
  { trade: "전기", item: "콘센트·스위치 교체", qty: "28개소", cost: "56만" },
  { trade: "목공", item: "걸레받이 + 몰딩", qty: "42.6m", cost: "34만" },
];

export function EstimateViewerAnimation() {
  const [activeRoom, setActiveRoom] = useState(0);
  const [rotY, setRotY] = useState(-25);
  const [scrollIdx, setScrollIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRoom((prev) => (prev + 1) % ROOMS_3D.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Gentle rotation oscillation
  useEffect(() => {
    const interval = setInterval(() => {
      setRotY(() => {
        const t = Date.now() / 3000;
        return -25 + Math.sin(t) * 8;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll estimate items
  useEffect(() => {
    const interval = setInterval(() => {
      setScrollIdx((prev) => (prev + 1) % ESTIMATE_ITEMS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const room = ROOMS_3D[activeRoom];

  return (
    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)" }}>
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]">
        <defs>
          <pattern id="grid-ev" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-ev)" />
      </svg>

      <div className="relative h-full p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-[11px] font-medium text-slate-400 tracking-wide uppercase">3D Estimate Viewer</span>
          </div>
          <div className="flex gap-1.5">
            {["2D", "3D", "VR"].map((m) => (
              <span key={m}
                className="px-2 py-0.5 rounded text-[9px] font-medium"
                style={{
                  backgroundColor: m === "3D" ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
                  color: m === "3D" ? "#60A5FA" : "rgba(255,255,255,0.3)",
                  border: `1px solid ${m === "3D" ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.05)"}`,
                }}>
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* 3D Room + Estimate split */}
        <div className="flex-1 flex gap-2 min-h-0">
          {/* Left: 3D VR Room */}
          <div className="flex-1 rounded-lg overflow-hidden relative"
            style={{ perspective: "600px", backgroundColor: "rgba(0,0,0,0.3)" }}>
            {/* 3D Room container */}
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ perspectiveOrigin: "50% 45%" }}>
              <div className="ev-room-container" style={{
                width: "85%", height: "80%",
                transformStyle: "preserve-3d",
                transform: `rotateX(12deg) rotateY(${rotY}deg)`,
                transition: "transform 0.1s linear",
              }}>
                {/* Floor */}
                <div className="ev-floor" style={{
                  position: "absolute", width: "100%", height: "100%",
                  background: room.floor,
                  transform: "rotateX(90deg) translateZ(-60px)",
                  boxShadow: "inset 0 0 30px rgba(0,0,0,0.2)",
                }}>
                  {/* Floor pattern (wood lines) */}
                  {[...Array(8)].map((_, i) => (
                    <div key={i} style={{
                      position: "absolute", left: 0, right: 0,
                      top: `${12.5 * i}%`, height: "1px",
                      background: "rgba(0,0,0,0.08)",
                    }} />
                  ))}
                </div>

                {/* Back wall */}
                <div className="ev-wall-back" style={{
                  position: "absolute", width: "100%", height: "120px",
                  background: room.wall,
                  transform: "translateZ(-60px) translateY(-30px)",
                }}>
                  {/* Window on back wall */}
                  <div style={{
                    position: "absolute", left: "15%", top: "15%",
                    width: "35%", height: "55%",
                    border: "3px solid rgba(255,255,255,0.4)",
                    borderRadius: "2px",
                    background: "linear-gradient(135deg, rgba(135,206,250,0.3), rgba(176,224,230,0.2))",
                    boxShadow: "inset 0 0 20px rgba(135,206,250,0.15)",
                  }}>
                    <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "2px", background: "rgba(255,255,255,0.3)" }} />
                    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "2px", background: "rgba(255,255,255,0.3)" }} />
                  </div>
                  {/* Wall art / frame */}
                  <div style={{
                    position: "absolute", right: "10%", top: "20%",
                    width: "22%", height: "40%",
                    border: "2px solid rgba(0,0,0,0.15)",
                    borderRadius: "1px",
                    background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))",
                  }} />
                </div>

                {/* Left wall */}
                <div className="ev-wall-left" style={{
                  position: "absolute", width: "120px", height: "120px",
                  background: `linear-gradient(90deg, ${room.wall.includes("E8E0D4") ? "#D4C8B8" : room.wall.includes("DDE5DD") ? "#C0CEC0" : room.wall.includes("D0DDE5") ? "#B0C0CC" : "#C8BEB4"}, ${room.wall.includes("E8E0D4") ? "#E8E0D4" : room.wall.includes("DDE5DD") ? "#DDE5DD" : room.wall.includes("D0DDE5") ? "#D0DDE5" : "#E5DDD4"})`,
                  transform: "rotateY(90deg) translateZ(-1px) translateY(-30px)",
                  transformOrigin: "left center",
                }}>
                  {/* Door */}
                  <div style={{
                    position: "absolute", right: "10%", bottom: 0,
                    width: "35%", height: "75%",
                    background: "linear-gradient(180deg, rgba(139,115,85,0.4), rgba(139,115,85,0.6))",
                    borderRadius: "2px 2px 0 0",
                    border: "2px solid rgba(139,115,85,0.3)",
                  }}>
                    <div style={{
                      position: "absolute", right: "12%", top: "45%",
                      width: "6px", height: "6px",
                      borderRadius: "50%",
                      background: "rgba(255,215,0,0.6)",
                    }} />
                  </div>
                </div>

                {/* Furniture silhouettes (sofa for living, bed for bedroom, etc.) */}
                <div className="ev-furniture" style={{
                  position: "absolute", width: "100%", height: "100%",
                  transform: "rotateX(90deg) translateZ(-58px)",
                }}>
                  {activeRoom === 0 && (
                    <>
                      {/* Sofa */}
                      <div style={{ position: "absolute", left: "55%", top: "55%", width: "35%", height: "18%", background: "rgba(100,80,60,0.5)", borderRadius: "4px", boxShadow: "2px 2px 4px rgba(0,0,0,0.2)" }} />
                      {/* Coffee table */}
                      <div style={{ position: "absolute", left: "60%", top: "38%", width: "20%", height: "12%", background: "rgba(80,65,50,0.4)", borderRadius: "2px" }} />
                      {/* Rug */}
                      <div style={{ position: "absolute", left: "50%", top: "30%", width: "40%", height: "35%", background: "rgba(150,130,110,0.2)", borderRadius: "4px" }} />
                    </>
                  )}
                  {activeRoom === 1 && (
                    <>
                      {/* Bed */}
                      <div style={{ position: "absolute", left: "25%", top: "30%", width: "50%", height: "40%", background: "rgba(200,200,220,0.4)", borderRadius: "4px", boxShadow: "2px 2px 4px rgba(0,0,0,0.15)" }}>
                        <div style={{ position: "absolute", left: "10%", top: "5%", width: "80%", height: "25%", background: "rgba(255,255,255,0.3)", borderRadius: "3px" }} />
                      </div>
                      {/* Nightstand */}
                      <div style={{ position: "absolute", left: "15%", top: "40%", width: "8%", height: "10%", background: "rgba(100,80,60,0.4)", borderRadius: "2px" }} />
                    </>
                  )}
                  {activeRoom === 2 && (
                    <>
                      {/* Bathtub */}
                      <div style={{ position: "absolute", left: "15%", top: "20%", width: "30%", height: "55%", background: "rgba(200,220,230,0.5)", borderRadius: "8px", border: "2px solid rgba(180,200,210,0.4)" }} />
                      {/* Sink */}
                      <div style={{ position: "absolute", left: "60%", top: "15%", width: "20%", height: "15%", background: "rgba(220,230,240,0.5)", borderRadius: "50% 50% 4px 4px" }} />
                      {/* Toilet */}
                      <div style={{ position: "absolute", left: "65%", top: "60%", width: "14%", height: "20%", background: "rgba(220,230,240,0.5)", borderRadius: "4px 4px 50% 50%" }} />
                    </>
                  )}
                  {activeRoom === 3 && (
                    <>
                      {/* Counter */}
                      <div style={{ position: "absolute", left: "10%", top: "10%", width: "80%", height: "15%", background: "rgba(160,150,140,0.5)", borderRadius: "2px" }} />
                      {/* Island */}
                      <div style={{ position: "absolute", left: "30%", top: "50%", width: "40%", height: "18%", background: "rgba(140,130,120,0.4)", borderRadius: "3px" }} />
                      {/* Sink dots */}
                      <div style={{ position: "absolute", left: "40%", top: "13%", width: "10%", height: "8%", background: "rgba(180,200,210,0.5)", borderRadius: "50%" }} />
                    </>
                  )}
                </div>

                {/* Ambient glow */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(ellipse at 30% 30%, ${room.accent}15 0%, transparent 60%)`,
                  pointerEvents: "none",
                }} />
              </div>
            </div>

            {/* Room label overlay */}
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md"
              style={{ backgroundColor: `${room.accent}20`, border: `1px solid ${room.accent}40` }}>
              <span className="text-[10px] font-semibold" style={{ color: room.accent }}>{room.label}</span>
              <span className="text-[9px] text-slate-400 ml-1.5">{room.area}m²</span>
            </div>

            {/* VR cursor indicator */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-5 h-5 border border-white/20 rounded-full flex items-center justify-center ev-pulse-ring">
                <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
              </div>
            </div>
          </div>

          {/* Right: Estimate data */}
          <div className="w-[42%] flex flex-col gap-1.5">
            {/* Cost summary */}
            <div className="rounded-lg px-3 py-2"
              style={{ backgroundColor: `${room.accent}10`, border: `1px solid ${room.accent}25` }}>
              <div className="text-[9px] text-slate-500 mb-0.5">예상 견적</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white/90 font-mono">{room.cost}</span>
                <span className="text-[10px] text-slate-400">만원</span>
              </div>
            </div>

            {/* Scrolling estimate items */}
            <div className="flex-1 rounded-lg overflow-hidden"
              style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="px-2.5 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-[9px] text-slate-500 font-medium">공종별 내역</span>
              </div>
              {[0, 1, 2, 3].map((offset) => {
                const item = ESTIMATE_ITEMS[(scrollIdx + offset) % ESTIMATE_ITEMS.length];
                const isTop = offset === 0;
                return (
                  <div key={`${scrollIdx}-${offset}`}
                    className="px-2.5 py-1.5 transition-all duration-500"
                    style={{
                      backgroundColor: isTop ? `${room.accent}08` : "transparent",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                    }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-medium" style={{ color: isTop ? room.accent : "rgba(255,255,255,0.5)" }}>{item.trade}</span>
                      <span className="text-[9px] font-mono" style={{ color: isTop ? "#67E8F9" : "rgba(255,255,255,0.35)" }}>₩{item.cost}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-slate-500 truncate mr-2">{item.item}</span>
                      <span className="text-[8px] text-slate-600 whitespace-nowrap">{item.qty}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Room selector dots */}
        <div className="flex items-center justify-center gap-2 mt-2">
          {ROOMS_3D.map((r, i) => (
            <div key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: activeRoom === i ? 16 : 6,
                height: 6,
                backgroundColor: activeRoom === i ? r.accent : "rgba(255,255,255,0.1)",
              }} />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulseRing { 0%, 100% { opacity: 0.4; transform: translate(-50%,-50%) scale(1); } 50% { opacity: 0.8; transform: translate(-50%,-50%) scale(1.2); } }
        .ev-pulse-ring { animation: pulseRing 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// ─── 4. 전문업체 매칭 애니메이션 ─────────────────────────
// 레이더 차트 스타일 스코어링 시스템

const SCORE_LABELS = ["거리", "평점", "가격", "경력", "일정", "신뢰"];
const SCORE_DATA = [
  [85, 92, 78, 95, 88, 96],
  [72, 88, 95, 80, 92, 90],
  [90, 76, 82, 88, 70, 94],
];

export function ContractorMatchAnimation() {
  const [activeContractor, setActiveContractor] = useState(0);
  const [fillProgress, setFillProgress] = useState(0);
  const [scanAngle, setScanAngle] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveContractor((prev) => (prev + 1) % SCORE_DATA.length);
      setFillProgress(0);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (fillProgress < 100) {
      const timer = setTimeout(() => setFillProgress((p) => Math.min(p + 4, 100)), 30);
      return () => clearTimeout(timer);
    }
  }, [fillProgress]);

  useEffect(() => {
    const interval = setInterval(() => setScanAngle((a) => (a + 2) % 360), 30);
    return () => clearInterval(interval);
  }, []);

  const scores = SCORE_DATA[activeContractor];
  const totalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Generate radar polygon points
  const radarPoints = scores.map((score, i) => {
    const adjustedScore = (score * fillProgress) / 100;
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const r = (adjustedScore / 100) * 50;
    return `${60 + r * Math.cos(angle)},${60 + r * Math.sin(angle)}`;
  }).join(" ");

  return (
    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)" }}>
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]">
        <defs>
          <pattern id="grid-cm" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-cm)" />
      </svg>

      <div className="relative h-full p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-[11px] font-medium text-slate-400 tracking-wide uppercase">Matching Score</span>
          </div>
          <div className="flex items-center gap-1.5">
            {SCORE_DATA.map((_, i) => (
              <div key={i}
                className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-medium transition-all duration-300"
                style={{
                  backgroundColor: activeContractor === i ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)",
                  color: activeContractor === i ? "#A78BFA" : "rgba(255,255,255,0.2)",
                  border: `1px solid ${activeContractor === i ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.05)"}`,
                }}>
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Radar chart */}
          <div className="flex-1 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-full h-full max-w-[150px] max-h-[150px]">
              {/* Radar grid rings */}
              {[20, 35, 50].map((r) => (
                <polygon key={r}
                  points={Array.from({ length: 6 }).map((_, i) => {
                    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                    return `${60 + r * Math.cos(angle)},${60 + r * Math.sin(angle)}`;
                  }).join(" ")}
                  fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              ))}
              {/* Axis lines */}
              {Array.from({ length: 6 }).map((_, i) => {
                const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                return (
                  <line key={i}
                    x1="60" y1="60"
                    x2={60 + 52 * Math.cos(angle)}
                    y2={60 + 52 * Math.sin(angle)}
                    stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                );
              })}
              {/* Scan line */}
              <line x1="60" y1="60"
                x2={60 + 55 * Math.cos((scanAngle * Math.PI) / 180 - Math.PI / 2)}
                y2={60 + 55 * Math.sin((scanAngle * Math.PI) / 180 - Math.PI / 2)}
                stroke="rgba(139,92,246,0.15)" strokeWidth="0.5" />
              {/* Data polygon */}
              <polygon points={radarPoints}
                fill="rgba(139,92,246,0.1)" stroke="rgba(139,92,246,0.5)" strokeWidth="1.5" />
              {/* Data points */}
              {scores.map((score, i) => {
                const adjustedScore = (score * fillProgress) / 100;
                const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                const r = (adjustedScore / 100) * 50;
                return (
                  <circle key={i}
                    cx={60 + r * Math.cos(angle)}
                    cy={60 + r * Math.sin(angle)}
                    r="2.5" fill="#A78BFA" />
                );
              })}
              {/* Labels */}
              {SCORE_LABELS.map((label, i) => {
                const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                return (
                  <text key={i}
                    x={60 + 58 * Math.cos(angle)}
                    y={60 + 58 * Math.sin(angle)}
                    textAnchor="middle" dominantBaseline="middle"
                    className="text-[7px]"
                    fill="rgba(255,255,255,0.35)">
                    {label}
                  </text>
                );
              })}
              {/* Center score */}
              <text x="60" y="58" textAnchor="middle"
                className="text-sm font-bold" fill="white"
                style={{ opacity: fillProgress > 80 ? 1 : 0 }}>
                {totalScore}
              </text>
              <text x="60" y="68" textAnchor="middle"
                className="text-[7px]" fill="rgba(255,255,255,0.4)"
                style={{ opacity: fillProgress > 80 ? 1 : 0 }}>
                종합점수
              </text>
            </svg>
          </div>

          {/* Score bars */}
          <div className="w-[38%] flex flex-col justify-center gap-1.5">
            {SCORE_LABELS.map((label, i) => {
              const score = scores[i];
              const barWidth = (score * fillProgress) / 100;
              return (
                <div key={label}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[9px] text-slate-500">{label}</span>
                    <span className="text-[9px] font-mono text-slate-400"
                      style={{ opacity: fillProgress > 50 ? 1 : 0, transition: "opacity 0.3s" }}>
                      {Math.round((score * fillProgress) / 100)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${score >= 90 ? "#8B5CF6" : score >= 80 ? "#6366F1" : "#3B82F6"}, ${score >= 90 ? "#A78BFA" : score >= 80 ? "#818CF8" : "#60A5FA"})`,
                      }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom verification badges */}
        <div className="flex gap-2 mt-3">
          {["사업자등록", "건설면허", "포트폴리오", "인증완료"].map((badge, i) => (
            <div key={badge}
              className="flex-1 rounded-md py-1.5 text-center transition-all duration-500"
              style={{
                backgroundColor: fillProgress > 20 + i * 20 ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${fillProgress > 20 + i * 20 ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)"}`,
              }}>
              <span className="text-[8px] font-medium transition-colors duration-500"
                style={{ color: fillProgress > 20 + i * 20 ? "rgba(167,139,250,0.8)" : "rgba(255,255,255,0.15)" }}>
                {badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
