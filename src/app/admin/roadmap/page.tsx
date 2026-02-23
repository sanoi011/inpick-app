"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Rocket, CheckCircle2, Clock, Circle,
  ScanLine, Box, MessageSquare, Calculator, FileText, PenTool,
  Image as ImageIcon, Layers, Users, BarChart3, CreditCard,
  Smartphone, Wifi, Shield,
  ChevronLeft, ChevronRight, X, ExternalLink,
  Monitor, Cpu, Database, Wrench,
  Home, Palette, Camera, DollarSign, Send,
  Building2, Briefcase, Bot, Calendar, PieChart, UserCircle,
  Zap, TrendingUp, Target,
} from "lucide-react";

// ─── 요약 통계 ───

const STATS = [
  { label: "완성 기능", value: "35+", sub: "핵심 기능 모듈", color: "text-green-600", bg: "bg-green-50" },
  { label: "페이지 수", value: "40+", sub: "소비자+사업자+관리자", color: "text-blue-600", bg: "bg-blue-50" },
  { label: "API 라우트", value: "70+", sub: "보안 감사 완료", color: "text-purple-600", bg: "bg-purple-50" },
  { label: "DB 테이블", value: "26+", sub: "Supabase 마이그레이션", color: "text-amber-600", bg: "bg-amber-50" },
];

// ─── 완성된 핵심 기능 ───

const FEATURES = [
  {
    icon: ScanLine, title: "AI 도면 인식",
    desc: "Gemini Vision + YOLOv8 + PyMuPDF 5소스 융합 파이프라인. 22초 만에 건축도면 자동 분석.",
    tags: ["Gemini 2.0", "YOLO", "PyMuPDF"],
  },
  {
    icon: Box, title: "2D/3D 도면 뷰어",
    desc: "SVG 치수선 + Three.js PBR 재질 렌더링. 팬/줌, 카메라 모드, 설비 심볼 지원.",
    tags: ["Three.js", "SVG", "PBR"],
    link: "/project/new",
  },
  {
    icon: MessageSquare, title: "AI 디자인 상담",
    desc: "Gemini 2.0 Flash 멀티모달 + RAG 지식베이스. 사진/도면 기반 실시간 상담.",
    tags: ["Gemini", "RAG", "SSE"],
  },
  {
    icon: Calculator, title: "17공종 물량산출",
    desc: "한국 아파트 표준 기반 자동 산출 엔진. 60+ 항목 단가DB (2025 서울 기준).",
    tags: ["17공종", "60+ 단가", "자동 산출"],
  },
  {
    icon: PenTool, title: "시공도면 자동생성",
    desc: "가구배치도 / 전기배선도 / 입면전개도. 다크 테마 SVG + Gemini AI 보강.",
    tags: ["SVG", "입면도", "AI 보강"],
  },
  {
    icon: FileText, title: "견적서/계약서 PDF",
    desc: "jsPDF 한국어 NanumGothic. 견적서 + 공정위 표준계약서 + 시공도면 A3 PDF.",
    tags: ["jsPDF", "한국어", "표준양식"],
  },
  {
    icon: ImageIcon, title: "실시간 도면 생성",
    desc: "네이버 원본 → Gemini Pro 클린 → 좌우 반전 → 세그멘테이션 마스크. SSE 실시간 진행.",
    tags: ["Gemini Pro", "SSE", "sharp"],
  },
  {
    icon: Layers, title: "세그멘테이션 마스크",
    desc: "방별 색상 분류 마스크 PNG. Canvas 픽셀 조작으로 자재 실시간 오버레이.",
    tags: ["Canvas", "픽셀 캐시", "실시간"],
  },
  {
    icon: Home, title: "소비자 6탭 워크플로우",
    desc: "우리집 찾기 → 도면/3D → AI 디자인 → 렌더링 → 물량산출 → 견적요청.",
    tags: ["6탭", "E2E", "모바일"],
    link: "/project/new",
  },
  {
    icon: Building2, title: "사업자 포털 8페이지",
    desc: "대시보드, 입찰, 프로젝트, AI, 매칭, 일정, 재무, 프로필. 실시간 알림 연동.",
    tags: ["8페이지", "Realtime", "CRM"],
    link: "/auth?type=contractor",
  },
  {
    icon: Wifi, title: "실시간 채팅",
    desc: "Supabase Realtime postgres_changes. 옵티미스틱 UI + 자동 스크롤 + 읽음 처리.",
    tags: ["Realtime", "WebSocket", "옵티미스틱"],
  },
  {
    icon: BarChart3, title: "공정관리 Gantt",
    desc: "SVG/DOM 하이브리드 Gantt 차트. 드래그 리사이즈, 7공정 자동 배분, 사진 업로드.",
    tags: ["Gantt", "드래그", "사진"],
  },
  {
    icon: Users, title: "업체 디렉토리",
    desc: "종합/전문 업체 검색. 공종별/지역별 필터, 포트폴리오, 리뷰, 문의.",
    tags: ["검색", "필터", "포트폴리오"],
    link: "/find-contractors",
  },
  {
    icon: CreditCard, title: "Toss 결제 연동",
    desc: "크레딧 충전 + 웹훅 검증 + 결제 이력. Mock 모드 지원.",
    tags: ["Toss", "웹훅", "크레딧"],
  },
  {
    icon: Shield, title: "보안 감사 + E2E 테스트",
    desc: "70+ API 전수 인증/권한 검사. Playwright 33개 테스트. PWA + SEO 최적화.",
    tags: ["보안 감사", "E2E", "PWA"],
  },
];

// ─── 샘플 도면 데이터 ───

const SAMPLE_TYPES = [
  { id: "59", label: "59㎡ (18평)", rooms: "3BR/2BA", area: 59, estimate: "6,433만원", color: "border-emerald-400", bg: "bg-emerald-50" },
  { id: "84a", label: "84A㎡ (25평)", rooms: "4BR/2BA", area: 84, estimate: "7,983만원", color: "border-blue-400", bg: "bg-blue-50" },
  { id: "84b", label: "84B㎡ (25평)", rooms: "3BR/2BA", area: 84, estimate: "6,813만원", color: "border-purple-400", bg: "bg-purple-50" },
];

// ─── 기술 스택 ───

const TECH_STACK = [
  {
    category: "프론트엔드",
    icon: Monitor,
    color: "text-blue-600",
    bg: "bg-blue-50",
    items: ["Next.js 14", "TypeScript", "Tailwind CSS", "Three.js / R3F", "Playwright"],
  },
  {
    category: "AI 엔진",
    icon: Cpu,
    color: "text-purple-600",
    bg: "bg-purple-50",
    items: ["Gemini 2.0 Flash", "Gemini 2.5 Pro", "YOLOv8 (ONNX)", "PyMuPDF", "EasyOCR"],
  },
  {
    category: "백엔드 / 인프라",
    icon: Database,
    color: "text-green-600",
    bg: "bg-green-50",
    items: ["Supabase (PostgreSQL)", "Auth + Storage", "Realtime WebSocket", "Vercel Edge", "pgvector"],
  },
  {
    category: "기타 도구",
    icon: Wrench,
    color: "text-amber-600",
    bg: "bg-amber-50",
    items: ["jsPDF (한국어)", "bcrypt / HMAC", "sharp (이미지)", "pdfjs-dist", "Service Worker"],
  },
];

// ─── 소비자 워크플로우 ───

const CONSUMER_TABS = [
  { icon: Home, label: "우리집 찾기", desc: "주소검색 → 건물선택 → 도면타입" },
  { icon: Box, label: "도면/3D", desc: "2D/3D뷰어 + 벽그리기" },
  { icon: Palette, label: "AI 디자인", desc: "Gemini 상담 + 이미지 생성" },
  { icon: Camera, label: "3D 렌더링", desc: "자재선택 + 마스크 오버레이" },
  { icon: DollarSign, label: "물량산출", desc: "17공종 자동산출 + PDF" },
  { icon: Send, label: "견적요청", desc: "RFQ → 입찰 → 계약" },
];

// ─── 사업자 포탈 ───

const CONTRACTOR_PAGES = [
  { icon: BarChart3, label: "대시보드" },
  { icon: Briefcase, label: "입찰 관리" },
  { icon: Building2, label: "프로젝트" },
  { icon: Bot, label: "AI 비서" },
  { icon: Users, label: "업체 매칭" },
  { icon: Calendar, label: "일정 관리" },
  { icon: PieChart, label: "재무 관리" },
  { icon: UserCircle, label: "프로필" },
];

// ─── 개발 로드맵 ───

const MILESTONES = [
  {
    phase: "Phase 1",
    title: "MVP 완성",
    period: "2026.01 ~ 02",
    status: "completed" as const,
    items: [
      "AI 도면 인식 파이프라인 (5소스 융합)",
      "소비자 6탭 워크플로우 전체 구현",
      "사업자 8개 페이지 포털",
      "관리자 대시보드 12개 페이지",
      "17공종 물량산출 엔진 + 3타입 검증",
      "실시간 채팅 (Supabase Realtime)",
      "공정관리 Gantt 차트",
      "시공도면 자동생성 (가구배치/전기/입면)",
      "견적서·계약서·도면 PDF 3종",
      "보안 감사 (70+ API 전수 검사)",
      "E2E 테스트 33개 (Playwright)",
      "PWA + SEO + 다국어(한/영)",
      "실시간 도면 생성 파이프라인",
      "세그멘테이션 마스크 자재 오버레이",
    ],
  },
  {
    phase: "Phase 2",
    title: "서비스 고도화",
    period: "2026.03 ~ 04",
    status: "in_progress" as const,
    items: [
      "입면전개도 서비스 고도화 (방별 상세 벽면)",
      "AI 3D 인테리어 렌더링 (텍스처 생성)",
      "카카오 로그인 연동",
      "Toss Payments 실결제 오픈",
      "다평형 도면 라이브러리 확장 (30+ 타입)",
      "사업자 SaaS 구독 모델 (월간/연간)",
      "자재사 API 연동 (실시간 시세 반영)",
      "모바일 앱 (React Native / PWA 강화)",
      "커스텀 도메인 + 프로덕션 배포",
    ],
  },
  {
    phase: "Phase 3",
    title: "스케일업",
    period: "2026.05 ~",
    status: "planned" as const,
    items: [
      "B2C 타겟 광고 (계약 진행 유저 대상)",
      "자재 추천 AI (공종별 자재사 PPL)",
      "기능공 매칭 수수료 모델",
      "프리미엄 리스팅 (시공사/자재사)",
      "AR 도면 오버레이 (ARKit / ARCore)",
      "전국 지역 확장 (수도권 → 전국 광역시)",
      "해외 진출 준비 (동남아 인테리어 시장)",
      "데이터 기반 가격 예측 모델",
    ],
  },
];

// ─── IR 갤러리 ───

const IR_SLIDES = Array.from({ length: 23 }, (_, i) => ({
  src: `/ir/ir-${String(i + 1).padStart(2, "0")}.png`,
  label: `IR ${i + 1}`,
}));

const TECH_SLIDES = Array.from({ length: 14 }, (_, i) => ({
  src: `/ir/tech-${String(i + 1).padStart(2, "0")}.png`,
  label: `기술 ${i + 1}`,
}));

const ALL_SLIDES = [...IR_SLIDES, ...TECH_SLIDES];

// ─── 컴포넌트 ───

function StatusBadge({ status }: { status: "completed" | "in_progress" | "planned" }) {
  const map = {
    completed: { label: "완료", cls: "bg-green-100 text-green-700" },
    in_progress: { label: "진행 예정", cls: "bg-blue-100 text-blue-700" },
    planned: { label: "계획", cls: "bg-gray-100 text-gray-600" },
  };
  const { label, cls } = map[status];
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function TimelineIcon({ status }: { status: "completed" | "in_progress" | "planned" }) {
  if (status === "completed") return <CheckCircle2 className="w-6 h-6 text-green-500" />;
  if (status === "in_progress") return <Clock className="w-6 h-6 text-blue-500" />;
  return <Circle className="w-6 h-6 text-gray-400" />;
}

export default function RoadmapPage() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
      {/* ── 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Rocket className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">INPICK 개발 로드맵</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">AI로 골라담는 인테리어 종합 솔루션 — 투자자 쇼케이스</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white self-start">
          v2026.02
        </span>
      </div>

      {/* ── 요약 통계 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5 border border-gray-100`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{s.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── 소비자 워크플로우 미리보기 ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">소비자 워크플로우 (6탭)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {CONSUMER_TABS.map((tab, i) => (
            <div key={tab.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-2">
                <tab.icon className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-xs font-bold text-gray-400 mb-0.5">Step {i + 1}</p>
              <p className="text-sm font-semibold text-gray-900">{tab.label}</p>
              <p className="text-xs text-gray-500 mt-1">{tab.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 사업자 포털 미리보기 ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">사업자 포털 (8페이지)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {CONTRACTOR_PAGES.map((p) => (
            <div key={p.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p.icon className="w-5 h-5 text-gray-600 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-gray-700">{p.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 완성된 핵심 기능 ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">완성된 핵심 기능</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-5 h-5 text-gray-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{f.title}</h3>
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                <div className="flex flex-wrap gap-1">
                  {f.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600">{t}</span>
                  ))}
                </div>
                {f.link && (
                  <a href={f.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                    Demo <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 샘플 도면 데이터 ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">샘플 도면 + 견적 검증 결과</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_TYPES.map((s) => (
            <div key={s.id} className={`bg-white rounded-xl border-2 ${s.color} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">{s.label}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.bg} text-gray-700`}>{s.rooms}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">면적</p>
                  <p className="text-lg font-bold text-gray-900">{s.area}㎡</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">예상 견적</p>
                  <p className="text-lg font-bold text-blue-600">{s.estimate}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1 text-xs text-gray-500">
                <span className="px-2 py-0.5 rounded bg-green-50 text-green-700">17공종 산출</span>
                <span className="px-2 py-0.5 rounded bg-green-50 text-green-700">미매칭 0건</span>
                <span className="px-2 py-0.5 rounded bg-green-50 text-green-700">E2E 검증 PASS</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
          모든 견적은 2025년 서울 실거래 기준 60+ 항목 단가DB 기반. 직접비 + 관리비(6%) + 이윤(5%) + 부가세(10%) 포함.
        </div>
      </section>

      {/* ── 기술 스택 ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">기술 스택</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TECH_STACK.map((t) => (
            <div key={t.category} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${t.bg} flex items-center justify-center`}>
                  <t.icon className={`w-4 h-4 ${t.color}`} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{t.category}</h3>
              </div>
              <ul className="space-y-1.5">
                {t.items.map((item) => (
                  <li key={item} className="text-xs text-gray-600 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── 개발 로드맵 타임라인 ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-6">개발 로드맵</h2>
        <div className="relative">
          {/* 세로 라인 */}
          <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-8">
            {MILESTONES.map((m) => (
              <div key={m.phase} className="relative pl-12">
                {/* 타임라인 아이콘 */}
                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                  <TimelineIcon status={m.status} />
                </div>

                <div className={`rounded-xl border p-5 ${
                  m.status === "completed" ? "bg-green-50/50 border-green-200" :
                  m.status === "in_progress" ? "bg-blue-50/50 border-blue-200" :
                  "bg-gray-50/50 border-gray-200"
                }`}>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="text-xs font-bold text-gray-400 uppercase">{m.phase}</span>
                    <h3 className="font-bold text-gray-900">{m.title}</h3>
                    <span className="text-xs text-gray-500">{m.period}</span>
                    <StatusBadge status={m.status} />
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                    {m.items.map((item) => (
                      <li key={item} className="text-sm text-gray-700 flex items-start gap-2">
                        {m.status === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        ) : m.status === "in_progress" ? (
                          <Zap className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <Target className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        )}
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

      {/* ── 수익 모델 요약 ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">수익 모델</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-gray-900">핵심 수익모델</h3>
            </div>
            <div className="space-y-3">
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="font-medium text-sm text-gray-900">사용자 수수료</p>
                <p className="text-xs text-gray-600 mt-1">전자계약 및 에스크로 이용 건당 수수료. 낮은 진입 장벽으로 초기 트래픽 및 거래 데이터 확보.</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="font-medium text-sm text-gray-900">기업용 SaaS 구독료</p>
                <p className="text-xs text-gray-600 mt-1">시공사/자재사 대상 3단계 월 구독 모델. 기본 노출, 견적 관리, 고객 CRM 기능 차등 제공.</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">확장 수익모델</h3>
            </div>
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="font-medium text-sm text-gray-900">B2C 타겟 광고 + 자재 추천 AI</p>
                <p className="text-xs text-gray-600 mt-1">계약 진행 유저 대상 가전/이사/청소 맞춤형 광고. 공종별 자재사 추천 알고리즘 PPL 노출.</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="font-medium text-sm text-gray-900">프리미엄 리스팅 + 기능공 매칭</p>
                <p className="text-xs text-gray-600 mt-1">카테고리별 상단 노출 광고료. 시공사가 필요한 전문 기능공 중개 수수료.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── IR 자료 갤러리 ── */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-2">IR 자료</h2>
        <p className="text-sm text-gray-500 mb-4">사업 계획서 (23장) + 기술 개발 계획서 (14장) — 클릭하면 확대</p>

        <div className="space-y-4">
          {/* 사업 계획서 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">사업 계획서</h3>
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
              {IR_SLIDES.map((slide, i) => (
                <button
                  key={slide.src}
                  onClick={() => setLightboxIndex(i)}
                  className="flex-shrink-0 w-48 h-28 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all relative bg-gray-100"
                >
                  <Image src={slide.src} alt={slide.label} fill className="object-cover" sizes="192px" />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded">{i + 1}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 기술 개발 계획서 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">서비스 기술 개발 계획서</h3>
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
              {TECH_SLIDES.map((slide, i) => (
                <button
                  key={slide.src}
                  onClick={() => setLightboxIndex(IR_SLIDES.length + i)}
                  className="flex-shrink-0 w-48 h-28 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all relative bg-gray-100"
                >
                  <Image src={slide.src} alt={slide.label} fill className="object-cover" sizes="192px" />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded">{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Lightbox 모달 ── */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}

          {lightboxIndex < ALL_SLIDES.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          )}

          <div className="relative w-[90vw] max-w-5xl h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={ALL_SLIDES[lightboxIndex].src}
              alt={ALL_SLIDES[lightboxIndex].label}
              fill
              className="object-contain"
              sizes="90vw"
              priority
            />
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/20 text-white text-sm">
            {lightboxIndex + 1} / {ALL_SLIDES.length}
          </div>
        </div>
      )}

      {/* ── 푸터 ── */}
      <div className="border-t border-gray-200 pt-6 text-center">
        <p className="text-sm text-gray-500">
          INPICK (인픽) — AI로 골라담는 인테리어 종합 솔루션
        </p>
        <p className="text-xs text-gray-400 mt-1">
          대전광역시 | 대표 김선본 | 예비창업패키지 참여기업
        </p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <a href="/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            메인 웹사이트 <ExternalLink className="w-3 h-3" />
          </a>
          <a href="/project/new" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            소비자 데모 <ExternalLink className="w-3 h-3" />
          </a>
          <a href="/find-contractors" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            업체 디렉토리 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
