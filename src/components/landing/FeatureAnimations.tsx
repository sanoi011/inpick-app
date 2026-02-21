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
// 아이소메트릭 공간 + 데이터 오버레이

const ROOMS_DATA = [
  { label: "거실", area: "29.4", cost: "680" },
  { label: "안방", area: "14.2", cost: "478" },
  { label: "욕실", area: "5.8", cost: "697" },
  { label: "주방", area: "8.6", cost: "306" },
];

export function EstimateViewerAnimation() {
  const [activeRoom, setActiveRoom] = useState(0);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRoom((prev) => (prev + 1) % ROOMS_DATA.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((r) => (r + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-[11px] font-medium text-slate-400 tracking-wide uppercase">3D Viewer</span>
          </div>
          <div className="flex gap-1.5">
            {["2D", "3D"].map((m) => (
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

        {/* Isometric 3D room visualization */}
        <div className="flex-1 flex items-center justify-center relative mb-3">
          <svg viewBox="0 0 260 180" className="w-full h-full max-h-[140px]">
            {/* Isometric floor plan */}
            {[
              { x: 30, y: 80, w: 100, h: 60, room: 0, color: "#3B82F6" },
              { x: 130, y: 80, w: 60, h: 60, room: 1, color: "#6366F1" },
              { x: 30, y: 140, w: 60, h: 30, room: 2, color: "#06B6D4" },
              { x: 90, y: 140, w: 70, h: 30, room: 3, color: "#8B5CF6" },
            ].map((r, i) => {
              const isActive = activeRoom === r.room;
              const isoX = r.x + r.y * 0.5;
              const isoY = r.y * 0.35 - r.x * 0.15 + 50;
              return (
                <g key={i}>
                  {/* Floor */}
                  <rect x={isoX} y={isoY} width={r.w * 0.6} height={r.h * 0.35}
                    fill={isActive ? `${r.color}25` : "rgba(255,255,255,0.03)"}
                    stroke={isActive ? `${r.color}50` : "rgba(255,255,255,0.08)"}
                    strokeWidth={isActive ? 1.5 : 0.5}
                    rx="2"
                    className="transition-all duration-500" />
                  {/* Wall hint */}
                  {isActive && (
                    <>
                      <line x1={isoX} y1={isoY} x2={isoX} y2={isoY - 18}
                        stroke={`${r.color}40`} strokeWidth="1" strokeDasharray="2 2" />
                      <line x1={isoX + r.w * 0.6} y1={isoY} x2={isoX + r.w * 0.6} y2={isoY - 18}
                        stroke={`${r.color}40`} strokeWidth="1" strokeDasharray="2 2" />
                    </>
                  )}
                  {/* Label */}
                  <text x={isoX + r.w * 0.3} y={isoY + r.h * 0.2}
                    textAnchor="middle"
                    className={`text-[8px] font-medium transition-all duration-500`}
                    fill={isActive ? r.color : "rgba(255,255,255,0.25)"}>
                    {ROOMS_DATA[r.room].label}
                  </text>
                </g>
              );
            })}
            {/* Rotating compass */}
            <g transform={`translate(225, 30) rotate(${rotation})`}>
              <circle r="12" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              <line x1="0" y1="-10" x2="0" y2="10" stroke="rgba(59,130,246,0.3)" strokeWidth="0.5" />
              <line x1="-10" y1="0" x2="10" y2="0" stroke="rgba(59,130,246,0.3)" strokeWidth="0.5" />
              <circle r="2" fill="rgba(59,130,246,0.5)" />
            </g>
          </svg>
        </div>

        {/* Room detail bar */}
        <div className="rounded-lg px-4 py-3 flex items-center justify-between transition-all duration-500"
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}>
          <div>
            <span className="text-xs font-semibold text-white/80">{ROOMS_DATA[activeRoom].label}</span>
            <span className="text-[10px] text-slate-500 ml-2">{ROOMS_DATA[activeRoom].area}m²</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-white/90 font-mono">{ROOMS_DATA[activeRoom].cost}</span>
            <span className="text-[10px] text-slate-500 ml-0.5">만원</span>
          </div>
        </div>

        {/* Room selector dots */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {ROOMS_DATA.map((_, i) => (
            <div key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: activeRoom === i ? 16 : 6,
                height: 6,
                backgroundColor: activeRoom === i ? "#3B82F6" : "rgba(255,255,255,0.1)",
              }} />
          ))}
        </div>
      </div>
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
