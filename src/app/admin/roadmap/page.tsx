"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  Rocket, CheckCircle2, Clock, Circle,
  ScanLine, Box, MessageSquare, Calculator, FileText, PenTool,
  Image as ImageIcon, Layers, Users, BarChart3, CreditCard,
  Smartphone, Shield,
  ChevronLeft, ChevronRight, X, ExternalLink, Loader2,
  Monitor, Cpu, Database, Wrench,
  Home, Palette, Camera, DollarSign, Send,
  Building2, Briefcase, Bot, Calendar, PieChart, UserCircle,
  Zap, Target, Wifi, TrendingUp,
  Play, AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── 타입 정의 ───

type FeatureStatus = "completed" | "in_progress" | "planned";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  tags: string[];
  status: FeatureStatus;
  link?: string;
  detail?: string;
  images?: { src: string; label: string }[];
  hasDemo?: boolean;
}

// ─── 상수 ───

const STATS = [
  { label: "완성 기능", value: "35+", sub: "핵심 기능 모듈", color: "text-emerald-400", bg: "bg-[#0F1A14]", border: "border-emerald-900/50" },
  { label: "페이지 수", value: "40+", sub: "소비자+사업자+관리자", color: "text-blue-400", bg: "bg-[#0F1420]", border: "border-blue-900/50" },
  { label: "API 라우트", value: "70+", sub: "보안 감사 완료", color: "text-violet-400", bg: "bg-[#150F20]", border: "border-violet-900/50" },
  { label: "DB 테이블", value: "26+", sub: "Supabase 마이그레이션", color: "text-amber-400", bg: "bg-[#1A1509]", border: "border-amber-900/50" },
];

const ELEVATION_IMAGES = Array.from({ length: 9 }, (_, i) => ({
  src: `/showcase/elevation-${String(i + 1).padStart(2, "0")}.jpg`,
  label: `입면전개도 참고 ${i + 1}`,
}));

// ─── 기능 데이터 (3개 카테고리) ───

const COMPLETED_FEATURES: Feature[] = [
  {
    icon: ScanLine, title: "AI 도면 인식", status: "completed",
    desc: "Gemini 3.0 Pro + YOLOv26 + PyMuPDF 5소스 융합 파이프라인",
    tags: ["Gemini 3.0", "YOLOv26", "PyMuPDF"],
    detail: "PDF/이미지 업로드 → 5개 소스 병렬 분석:\n\n1. Gemini 3.0 Pro Vision — 시맨틱 분석\n2. YOLOv26 (ONNX) — 기하학 심볼 감지 (mAP50: 0.913)\n3. PyMuPDF — PDF 벡터 추출\n4. floorplan-ai — Hough Transform + EasyOCR\n5. Template Matcher — 알려진 도면 즉시 매칭 (3ms)\n\n검증: 59/84A/84B 3타입 모두 신뢰도 1.0, 면적 오차 0.1% 이내.",
  },
  {
    icon: Box, title: "2D/3D 도면 뷰어", status: "completed",
    desc: "SVG 치수선 + Three.js PBR 재질 렌더링",
    tags: ["Three.js", "SVG", "PBR"], link: "/project/new",
    detail: "2D 뷰어: SVG 엔지니어링 도면\n- 벽체 두께 폴리곤 + 문/창 심볼 + mm 치수선 + 설비 심볼\n- 마우스 휠 줌 + 드래그 팬\n\n3D 뷰어: Three.js R3F\n- PBR 재질 + SSAO + Bloom 후처리\n- 자유/아이소/탑뷰 카메라 모드",
  },
  {
    icon: MessageSquare, title: "AI 디자인 상담", status: "completed",
    desc: "Gemini 3.0 Pro 멀티모달 + RAG 지식베이스",
    tags: ["Gemini 3.0", "RAG", "SSE"],
    detail: "Gemini 3.0 Pro 멀티모달 SSE 스트리밍:\n- 사진/도면 + 텍스트 + 주석 컨텍스트 동시 입력\n- RAG: construction_knowledge 시맨틱 검색 (pgvector)\n- LH 표준시방서 4개 + 설비 도면 1개 PDF 학습",
  },
  {
    icon: Calculator, title: "17공종 물량산출", status: "completed",
    desc: "한국 아파트 표준 기반 자동 산출 엔진 60+ 항목 단가DB",
    tags: ["17공종", "60+ 단가", "자동 산출"],
    detail: "17개 공종 모듈:\n철거→조적→미장→방수→타일→목공→바닥재→도배→천장→창호→잡철→배관→위생도기→전기→고정설비→걸레받이→정리\n\n검증: 59㎡ 6,433만원 / 84A㎡ 7,983만원 / 84B㎡ 6,813만원\n3타입 모두 미매칭 0건, E2E PASS",
  },
  {
    icon: FileText, title: "견적서/계약서 PDF", status: "completed",
    desc: "jsPDF 한국어 NanumGothic + 공정위 표준계약서",
    tags: ["jsPDF", "한국어", "표준양식"],
    detail: "3종 PDF 자동 생성:\n1. 견적서 PDF — 비용 요약 + 공간별/공종별 상세 테이블\n2. 계약서 PDF — 공정위 표준계약서 양식\n3. 시공도면 PDF — A3 가로, 표지 + 3종 도면",
  },
  {
    icon: ImageIcon, title: "실시간 도면 생성", status: "completed",
    desc: "네이버 원본 → Gemini 3.0 Pro 4단계 SSE 파이프라인",
    tags: ["Gemini 3.0", "SSE", "sharp"],
    detail: "4단계 SSE 파이프라인:\nStep 0: 네이버 원본 다운로드\nStep 1: Gemini 3.0 Pro 클린 (워터마크 제거)\nStep 2: sharp.flop 좌우 반전\nStep 3: Gemini 3.0 Pro 세그멘테이션 마스크 (방별 13색)\nStep 4: Supabase Storage 업로드 + DB 캐시",
  },
  {
    icon: Layers, title: "세그멘테이션 마스크", status: "completed",
    desc: "Canvas 픽셀 조작으로 자재 실시간 오버레이",
    tags: ["Canvas", "픽셀 캐시", "실시간"],
    detail: "HTML5 Canvas 픽셀 오버레이:\n- 13개 방 타입별 고정 RGB 색상 매핑\n- buildPixelCache → 방별 Uint32Array\n- 자재 선택 시 alpha blend (opacity 0.35)\n매칭률: 38.1% 픽셀 매칭, 미매칭 1.8%",
  },
  {
    icon: Home, title: "소비자 6탭 워크플로우", status: "completed",
    desc: "우리집 찾기→도면/3D→AI 디자인→렌더링→물량산출→견적요청",
    tags: ["6탭", "E2E", "모바일"], link: "/project/new",
    detail: "6탭 워크플로우:\n1. 우리집 찾기 — 주소검색→건물→동/호→평형 선택\n2. 도면/3D — 2D/3D 뷰어 + 벽 그리기\n3. AI 디자인 — Gemini 3.0 상담 + 이미지 생성\n4. 3D 렌더링 — 방별 자재 선택 + 마스크 오버레이\n5. 물량산출 — 17공종 자동 산출 + PDF\n6. 견적요청 — RFQ→입찰→계약",
  },
  {
    icon: Building2, title: "사업자 포털 8페이지", status: "completed",
    desc: "대시보드/입찰/프로젝트/AI/매칭/일정/재무/프로필",
    tags: ["8페이지", "Realtime", "CRM"], link: "/auth?type=contractor",
    detail: "사업자 8개 페이지:\n1. 대시보드 — 5개 요약 카드 + 실시간 알림\n2. 입찰 관리 — 4탭 필터 + RFQ 수신\n3. 프로젝트 관리 — Gantt 공정표\n4. AI 비서 — Gemini 3.0 Pro 컨텍스트 인지\n5. 전문업체 매칭 — 6요소 점수\n6. 일정 관리 — 월간/주간/일간\n7. 재무 관리 — 청구서/지출 + CSV\n8. 프로필 — 5탭",
  },
  {
    icon: Wifi, title: "실시간 채팅", status: "completed",
    desc: "Supabase Realtime + 옵티미스틱 UI + 읽음 처리",
    tags: ["Realtime", "WebSocket", "옵티미스틱"],
    detail: "Supabase Realtime 채팅:\n- postgres_changes 구독\n- 옵티미스틱 삽입 + 실패 롤백\n- 자동 스크롤 + 날짜 구분선",
  },
  {
    icon: BarChart3, title: "공정관리 Gantt", status: "completed",
    desc: "SVG/DOM 하이브리드 Gantt + 드래그 리사이즈",
    tags: ["Gantt", "드래그", "사진"],
    detail: "SVG/DOM 하이브리드 Gantt:\n- 7공정 자동 배분 (60:40 블렌딩)\n- 드래그 날짜 변경 + 리사이즈\n- 시공 사진 업로드 (공정별 5장)",
  },
  {
    icon: Users, title: "업체 디렉토리", status: "completed",
    desc: "종합/전문 업체 검색, 필터, 포트폴리오, 리뷰",
    tags: ["검색", "필터", "포트폴리오"], link: "/find-contractors",
    detail: "사업자 디렉토리:\n- 종합/전문 업체 유형 구분\n- 공종별/지역별/예산범위/경력 필터\n- 업체 상세: 소개/포트폴리오/리뷰/공종 4탭\n- 문의 모달",
  },
  {
    icon: CreditCard, title: "Toss 결제 연동", status: "completed",
    desc: "크레딧 충전 + 웹훅 검증 + 결제 이력",
    tags: ["Toss", "웹훅", "크레딧"],
    detail: "Toss Payments 연동:\n- checkout → Toss SDK → confirm API 검증\n- 웹훅: PAYMENT_STATUS_CHANGED\n- 결제 이력 (CHARGE/SPEND)\n- Mock 모드 (키 미발급 시)",
  },
  {
    icon: Shield, title: "보안 감사 + E2E 테스트", status: "completed",
    desc: "70+ API 전수 인증 검사, Playwright 33개 테스트, PWA + SEO",
    tags: ["보안 감사", "E2E", "PWA"],
    detail: "보안 감사 (Rounds 8-13): 70+ API 전수 검사\nE2E 테스트: Playwright 33개\nPWA: 오프라인 SW + 앱 셸\nSEO: OG 이미지 + robots + sitemap",
  },
];

const IN_PROGRESS_FEATURES: Feature[] = [
  {
    icon: PenTool, title: "입면전개도 AI 생성", status: "in_progress",
    desc: "참고 이미지 + 도면 + 인테리어 4컷 → Gemini 3.0 Pro → 입면전개도/평면도 SVG",
    tags: ["Gemini 3.0", "SVG", "입면도"],
    hasDemo: true,
    detail: "하이브리드 파이프라인:\n\n입력:\n- 참고 이미지 9장 (실제 입면전개도 스타일)\n- 사용자 도면 (평면도)\n- AI 생성 인테리어 4컷 (자재/스타일)\n\n처리:\n→ Gemini 3.0 Pro에 전체 입력 전달\n→ 방별 4면 벽 전개도 JSON 생성\n→ 프로그래매틱 SVG 렌더링 (다크 테마)\n→ 마감 평면도 SVG 동시 생성\n\n출력:\n- 입면전개도 SVG (방별 벽면 + mm 치수 + 마감재 주석)\n- 마감 평면도 SVG (방별 마감재 배치)\n\n스타일: 다크 배경(#0D1117) + 흰색 라인 + mm 치수",
    images: ELEVATION_IMAGES,
  },
  {
    icon: PenTool, title: "시공도면 자동생성 서비스 고도화", status: "in_progress",
    desc: "가구배치도/전기배선도/입면전개도 3종 도면 AI 보강",
    tags: ["SVG", "Gemini 3.0", "A3 PDF"],
    detail: "3종 도면 자동 생성:\n1. 가구배치도 — 공간별 가구 자동 배치\n2. 전기배선도 — 한국 주거 표준 전기 심볼\n3. 입면전개도 — 방별 4면 벽 전개 + mm 치수\n\nAI 보강: Gemini 3.0 Pro 가구 분석 + 3D 묘사",
  },
  {
    icon: Camera, title: "AI 3D 인테리어 렌더링", status: "in_progress",
    desc: "Gemini 3.0 Pro 텍스처 생성 + WebGL 실시간 렌더링",
    tags: ["Gemini 3.0", "WebGL", "PBR"],
    detail: "Gemini 3.0 Pro 이미지 생성:\n- 스타일별 인테리어 4컷 병렬 생성\n- 방별 자재 오버레이 → 실시간 렌더링\n- PBR 텍스처 자동 생성 (향후)",
  },
];

const PLANNED_FEATURES: Feature[] = [
  {
    icon: Smartphone, title: "카카오 로그인 연동", status: "planned",
    desc: "Supabase Auth 카카오 provider 설정",
    tags: ["카카오", "OAuth", "SSO"],
  },
  {
    icon: CreditCard, title: "Toss Payments 실결제 오픈", status: "planned",
    desc: "API 키 발급 후 Mock → 실결제 전환",
    tags: ["Toss", "결제", "프로덕션"],
  },
  {
    icon: Database, title: "다평형 도면 라이브러리 (30+ 타입)", status: "planned",
    desc: "전국 아파트 도면 데이터 수집 + 자동 파싱",
    tags: ["30+ 타입", "크롤링", "자동화"],
  },
  {
    icon: Building2, title: "사업자 SaaS 구독 모델", status: "planned",
    desc: "월간/연간 구독 + 3단계 플랜 (Basic/Pro/Enterprise)",
    tags: ["SaaS", "구독", "3단계"],
  },
  {
    icon: DollarSign, title: "자재사 API 연동 (실시간 시세)", status: "planned",
    desc: "자재 카탈로그 실시간 단가 반영",
    tags: ["API", "실시간", "단가"],
  },
  {
    icon: Smartphone, title: "모바일 앱 (React Native)", status: "planned",
    desc: "PWA 강화 + React Native 네이티브 앱",
    tags: ["React Native", "PWA", "앱"],
  },
  {
    icon: Target, title: "B2C 타겟 광고 + 자재 추천 AI", status: "planned",
    desc: "계약 진행 유저 대상 맞춤형 광고 + PPL",
    tags: ["광고", "AI 추천", "PPL"],
  },
  {
    icon: TrendingUp, title: "AR 도면 오버레이 + 전국 확장", status: "planned",
    desc: "ARKit/ARCore 연동 + 수도권 → 전국 광역시",
    tags: ["AR", "전국", "확장"],
  },
];

// ─── 기술 스택 ───

const TECH_STACK = [
  { category: "프론트엔드", icon: Monitor, items: ["Next.js 14", "TypeScript", "Tailwind CSS", "Three.js / R3F", "Playwright"] },
  { category: "AI 엔진", icon: Cpu, items: ["Gemini 3.0 Pro", "Gemini 3.0 Flash", "YOLOv26 (ONNX)", "PyMuPDF", "EasyOCR"] },
  { category: "백엔드", icon: Database, items: ["Supabase PostgreSQL", "Auth + Storage", "Realtime WebSocket", "Vercel Edge", "pgvector"] },
  { category: "도구", icon: Wrench, items: ["jsPDF (한국어)", "bcrypt / HMAC", "sharp", "pdfjs-dist", "Service Worker"] },
];

// ─── 워크플로우 데이터 ───

const CONSUMER_TABS = [
  { icon: Home, label: "우리집 찾기", desc: "주소검색→건물→도면타입" },
  { icon: Box, label: "도면/3D", desc: "2D/3D뷰어 + 벽그리기" },
  { icon: Palette, label: "AI 디자인", desc: "Gemini 3.0 상담" },
  { icon: Camera, label: "3D 렌더링", desc: "자재선택 + 오버레이" },
  { icon: DollarSign, label: "물량산출", desc: "17공종 자동산출" },
  { icon: Send, label: "견적요청", desc: "RFQ→입찰→계약" },
];

const CONTRACTOR_PAGES = [
  { icon: BarChart3, label: "대시보드" }, { icon: Briefcase, label: "입찰" },
  { icon: Building2, label: "프로젝트" }, { icon: Bot, label: "AI 비서" },
  { icon: Users, label: "매칭" }, { icon: Calendar, label: "일정" },
  { icon: PieChart, label: "재무" }, { icon: UserCircle, label: "프로필" },
];

// ─── 마일스톤 ───

const MILESTONES = [
  {
    phase: "Phase 1", title: "1.0 출시버전 완성", period: "2026.01 ~ 02", status: "completed" as const,
    items: [
      "AI 도면 인식 (5소스 융합)", "소비자 6탭 워크플로우", "사업자 8페이지 포털", "관리자 12페이지",
      "17공종 물량산출 엔진", "실시간 채팅", "공정관리 Gantt", "시공도면 자동생성 (3종)",
      "견적서/계약서/도면 PDF", "보안 감사 (70+ API)", "E2E 33테스트", "PWA + SEO",
    ],
  },
  {
    phase: "Phase 2", title: "서비스 고도화", period: "2026.03 ~ 04", status: "in_progress" as const,
    items: [
      "입면전개도 AI 생성 파이프라인", "AI 3D 렌더링 (텍스처 생성)", "카카오 로그인",
      "Toss 실결제 오픈", "다평형 도면 30+ 타입", "사업자 SaaS 구독",
      "자재사 API 연동", "모바일 앱", "커스텀 도메인",
    ],
  },
  {
    phase: "Phase 3", title: "스케일업", period: "2026.05 ~", status: "planned" as const,
    items: [
      "B2C 타겟 광고", "자재 추천 AI (PPL)", "기능공 매칭 수수료", "프리미엄 리스팅",
      "AR 도면 오버레이", "전국 확장 (수도권→광역시)", "해외 진출 (동남아)", "데이터 기반 가격 예측",
    ],
  },
];

// ─── IR 갤러리 ───

const IR_SLIDES = Array.from({ length: 23 }, (_, i) => ({
  src: `/ir/ir-${String(i + 1).padStart(2, "0")}.png`, label: `IR ${i + 1}`,
}));
const TECH_SLIDES = Array.from({ length: 14 }, (_, i) => ({
  src: `/ir/tech-${String(i + 1).padStart(2, "0")}.png`, label: `기술 ${i + 1}`,
}));
const ALL_SLIDES = [...IR_SLIDES, ...TECH_SLIDES];

// ─── 컴포넌트: 상태 배지 ───

function StatusBadge({ status }: { status: FeatureStatus }) {
  const map = {
    completed: { label: "COMPLETED", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    in_progress: { label: "IN PROGRESS", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    planned: { label: "PLANNED", cls: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider border ${cls}`}>{label}</span>;
}

function TimelineIcon({ status }: { status: "completed" | "in_progress" | "planned" }) {
  if (status === "completed") return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
  if (status === "in_progress") return <Clock className="w-5 h-5 text-blue-400" />;
  return <Circle className="w-5 h-5 text-gray-600" />;
}

// ─── 컴포넌트: 기능 카드 ───

function FeatureCard({ feature, onClick }: { feature: Feature; onClick: () => void }) {
  const statusIcon = {
    completed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    in_progress: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
    planned: <Circle className="w-3.5 h-3.5 text-gray-500" />,
  };

  return (
    <button
      onClick={onClick}
      className="bg-[#161B22] border border-[#30363D] p-4 flex flex-col text-left hover:border-[#58A6FF] hover:bg-[#161B22]/80 transition-all group cursor-pointer"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 border border-[#30363D] flex items-center justify-center flex-shrink-0 group-hover:border-[#58A6FF]/50 transition-colors bg-[#0D1117]">
          <feature.icon className="w-4 h-4 text-gray-400 group-hover:text-[#58A6FF] transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-mono font-semibold text-[#E6EDF3] text-sm truncate">{feature.title}</h3>
            {statusIcon[feature.status]}
          </div>
          <p className="text-xs text-[#8B949E] mt-1 leading-relaxed line-clamp-2 font-mono">{feature.desc}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#21262D]">
        <div className="flex flex-wrap gap-1">
          {feature.tags.slice(0, 3).map((t) => (
            <span key={t} className="px-1.5 py-0.5 text-[10px] font-mono text-[#8B949E] bg-[#21262D] border border-[#30363D]">{t}</span>
          ))}
        </div>
        {feature.images && (
          <span className="text-[10px] font-mono text-blue-400">IMG:{feature.images.length}</span>
        )}
        {feature.hasDemo && (
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1"><Play className="w-3 h-3" />DEMO</span>
        )}
      </div>
    </button>
  );
}

// ─── 컴포넌트: 기능 상세 모달 ───

function FeatureModal({ feature, onClose }: { feature: Feature; onClose: () => void }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [elevationSvg, setElevationSvg] = useState<string | null>(null);
  const [floorPlanSvg, setFloorPlanSvg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerateElevation = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/project/generate-elevation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: 84, roomCount: 3, style: "모던" }),
      });
      if (!res.ok) throw new Error("생성 실패");
      const data = await res.json();
      setElevationSvg(data.elevationSvg);
      setFloorPlanSvg(data.floorPlanSvg);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setGenerating(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0D1117] border border-[#30363D] max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#161B22] border-b border-[#30363D] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border border-[#30363D] flex items-center justify-center bg-[#0D1117]">
              <feature.icon className="w-4.5 h-4.5 text-[#58A6FF]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono font-bold text-[#E6EDF3] text-base">{feature.title}</h2>
                <StatusBadge status={feature.status} />
              </div>
              <div className="flex gap-1 mt-1">
                {feature.tags.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 text-[10px] font-mono text-[#58A6FF] bg-[#58A6FF]/10 border border-[#58A6FF]/20">{t}</span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 border border-[#30363D] hover:border-[#8B949E] flex items-center justify-center transition-colors bg-[#0D1117]">
            <X className="w-4 h-4 text-[#8B949E]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#8B949E] font-mono">{feature.desc}</p>

          {feature.detail && (
            <div className="bg-[#161B22] border border-[#30363D] p-4">
              <pre className="text-xs text-[#C9D1D9] whitespace-pre-wrap font-mono leading-relaxed">{feature.detail}</pre>
            </div>
          )}

          {/* 입면전개도 생성 데모 */}
          {feature.hasDemo && (
            <div className="border border-[#30363D] bg-[#161B22] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-mono font-bold text-[#E6EDF3]">LIVE DEMO — 입면전개도 생성</h3>
                <button
                  onClick={handleGenerateElevation}
                  disabled={generating}
                  className="px-3 py-1.5 text-xs font-mono font-bold bg-[#238636] text-white hover:bg-[#2EA043] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {generating ? "GENERATING..." : "GENERATE"}
                </button>
              </div>
              <p className="text-[10px] font-mono text-[#8B949E]">참고 이미지 9장 + 84㎡ 도면 → Gemini 3.0 Pro → 입면전개도 + 평면도 SVG</p>

              {genError && (
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> {genError}
                </div>
              )}

              {elevationSvg && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-mono text-[#58A6FF] mb-1">OUTPUT: 입면전개도</p>
                    <div className="border border-[#30363D] overflow-auto max-h-[400px] bg-[#0D1117]" dangerouslySetInnerHTML={{ __html: elevationSvg }} />
                  </div>
                  {floorPlanSvg && (
                    <div>
                      <p className="text-[10px] font-mono text-[#58A6FF] mb-1">OUTPUT: 마감 평면도</p>
                      <div className="border border-[#30363D] overflow-auto max-h-[300px] bg-[#0D1117]" dangerouslySetInnerHTML={{ __html: floorPlanSvg }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Image Gallery */}
          {feature.images && feature.images.length > 0 && (
            <div>
              <h3 className="text-xs font-mono font-bold text-[#8B949E] mb-2 uppercase tracking-wider">Reference Images</h3>
              <div className="relative border border-[#30363D] overflow-hidden bg-[#0D1117]">
                <div className="relative w-full" style={{ paddingBottom: "75%" }}>
                  <Image src={feature.images[imgIndex].src} alt={feature.images[imgIndex].label} fill className="object-contain" sizes="(max-width: 672px) 100vw, 672px" />
                </div>
                {imgIndex > 0 && (
                  <button className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/60 hover:bg-black/80 flex items-center justify-center border border-[#30363D]" onClick={() => setImgIndex(imgIndex - 1)}>
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                )}
                {imgIndex < feature.images.length - 1 && (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/60 hover:bg-black/80 flex items-center justify-center border border-[#30363D]" onClick={() => setImgIndex(imgIndex + 1)}>
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                )}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/70 text-[10px] font-mono text-white border border-[#30363D]">
                  {imgIndex + 1}/{feature.images.length}
                </div>
              </div>
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                {feature.images.map((img, i) => (
                  <button key={img.src} onClick={() => setImgIndex(i)} className={`flex-shrink-0 w-14 h-10 overflow-hidden border transition-all ${i === imgIndex ? "border-[#58A6FF]" : "border-[#30363D] hover:border-[#8B949E]"}`}>
                    <Image src={img.src} alt={img.label} width={56} height={40} className="object-cover w-full h-full" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {feature.link && (
            <a href={feature.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#21262D] text-[#58A6FF] text-xs font-mono border border-[#30363D] hover:border-[#58A6FF] transition-colors">
              OPEN DEMO <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ───

export default function RoadmapPage() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  // 체크 - 페이지 상단 스크롤 on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="bg-[#0D1117] min-h-screen text-[#E6EDF3]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">

        {/* ── 헤더 ── */}
        <div className="border-b border-[#21262D] pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#161B22] border border-[#30363D] flex items-center justify-center">
                <Rocket className="w-5 h-5 text-[#58A6FF]" />
              </div>
              <div>
                <h1 className="text-xl font-mono font-bold tracking-tight">INPICK DEVELOPMENT ROADMAP</h1>
                <p className="text-xs font-mono text-[#8B949E] mt-0.5">AI-powered Interior Estimation Platform — Investor Showcase</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-[10px] font-mono font-bold bg-[#238636]/20 text-emerald-400 border border-emerald-500/20">PRODUCTION</span>
              <span className="px-2 py-1 text-[10px] font-mono font-bold bg-[#161B22] text-[#8B949E] border border-[#30363D]">v2026.02</span>
            </div>
          </div>
        </div>

        {/* ── 요약 통계 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATS.map((s) => (
            <div key={s.label} className={`${s.bg} border ${s.border} p-4`}>
              <p className={`text-2xl font-mono font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs font-mono text-[#E6EDF3] mt-1">{s.label}</p>
              <p className="text-[10px] font-mono text-[#8B949E] mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── 워크플로우 미리보기 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 소비자 */}
          <div className="border border-[#30363D] bg-[#161B22] p-4">
            <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider mb-3">Consumer Workflow (6 Tabs)</h2>
            <div className="grid grid-cols-3 gap-2">
              {CONSUMER_TABS.map((tab, i) => (
                <div key={tab.label} className="bg-[#0D1117] border border-[#21262D] p-2.5 text-center">
                  <tab.icon className="w-4 h-4 text-[#58A6FF] mx-auto mb-1" />
                  <p className="text-[10px] font-mono text-[#8B949E]">{String(i + 1).padStart(2, "0")}</p>
                  <p className="text-xs font-mono text-[#E6EDF3] font-bold">{tab.label}</p>
                  <p className="text-[10px] font-mono text-[#8B949E] mt-0.5 line-clamp-1">{tab.desc}</p>
                </div>
              ))}
            </div>
          </div>
          {/* 사업자 */}
          <div className="border border-[#30363D] bg-[#161B22] p-4">
            <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider mb-3">Contractor Portal (8 Pages)</h2>
            <div className="grid grid-cols-4 gap-2">
              {CONTRACTOR_PAGES.map((p) => (
                <div key={p.label} className="bg-[#0D1117] border border-[#21262D] p-2 text-center">
                  <p.icon className="w-3.5 h-3.5 text-[#8B949E] mx-auto mb-1" />
                  <p className="text-[10px] font-mono text-[#E6EDF3]">{p.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 구현 완료된 기술 ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-emerald-400" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#E6EDF3]">Completed Features</h2>
            <span className="text-[10px] font-mono text-[#8B949E]">— {COMPLETED_FEATURES.length} modules</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {COMPLETED_FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} onClick={() => setSelectedFeature(f)} />
            ))}
          </div>
        </section>

        {/* ── 구현 중인 기술 ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-blue-400 animate-pulse" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#E6EDF3]">In Progress</h2>
            <span className="text-[10px] font-mono text-[#8B949E]">— {IN_PROGRESS_FEATURES.length} modules</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {IN_PROGRESS_FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} onClick={() => setSelectedFeature(f)} />
            ))}
          </div>
        </section>

        {/* ── 앞으로 추가할 기술 ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-gray-600" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#E6EDF3]">Planned</h2>
            <span className="text-[10px] font-mono text-[#8B949E]">— {PLANNED_FEATURES.length} modules</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {PLANNED_FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} onClick={() => setSelectedFeature(f)} />
            ))}
          </div>
        </section>

        {/* ── 기술 스택 ── */}
        <section className="border border-[#30363D] bg-[#161B22] p-5">
          <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider mb-4">Technology Stack</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TECH_STACK.map((t) => (
              <div key={t.category} className="bg-[#0D1117] border border-[#21262D] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <t.icon className="w-4 h-4 text-[#58A6FF]" />
                  <h3 className="font-mono font-bold text-xs text-[#E6EDF3]">{t.category}</h3>
                </div>
                <ul className="space-y-1">
                  {t.items.map((item) => (
                    <li key={item} className="text-[11px] font-mono text-[#8B949E] flex items-center gap-2">
                      <span className="w-1 h-1 bg-[#30363D]" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── 개발 로드맵 타임라인 ── */}
        <section>
          <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider mb-6">Development Timeline</h2>
          <div className="relative">
            <div className="absolute left-[15px] top-0 bottom-0 w-px bg-[#21262D]" />
            <div className="space-y-6">
              {MILESTONES.map((m) => (
                <div key={m.phase} className="relative pl-10">
                  <div className="absolute left-0 top-1 w-8 h-8 bg-[#0D1117] border border-[#30363D] flex items-center justify-center">
                    <TimelineIcon status={m.status} />
                  </div>
                  <div className={`border p-4 ${
                    m.status === "completed" ? "bg-emerald-500/5 border-emerald-500/20" :
                    m.status === "in_progress" ? "bg-blue-500/5 border-blue-500/20" :
                    "bg-[#161B22] border-[#30363D]"
                  }`}>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-[10px] font-mono font-bold text-[#8B949E] uppercase">{m.phase}</span>
                      <h3 className="font-mono font-bold text-sm text-[#E6EDF3]">{m.title}</h3>
                      <span className="text-[10px] font-mono text-[#8B949E]">{m.period}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                      {m.items.map((item) => (
                        <li key={item} className="text-xs font-mono text-[#C9D1D9] flex items-start gap-2">
                          {m.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> :
                           m.status === "in_progress" ? <Zap className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" /> :
                           <Target className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />}
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 수익 모델 ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-[#30363D] bg-[#161B22] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <h3 className="font-mono font-bold text-xs text-[#E6EDF3] uppercase">Core Revenue</h3>
            </div>
            <div className="space-y-2">
              <div className="bg-[#0D1117] border border-[#21262D] p-3">
                <p className="font-mono text-xs font-bold text-[#E6EDF3]">사용자 수수료</p>
                <p className="text-[10px] font-mono text-[#8B949E] mt-1">전자계약 및 에스크로 건당 수수료</p>
              </div>
              <div className="bg-[#0D1117] border border-[#21262D] p-3">
                <p className="font-mono text-xs font-bold text-[#E6EDF3]">기업용 SaaS 구독</p>
                <p className="text-[10px] font-mono text-[#8B949E] mt-1">시공사/자재사 3단계 월 구독</p>
              </div>
            </div>
          </div>
          <div className="border border-[#30363D] bg-[#161B22] p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h3 className="font-mono font-bold text-xs text-[#E6EDF3] uppercase">Extended Revenue</h3>
            </div>
            <div className="space-y-2">
              <div className="bg-[#0D1117] border border-[#21262D] p-3">
                <p className="font-mono text-xs font-bold text-[#E6EDF3]">B2C 타겟 광고 + AI 추천</p>
                <p className="text-[10px] font-mono text-[#8B949E] mt-1">계약 진행 유저 맞춤형 광고 + 자재 PPL</p>
              </div>
              <div className="bg-[#0D1117] border border-[#21262D] p-3">
                <p className="font-mono text-xs font-bold text-[#E6EDF3]">프리미엄 리스팅 + 매칭 수수료</p>
                <p className="text-[10px] font-mono text-[#8B949E] mt-1">카테고리 상단 노출 + 기능공 중개</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── IR 자료 갤러리 ── */}
        <section className="border border-[#30363D] bg-[#161B22] p-5">
          <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider mb-1">IR Materials</h2>
          <p className="text-[10px] font-mono text-[#8B949E] mb-4">사업 계획서 (23장) + 기술 개발 계획서 (14장)</p>

          <div className="space-y-4">
            <div>
              <h3 className="text-[10px] font-mono text-[#58A6FF] mb-2 uppercase">Business Plan</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {IR_SLIDES.map((slide, i) => (
                  <button key={slide.src} onClick={() => setLightboxIndex(i)} className="flex-shrink-0 w-40 h-24 overflow-hidden border border-[#30363D] hover:border-[#58A6FF] transition-all relative bg-[#0D1117]">
                    <Image src={slide.src} alt={slide.label} fill className="object-cover" sizes="160px" />
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 text-[9px] font-mono text-white">{String(i + 1).padStart(2, "0")}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-[10px] font-mono text-[#58A6FF] mb-2 uppercase">Technical Development Plan</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {TECH_SLIDES.map((slide, i) => (
                  <button key={slide.src} onClick={() => setLightboxIndex(IR_SLIDES.length + i)} className="flex-shrink-0 w-40 h-24 overflow-hidden border border-[#30363D] hover:border-[#58A6FF] transition-all relative bg-[#0D1117]">
                    <Image src={slide.src} alt={slide.label} fill className="object-cover" sizes="160px" />
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 text-[9px] font-mono text-white">{String(i + 1).padStart(2, "0")}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 푸터 ── */}
        <div className="border-t border-[#21262D] pt-6 text-center space-y-2">
          <p className="text-xs font-mono text-[#8B949E]">INPICK — AI-powered Interior Estimation Platform</p>
          <p className="text-[10px] font-mono text-[#484F58]">대전광역시 | 대표 김선본 | 예비창업패키지 참여기업</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <a href="/" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-[#58A6FF] hover:underline flex items-center gap-1">
              WEBSITE <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <a href="/project/new" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-[#58A6FF] hover:underline flex items-center gap-1">
              CONSUMER DEMO <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <a href="/find-contractors" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-[#58A6FF] hover:underline flex items-center gap-1">
              DIRECTORY <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      </div>

      {/* ── Feature Modal ── */}
      {selectedFeature && <FeatureModal feature={selectedFeature} onClose={() => setSelectedFeature(null)} />}

      {/* ── IR Lightbox ── */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button className="absolute top-4 right-4 w-8 h-8 bg-[#21262D] border border-[#30363D] hover:border-[#8B949E] flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
            <X className="w-4 h-4 text-[#8B949E]" />
          </button>
          {lightboxIndex > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#21262D] border border-[#30363D] hover:border-[#8B949E] flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}>
              <ChevronLeft className="w-4 h-4 text-[#8B949E]" />
            </button>
          )}
          {lightboxIndex < ALL_SLIDES.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#21262D] border border-[#30363D] hover:border-[#8B949E] flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}>
              <ChevronRight className="w-4 h-4 text-[#8B949E]" />
            </button>
          )}
          <div className="relative w-[90vw] max-w-5xl h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <Image src={ALL_SLIDES[lightboxIndex].src} alt={ALL_SLIDES[lightboxIndex].label} fill className="object-contain" sizes="90vw" priority />
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#21262D] border border-[#30363D] text-[10px] font-mono text-[#8B949E]">
            {lightboxIndex + 1} / {ALL_SLIDES.length}
          </div>
        </div>
      )}
    </div>
  );
}
