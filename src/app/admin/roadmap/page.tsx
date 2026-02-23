"use client";

import { useState, useEffect, useCallback } from "react";
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
  Pencil, Trash2, Plus, Save, GripVertical,
  ArrowUpDown, Settings2, Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── 아이콘 매핑 ───

const ICON_MAP: Record<string, LucideIcon> = {
  ScanLine, Box, MessageSquare, Calculator, FileText, PenTool,
  ImageIcon, Layers, Users, BarChart3, CreditCard, Smartphone, Shield,
  Monitor, Cpu, Database, Wrench, Home, Palette, Camera, DollarSign,
  Send, Building2, Briefcase, Bot, Calendar, PieChart, UserCircle,
  Zap, Target, Wifi, TrendingUp, Rocket, Play, AlertTriangle,
  ArrowUpDown, Settings2, Upload, GripVertical,
};

const ICON_NAMES = Object.keys(ICON_MAP);

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Zap;
}

// ─── 타입 ───

type FeatureStatus = "completed" | "in_progress" | "planned";

interface DbFeature {
  id: string;
  title: string;
  description: string;
  detail: string | null;
  icon_name: string;
  tags: string[];
  status: FeatureStatus;
  sort_order: number;
  link: string | null;
  has_demo: boolean;
  images: { src: string; label: string }[];
}

interface DbMilestone {
  id: string;
  phase: string;
  title: string;
  period: string;
  status: FeatureStatus;
  items: string[];
  sort_order: number;
}

interface DbStat {
  id: string;
  label: string;
  value: string;
  sub: string | null;
  sort_order: number;
}

// ─── 기본 데이터 (시드용) ───

const DEFAULT_FEATURES: Omit<DbFeature, "id">[] = [
  { title: "AI 도면 인식", description: "Gemini 3.0 Pro + YOLOv26 + PyMuPDF 5소스 융합 파이프라인", detail: "PDF/이미지 업로드 → 5개 소스 병렬 분석:\n1. Gemini 3.0 Pro Vision\n2. YOLOv26 (ONNX)\n3. PyMuPDF\n4. floorplan-ai\n5. Template Matcher\n\n검증: 59/84A/84B 3타입 신뢰도 1.0", icon_name: "ScanLine", tags: ["Gemini 3.0", "YOLOv26", "PyMuPDF"], status: "completed", sort_order: 0, link: null, has_demo: false, images: [] },
  { title: "2D/3D 도면 뷰어", description: "SVG 치수선 + Three.js PBR 재질 렌더링", detail: "2D: SVG 엔지니어링 도면\n3D: Three.js R3F PBR + SSAO + Bloom", icon_name: "Box", tags: ["Three.js", "SVG", "PBR"], status: "completed", sort_order: 1, link: "/project/new", has_demo: false, images: [] },
  { title: "AI 디자인 상담", description: "Gemini 3.0 Pro 멀티모달 + RAG 지식베이스", detail: "SSE 스트리밍 + RAG 시맨틱 검색", icon_name: "MessageSquare", tags: ["Gemini 3.0", "RAG", "SSE"], status: "completed", sort_order: 2, link: null, has_demo: false, images: [] },
  { title: "17공종 물량산출", description: "한국 아파트 표준 기반 자동 산출 엔진 60+ 항목 단가DB", detail: "17개 공종 모듈, 3타입 모두 E2E PASS", icon_name: "Calculator", tags: ["17공종", "60+ 단가"], status: "completed", sort_order: 3, link: null, has_demo: false, images: [] },
  { title: "견적서/계약서 PDF", description: "jsPDF 한국어 NanumGothic + 공정위 표준계약서", detail: "3종 PDF 자동 생성", icon_name: "FileText", tags: ["jsPDF", "한국어"], status: "completed", sort_order: 4, link: null, has_demo: false, images: [] },
  { title: "실시간 도면 생성", description: "네이버 원본 → Gemini 3.0 Pro 4단계 SSE 파이프라인", detail: "4단계 SSE: 다운로드→클린→반전→마스크", icon_name: "ImageIcon", tags: ["Gemini 3.0", "SSE"], status: "completed", sort_order: 5, link: null, has_demo: false, images: [] },
  { title: "세그멘테이션 마스크", description: "Canvas 픽셀 조작 자재 실시간 오버레이", detail: "13개 방 타입 RGB 매핑 + alpha blend", icon_name: "Layers", tags: ["Canvas", "실시간"], status: "completed", sort_order: 6, link: null, has_demo: false, images: [] },
  { title: "소비자 6탭 워크플로우", description: "우리집 찾기→도면/3D→AI 디자인→렌더링→물량산출→견적요청", detail: "6탭 + 4가지 도면 입력 방식", icon_name: "Home", tags: ["6탭", "E2E"], status: "completed", sort_order: 7, link: "/project/new", has_demo: false, images: [] },
  { title: "사업자 포털 8페이지", description: "대시보드/입찰/프로젝트/AI/매칭/일정/재무/프로필", detail: "8개 페이지 완전 구현", icon_name: "Building2", tags: ["8페이지", "CRM"], status: "completed", sort_order: 8, link: "/auth?type=contractor", has_demo: false, images: [] },
  { title: "실시간 채팅", description: "Supabase Realtime + 옵티미스틱 UI", detail: "postgres_changes 구독", icon_name: "Wifi", tags: ["Realtime", "WebSocket"], status: "completed", sort_order: 9, link: null, has_demo: false, images: [] },
  { title: "공정관리 Gantt", description: "SVG/DOM 하이브리드 Gantt + 드래그 리사이즈", detail: "7공정 자동 배분", icon_name: "BarChart3", tags: ["Gantt", "드래그"], status: "completed", sort_order: 10, link: null, has_demo: false, images: [] },
  { title: "업체 디렉토리", description: "종합/전문 업체 검색, 필터, 포트폴리오", detail: "업체 상세 4탭", icon_name: "Users", tags: ["검색", "필터"], status: "completed", sort_order: 11, link: "/find-contractors", has_demo: false, images: [] },
  { title: "Toss 결제 연동", description: "크레딧 충전 + 웹훅 검증 + 결제 이력", detail: "Mock 모드 지원", icon_name: "CreditCard", tags: ["Toss", "웹훅"], status: "completed", sort_order: 12, link: null, has_demo: false, images: [] },
  { title: "보안 감사 + E2E 테스트", description: "70+ API 전수 인증 검사, Playwright 33개", detail: "보안 감사 Rounds 8-13", icon_name: "Shield", tags: ["보안", "E2E"], status: "completed", sort_order: 13, link: null, has_demo: false, images: [] },
  { title: "입면전개도 AI 생성", description: "참고 이미지 + 도면 + 인테리어 4컷 → Gemini 3.0 Pro → SVG", detail: "하이브리드 파이프라인: 입력 → Gemini 3.0 Pro → 방별 벽 전개도 JSON → SVG 렌더링", icon_name: "PenTool", tags: ["Gemini 3.0", "SVG", "입면도"], status: "in_progress", sort_order: 0, link: null, has_demo: true, images: Array.from({ length: 9 }, (_, i) => ({ src: `/showcase/elevation-${String(i + 1).padStart(2, "0")}.jpg`, label: `입면전개도 참고 ${i + 1}` })) },
  { title: "시공도면 자동생성 고도화", description: "가구배치도/전기배선도/입면전개도 3종 AI 보강", detail: "3종 도면 + Gemini 3.0 Pro 보강", icon_name: "PenTool", tags: ["SVG", "Gemini 3.0"], status: "in_progress", sort_order: 1, link: null, has_demo: false, images: [] },
  { title: "AI 3D 인테리어 렌더링", description: "Gemini 3.0 Pro 텍스처 생성 + WebGL", detail: "스타일별 4컷 병렬 생성", icon_name: "Camera", tags: ["Gemini 3.0", "WebGL"], status: "in_progress", sort_order: 2, link: null, has_demo: false, images: [] },
  { title: "카카오 로그인 연동", description: "Supabase Auth 카카오 provider", detail: null, icon_name: "Smartphone", tags: ["카카오", "OAuth"], status: "planned", sort_order: 0, link: null, has_demo: false, images: [] },
  { title: "Toss 실결제 오픈", description: "Mock → 실결제 전환", detail: null, icon_name: "CreditCard", tags: ["Toss", "결제"], status: "planned", sort_order: 1, link: null, has_demo: false, images: [] },
  { title: "다평형 도면 라이브러리 (30+)", description: "전국 아파트 도면 수집 + 자동 파싱", detail: null, icon_name: "Database", tags: ["30+ 타입"], status: "planned", sort_order: 2, link: null, has_demo: false, images: [] },
  { title: "사업자 SaaS 구독", description: "월간/연간 3단계 플랜", detail: null, icon_name: "Building2", tags: ["SaaS", "구독"], status: "planned", sort_order: 3, link: null, has_demo: false, images: [] },
  { title: "자재사 API 연동", description: "실시간 시세 반영", detail: null, icon_name: "DollarSign", tags: ["API", "단가"], status: "planned", sort_order: 4, link: null, has_demo: false, images: [] },
  { title: "모바일 앱", description: "React Native + PWA 강화", detail: null, icon_name: "Smartphone", tags: ["React Native"], status: "planned", sort_order: 5, link: null, has_demo: false, images: [] },
  { title: "B2C 타겟 광고", description: "계약 진행 유저 맞춤형 광고 + PPL", detail: null, icon_name: "Target", tags: ["광고", "AI 추천"], status: "planned", sort_order: 6, link: null, has_demo: false, images: [] },
  { title: "AR 도면 오버레이 + 전국 확장", description: "ARKit/ARCore + 수도권→전국", detail: null, icon_name: "TrendingUp", tags: ["AR", "확장"], status: "planned", sort_order: 7, link: null, has_demo: false, images: [] },
];

const DEFAULT_MILESTONES: Omit<DbMilestone, "id">[] = [
  { phase: "Phase 1", title: "1.0 출시버전 완성", period: "2026.01 ~ 02", status: "completed", sort_order: 0, items: ["AI 도면 인식 (5소스 융합)", "소비자 6탭 워크플로우", "사업자 8페이지 포털", "관리자 12페이지", "17공종 물량산출 엔진", "실시간 채팅", "공정관리 Gantt", "시공도면 3종", "PDF 3종", "보안 감사 70+ API", "E2E 33테스트", "PWA + SEO"] },
  { phase: "Phase 2", title: "서비스 고도화", period: "2026.03 ~ 04", status: "in_progress", sort_order: 1, items: ["입면전개도 AI 생성", "AI 3D 렌더링", "카카오 로그인", "Toss 실결제", "다평형 30+ 타입", "SaaS 구독", "자재사 API", "모바일 앱", "커스텀 도메인"] },
  { phase: "Phase 3", title: "스케일업", period: "2026.05 ~", status: "planned", sort_order: 2, items: ["B2C 광고", "자재 AI (PPL)", "기능공 매칭 수수료", "프리미엄 리스팅", "AR 도면 오버레이", "전국 확장", "해외 진출", "가격 예측"] },
];

const DEFAULT_STATS: Omit<DbStat, "id">[] = [
  { label: "완성 기능", value: "35+", sub: "핵심 기능 모듈", sort_order: 0 },
  { label: "페이지 수", value: "40+", sub: "소비자+사업자+관리자", sort_order: 1 },
  { label: "API 라우트", value: "70+", sub: "보안 감사 완료", sort_order: 2 },
  { label: "DB 테이블", value: "26+", sub: "Supabase 마이그레이션", sort_order: 3 },
];

// ─── 통계 카드 스타일 ───

const STAT_STYLES = [
  { color: "text-emerald-400", bg: "bg-[#0F1A14]", border: "border-emerald-900/50" },
  { color: "text-blue-400", bg: "bg-[#0F1420]", border: "border-blue-900/50" },
  { color: "text-violet-400", bg: "bg-[#150F20]", border: "border-violet-900/50" },
  { color: "text-amber-400", bg: "bg-[#1A1509]", border: "border-amber-900/50" },
];

// ─── 워크플로우 (하드코딩 - 변경 빈도 낮음) ───

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

const TECH_STACK = [
  { category: "프론트엔드", icon: Monitor, items: ["Next.js 14", "TypeScript", "Tailwind CSS", "Three.js / R3F", "Playwright"] },
  { category: "AI 엔진", icon: Cpu, items: ["Gemini 3.0 Pro", "Gemini 3.0 Flash", "YOLOv26 (ONNX)", "PyMuPDF", "EasyOCR"] },
  { category: "백엔드", icon: Database, items: ["Supabase PostgreSQL", "Auth + Storage", "Realtime WebSocket", "Vercel Edge", "pgvector"] },
  { category: "도구", icon: Wrench, items: ["jsPDF (한국어)", "bcrypt / HMAC", "sharp", "pdfjs-dist", "Service Worker"] },
];

const IR_SLIDES = Array.from({ length: 23 }, (_, i) => ({ src: `/ir/ir-${String(i + 1).padStart(2, "0")}.png`, label: `IR ${i + 1}` }));
const TECH_SLIDES = Array.from({ length: 14 }, (_, i) => ({ src: `/ir/tech-${String(i + 1).padStart(2, "0")}.png`, label: `기술 ${i + 1}` }));
const ALL_SLIDES = [...IR_SLIDES, ...TECH_SLIDES];

// ─── 상태 배지 ───

function StatusBadge({ status }: { status: FeatureStatus }) {
  const map = {
    completed: { label: "COMPLETED", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    in_progress: { label: "IN PROGRESS", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    planned: { label: "PLANNED", cls: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider border ${cls}`}>{label}</span>;
}

function TimelineIcon({ status }: { status: FeatureStatus }) {
  if (status === "completed") return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
  if (status === "in_progress") return <Clock className="w-5 h-5 text-blue-400" />;
  return <Circle className="w-5 h-5 text-gray-600" />;
}

// ─── 기능 편집 모달 ───

function EditFeatureModal({
  feature,
  onSave,
  onClose,
}: {
  feature: Partial<DbFeature> | null;
  onSave: (data: Partial<DbFeature>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: feature?.title || "",
    description: feature?.description || "",
    detail: feature?.detail || "",
    icon_name: feature?.icon_name || "Zap",
    tags: (feature?.tags || []).join(", "),
    status: feature?.status || "planned" as FeatureStatus,
    link: feature?.link || "",
    has_demo: feature?.has_demo || false,
    sort_order: feature?.sort_order ?? 0,
  });

  const handleSubmit = () => {
    onSave({
      ...feature,
      title: form.title,
      description: form.description,
      detail: form.detail || null,
      icon_name: form.icon_name,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      status: form.status as FeatureStatus,
      link: form.link || null,
      has_demo: form.has_demo,
      sort_order: form.sort_order,
    });
  };

  const IconPreview = getIcon(form.icon_name);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#161B22] border border-[#30363D] w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#161B22] border-b border-[#30363D] px-5 py-3 flex items-center justify-between z-10">
          <h2 className="font-mono font-bold text-sm text-[#E6EDF3]">{feature?.id ? "EDIT FEATURE" : "NEW FEATURE"}</h2>
          <button onClick={onClose} className="w-7 h-7 border border-[#30363D] hover:border-[#8B949E] flex items-center justify-center bg-[#0D1117]">
            <X className="w-3.5 h-3.5 text-[#8B949E]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Title</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full bg-[#0D1117] border border-[#30363D] px-3 py-2 text-sm font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full bg-[#0D1117] border border-[#30363D] px-3 py-2 text-sm font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" />
          </div>

          {/* Detail */}
          <div>
            <label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Detail (Optional)</label>
            <textarea value={form.detail} onChange={e => setForm(p => ({ ...p, detail: e.target.value }))} rows={5} className="w-full bg-[#0D1117] border border-[#30363D] px-3 py-2 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none resize-none" />
          </div>

          {/* Icon + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Icon</label>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 border border-[#30363D] flex items-center justify-center bg-[#0D1117]">
                  <IconPreview className="w-4 h-4 text-[#58A6FF]" />
                </div>
                <select value={form.icon_name} onChange={e => setForm(p => ({ ...p, icon_name: e.target.value }))} className="flex-1 bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none">
                  {ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as FeatureStatus }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none">
                <option value="completed">COMPLETED</option>
                <option value="in_progress">IN PROGRESS</option>
                <option value="planned">PLANNED</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Tags (comma separated)</label>
            <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="Gemini 3.0, SVG, AI" className="w-full bg-[#0D1117] border border-[#30363D] px-3 py-2 text-sm font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" />
          </div>

          {/* Link + Sort + Demo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Link</label>
              <input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} placeholder="/project/new" className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.has_demo} onChange={e => setForm(p => ({ ...p, has_demo: e.target.checked }))} className="accent-[#58A6FF]" />
                <span className="text-[10px] font-mono text-[#8B949E]">HAS DEMO</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#21262D]">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-mono text-[#8B949E] border border-[#30363D] hover:border-[#8B949E] bg-[#0D1117]">CANCEL</button>
            <button onClick={handleSubmit} disabled={!form.title} className="px-3 py-1.5 text-xs font-mono font-bold text-white bg-[#238636] hover:bg-[#2EA043] disabled:opacity-40 flex items-center gap-1.5">
              <Save className="w-3 h-3" /> SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 마일스톤 편집 모달 ───

function EditMilestoneModal({
  milestone,
  onSave,
  onClose,
}: {
  milestone: Partial<DbMilestone> | null;
  onSave: (data: Partial<DbMilestone>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    phase: milestone?.phase || "",
    title: milestone?.title || "",
    period: milestone?.period || "",
    status: milestone?.status || "planned" as FeatureStatus,
    items: (milestone?.items || []).join("\n"),
    sort_order: milestone?.sort_order ?? 0,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#161B22] border border-[#30363D] w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#161B22] border-b border-[#30363D] px-5 py-3 flex items-center justify-between z-10">
          <h2 className="font-mono font-bold text-sm text-[#E6EDF3]">{milestone?.id ? "EDIT MILESTONE" : "NEW MILESTONE"}</h2>
          <button onClick={onClose} className="w-7 h-7 border border-[#30363D] hover:border-[#8B949E] flex items-center justify-center bg-[#0D1117]"><X className="w-3.5 h-3.5 text-[#8B949E]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Phase</label><input value={form.phase} onChange={e => setForm(p => ({ ...p, phase: e.target.value }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" /></div>
            <div><label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Title</label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" /></div>
            <div><label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Period</label><input value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as FeatureStatus }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none">
                <option value="completed">COMPLETED</option><option value="in_progress">IN PROGRESS</option><option value="planned">PLANNED</option>
              </select>
            </div>
            <div><label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Sort Order</label><input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" /></div>
          </div>
          <div><label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Items (한 줄에 하나)</label><textarea value={form.items} onChange={e => setForm(p => ({ ...p, items: e.target.value }))} rows={6} className="w-full bg-[#0D1117] border border-[#30363D] px-3 py-2 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none resize-none" /></div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#21262D]">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-mono text-[#8B949E] border border-[#30363D] hover:border-[#8B949E] bg-[#0D1117]">CANCEL</button>
            <button onClick={() => onSave({ ...milestone, phase: form.phase, title: form.title, period: form.period, status: form.status as FeatureStatus, items: form.items.split("\n").filter(Boolean), sort_order: form.sort_order })} className="px-3 py-1.5 text-xs font-mono font-bold text-white bg-[#238636] hover:bg-[#2EA043] flex items-center gap-1.5"><Save className="w-3 h-3" /> SAVE</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 통계 편집 모달 ───

function EditStatModal({ stat, onSave, onClose }: { stat: Partial<DbStat> | null; onSave: (data: Partial<DbStat>) => void; onClose: () => void }) {
  const [form, setForm] = useState({ label: stat?.label || "", value: stat?.value || "", sub: stat?.sub || "", sort_order: stat?.sort_order ?? 0 });
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#161B22] border border-[#30363D] w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="bg-[#161B22] border-b border-[#30363D] px-5 py-3 flex items-center justify-between">
          <h2 className="font-mono font-bold text-sm text-[#E6EDF3]">{stat?.id ? "EDIT STAT" : "NEW STAT"}</h2>
          <button onClick={onClose} className="w-7 h-7 border border-[#30363D] flex items-center justify-center bg-[#0D1117]"><X className="w-3.5 h-3.5 text-[#8B949E]" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Label</label><input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Value</label><input value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" /></div>
            <div><label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Sort</label><input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" /></div>
          </div>
          <div><label className="block text-[10px] font-mono text-[#8B949E] uppercase mb-1">Sub</label><input value={form.sub} onChange={e => setForm(p => ({ ...p, sub: e.target.value }))} className="w-full bg-[#0D1117] border border-[#30363D] px-2 py-1.5 text-xs font-mono text-[#E6EDF3] focus:border-[#58A6FF] focus:outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#21262D]">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-mono text-[#8B949E] border border-[#30363D] bg-[#0D1117]">CANCEL</button>
            <button onClick={() => onSave({ ...stat, ...form })} className="px-3 py-1.5 text-xs font-mono font-bold text-white bg-[#238636] hover:bg-[#2EA043] flex items-center gap-1.5"><Save className="w-3 h-3" /> SAVE</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 기능 카드 ───

function FeatureCard({ feature, editMode, onEdit, onDelete, onViewDetail }: {
  feature: DbFeature; editMode: boolean;
  onEdit: () => void; onDelete: () => void; onViewDetail: () => void;
}) {
  const Icon = getIcon(feature.icon_name);
  const statusIcon = {
    completed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    in_progress: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
    planned: <Circle className="w-3.5 h-3.5 text-gray-500" />,
  };

  return (
    <div className="bg-[#161B22] border border-[#30363D] p-4 flex flex-col hover:border-[#58A6FF]/50 transition-all group relative">
      {editMode && (
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          <button onClick={onEdit} className="w-6 h-6 bg-[#0D1117] border border-[#30363D] hover:border-[#58A6FF] flex items-center justify-center"><Pencil className="w-3 h-3 text-[#58A6FF]" /></button>
          <button onClick={onDelete} className="w-6 h-6 bg-[#0D1117] border border-[#30363D] hover:border-red-500 flex items-center justify-center"><Trash2 className="w-3 h-3 text-red-400" /></button>
        </div>
      )}
      <button onClick={onViewDetail} className="flex-1 text-left">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 border border-[#30363D] flex items-center justify-center flex-shrink-0 bg-[#0D1117] group-hover:border-[#58A6FF]/50">
            <Icon className="w-4 h-4 text-gray-400 group-hover:text-[#58A6FF] transition-colors" />
          </div>
          <div className="flex-1 min-w-0 pr-12">
            <div className="flex items-center gap-2">
              <h3 className="font-mono font-semibold text-[#E6EDF3] text-sm truncate">{feature.title}</h3>
              {statusIcon[feature.status]}
            </div>
            <p className="text-xs text-[#8B949E] mt-1 leading-relaxed line-clamp-2 font-mono">{feature.description}</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-[#21262D]">
          <div className="flex flex-wrap gap-1">
            {feature.tags.slice(0, 3).map(t => (
              <span key={t} className="px-1.5 py-0.5 text-[10px] font-mono text-[#8B949E] bg-[#21262D] border border-[#30363D]">{t}</span>
            ))}
          </div>
          {feature.has_demo && <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1"><Play className="w-3 h-3" />DEMO</span>}
        </div>
      </button>
    </div>
  );
}

// ─── 기능 상세 모달 ───

function FeatureDetailModal({ feature, onClose }: { feature: DbFeature; onClose: () => void }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [elevationSvg, setElevationSvg] = useState<string | null>(null);
  const [floorPlanSvg, setFloorPlanSvg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const Icon = getIcon(feature.icon_name);

  const handleGenerateElevation = useCallback(async () => {
    setGenerating(true); setGenError(null);
    try {
      const res = await fetch("/api/project/generate-elevation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: 84, roomCount: 3, style: "모던" }) });
      if (!res.ok) throw new Error("생성 실패");
      const data = await res.json();
      setElevationSvg(data.elevationSvg); setFloorPlanSvg(data.floorPlanSvg);
    } catch (err) { setGenError(err instanceof Error ? err.message : "오류 발생"); } finally { setGenerating(false); }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0D1117] border border-[#30363D] max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#161B22] border-b border-[#30363D] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border border-[#30363D] flex items-center justify-center bg-[#0D1117]"><Icon className="w-4.5 h-4.5 text-[#58A6FF]" /></div>
            <div>
              <div className="flex items-center gap-2"><h2 className="font-mono font-bold text-[#E6EDF3] text-base">{feature.title}</h2><StatusBadge status={feature.status} /></div>
              <div className="flex gap-1 mt-1">{feature.tags.map(t => <span key={t} className="px-1.5 py-0.5 text-[10px] font-mono text-[#58A6FF] bg-[#58A6FF]/10 border border-[#58A6FF]/20">{t}</span>)}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 border border-[#30363D] hover:border-[#8B949E] flex items-center justify-center bg-[#0D1117]"><X className="w-4 h-4 text-[#8B949E]" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#8B949E] font-mono">{feature.description}</p>
          {feature.detail && <div className="bg-[#161B22] border border-[#30363D] p-4"><pre className="text-xs text-[#C9D1D9] whitespace-pre-wrap font-mono leading-relaxed">{feature.detail}</pre></div>}

          {feature.has_demo && (
            <div className="border border-[#30363D] bg-[#161B22] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-mono font-bold text-[#E6EDF3]">LIVE DEMO</h3>
                <button onClick={handleGenerateElevation} disabled={generating} className="px-3 py-1.5 text-xs font-mono font-bold bg-[#238636] text-white hover:bg-[#2EA043] disabled:opacity-50 flex items-center gap-1.5">
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}{generating ? "GENERATING..." : "GENERATE"}
                </button>
              </div>
              {genError && <div className="flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2"><AlertTriangle className="w-3.5 h-3.5" />{genError}</div>}
              {elevationSvg && <div className="space-y-3">
                <div><p className="text-[10px] font-mono text-[#58A6FF] mb-1">OUTPUT: 입면전개도</p><div className="border border-[#30363D] overflow-auto max-h-[400px] bg-[#0D1117]" dangerouslySetInnerHTML={{ __html: elevationSvg }} /></div>
                {floorPlanSvg && <div><p className="text-[10px] font-mono text-[#58A6FF] mb-1">OUTPUT: 마감 평면도</p><div className="border border-[#30363D] overflow-auto max-h-[300px] bg-[#0D1117]" dangerouslySetInnerHTML={{ __html: floorPlanSvg }} /></div>}
              </div>}
            </div>
          )}

          {feature.images && feature.images.length > 0 && (
            <div>
              <h3 className="text-xs font-mono font-bold text-[#8B949E] mb-2 uppercase tracking-wider">Reference Images</h3>
              <div className="relative border border-[#30363D] overflow-hidden bg-[#0D1117]">
                <div className="relative w-full" style={{ paddingBottom: "75%" }}><Image src={feature.images[imgIndex].src} alt={feature.images[imgIndex].label} fill className="object-contain" sizes="672px" /></div>
                {imgIndex > 0 && <button className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/60 border border-[#30363D] flex items-center justify-center" onClick={() => setImgIndex(imgIndex - 1)}><ChevronLeft className="w-4 h-4 text-white" /></button>}
                {imgIndex < feature.images.length - 1 && <button className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/60 border border-[#30363D] flex items-center justify-center" onClick={() => setImgIndex(imgIndex + 1)}><ChevronRight className="w-4 h-4 text-white" /></button>}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/70 text-[10px] font-mono text-white border border-[#30363D]">{imgIndex + 1}/{feature.images.length}</div>
              </div>
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">{feature.images.map((img, i) => (
                <button key={img.src} onClick={() => setImgIndex(i)} className={`flex-shrink-0 w-14 h-10 overflow-hidden border ${i === imgIndex ? "border-[#58A6FF]" : "border-[#30363D]"}`}><Image src={img.src} alt={img.label} width={56} height={40} className="object-cover w-full h-full" /></button>
              ))}</div>
            </div>
          )}

          {feature.link && <a href={feature.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#21262D] text-[#58A6FF] text-xs font-mono border border-[#30363D] hover:border-[#58A6FF]">OPEN DEMO <ExternalLink className="w-3 h-3" /></a>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── 메인 페이지 ───
// ═══════════════════════════════════════════════════

export default function RoadmapPage() {
  // --- 데이터 상태 ---
  const [features, setFeatures] = useState<DbFeature[]>([]);
  const [milestones, setMilestones] = useState<DbMilestone[]>([]);
  const [stats, setStats] = useState<DbStat[]>([]);
  const [fromDb, setFromDb] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- UI 상태 ---
  const [editMode, setEditMode] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Partial<DbFeature> | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Partial<DbMilestone> | null>(null);
  const [editingStat, setEditingStat] = useState<Partial<DbStat> | null>(null);
  const [detailFeature, setDetailFeature] = useState<DbFeature | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // --- 인증 헤더 ---
  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
  }), []);

  // --- 데이터 로드 ---
  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/roadmap", { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.fromDb && data.features.length > 0) {
        setFeatures(data.features);
        setMilestones(data.milestones);
        setStats(data.stats);
        setFromDb(true);
      } else {
        // DB 비어있음 → 기본 데이터 사용
        setFeatures(DEFAULT_FEATURES.map((f, i) => ({ ...f, id: `local-f-${i}` })) as DbFeature[]);
        setMilestones(DEFAULT_MILESTONES.map((m, i) => ({ ...m, id: `local-m-${i}` })) as DbMilestone[]);
        setStats(DEFAULT_STATS.map((s, i) => ({ ...s, id: `local-s-${i}` })) as DbStat[]);
        setFromDb(false);
      }
    } catch {
      // API 실패 → 기본 데이터
      setFeatures(DEFAULT_FEATURES.map((f, i) => ({ ...f, id: `local-f-${i}` })) as DbFeature[]);
      setMilestones(DEFAULT_MILESTONES.map((m, i) => ({ ...m, id: `local-m-${i}` })) as DbMilestone[]);
      setStats(DEFAULT_STATS.map((s, i) => ({ ...s, id: `local-s-${i}` })) as DbStat[]);
      setFromDb(false);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- 초기 데이터 시드 ---
  const handleSeed = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "seed", features: DEFAULT_FEATURES, milestones: DEFAULT_MILESTONES, stats: DEFAULT_STATS }),
      });
      if (res.ok) { await loadData(); }
    } catch { /* silently fail */ } finally { setSaving(false); }
  }, [loadData, authHeaders]);

  // --- CRUD 핸들러 ---
  const handleSaveFeature = useCallback(async (data: Partial<DbFeature>) => {
    setSaving(true);
    try {
      if (data.id && !data.id.startsWith("local-")) {
        await fetch("/api/admin/roadmap", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ type: "feature", ...data }) });
      } else {
        const { id: _fid, ...rest } = data;
        void _fid;
        await fetch("/api/admin/roadmap", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ type: "feature", ...rest }) });
      }
      await loadData();
    } catch { /* silently fail */ } finally { setSaving(false); setEditingFeature(null); }
  }, [loadData, authHeaders]);

  const handleDeleteFeature = useCallback(async (id: string) => {
    if (!confirm("이 기능 카드를 삭제하시겠습니까?")) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/roadmap?type=feature&id=${id}`, { method: "DELETE", headers: authHeaders() });
      await loadData();
    } catch { /* silently fail */ } finally { setSaving(false); }
  }, [loadData, authHeaders]);

  const handleSaveMilestone = useCallback(async (data: Partial<DbMilestone>) => {
    setSaving(true);
    try {
      if (data.id && !data.id.startsWith("local-")) {
        await fetch("/api/admin/roadmap", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ type: "milestone", ...data }) });
      } else {
        const { id: _mid, ...rest } = data;
        void _mid;
        await fetch("/api/admin/roadmap", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ type: "milestone", ...rest }) });
      }
      await loadData();
    } catch { /* silently fail */ } finally { setSaving(false); setEditingMilestone(null); }
  }, [loadData, authHeaders]);

  const handleDeleteMilestone = useCallback(async (id: string) => {
    if (!confirm("이 마일스톤을 삭제하시겠습니까?")) return;
    try { await fetch(`/api/admin/roadmap?type=milestone&id=${id}`, { method: "DELETE", headers: authHeaders() }); await loadData(); } catch { /* */ }
  }, [loadData, authHeaders]);

  const handleSaveStat = useCallback(async (data: Partial<DbStat>) => {
    setSaving(true);
    try {
      if (data.id && !data.id.startsWith("local-")) {
        await fetch("/api/admin/roadmap", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ type: "stat", ...data }) });
      } else {
        const { id: _sid, ...rest } = data;
        void _sid;
        await fetch("/api/admin/roadmap", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ type: "stat", ...rest }) });
      }
      await loadData();
    } catch { /* silently fail */ } finally { setSaving(false); setEditingStat(null); }
  }, [loadData, authHeaders]);

  const handleDeleteStat = useCallback(async (id: string) => {
    if (!confirm("이 통계를 삭제하시겠습니까?")) return;
    try { await fetch(`/api/admin/roadmap?type=stat&id=${id}`, { method: "DELETE", headers: authHeaders() }); await loadData(); } catch { /* */ }
  }, [loadData, authHeaders]);

  // --- 분류 ---
  const completedFeatures = features.filter(f => f.status === "completed");
  const inProgressFeatures = features.filter(f => f.status === "in_progress");
  const plannedFeatures = features.filter(f => f.status === "planned");

  if (loading) {
    return <div className="bg-[#0D1117] min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 text-[#58A6FF] animate-spin" /></div>;
  }

  return (
    <div className="bg-[#0D1117] min-h-screen text-[#E6EDF3]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">

        {/* ── 헤더 ── */}
        <div className="border-b border-[#21262D] pb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#161B22] border border-[#30363D] flex items-center justify-center"><Rocket className="w-5 h-5 text-[#58A6FF]" /></div>
              <div>
                <h1 className="text-xl font-mono font-bold tracking-tight">INPICK DEVELOPMENT ROADMAP</h1>
                <p className="text-xs font-mono text-[#8B949E] mt-0.5">AI-powered Interior Estimation Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!fromDb && (
                <button onClick={handleSeed} disabled={saving} className="px-3 py-1.5 text-[10px] font-mono font-bold text-white bg-[#238636] hover:bg-[#2EA043] disabled:opacity-50 flex items-center gap-1.5 border border-emerald-500/30">
                  <Upload className="w-3 h-3" /> DB 초기화
                </button>
              )}
              <button
                onClick={() => setEditMode(!editMode)}
                className={`px-3 py-1.5 text-[10px] font-mono font-bold border flex items-center gap-1.5 transition-colors ${editMode ? "bg-[#58A6FF]/20 text-[#58A6FF] border-[#58A6FF]/30" : "bg-[#161B22] text-[#8B949E] border-[#30363D] hover:border-[#8B949E]"}`}
              >
                <Settings2 className="w-3 h-3" /> {editMode ? "편집 모드 ON" : "편집 모드"}
              </button>
              <span className="px-2 py-1 text-[10px] font-mono font-bold bg-[#161B22] text-[#8B949E] border border-[#30363D]">
                {fromDb ? "DB" : "LOCAL"} · v2026.02
              </span>
            </div>
          </div>
          {saving && <div className="mt-2 h-0.5 bg-[#58A6FF]/30 overflow-hidden"><div className="h-full w-1/3 bg-[#58A6FF] animate-pulse" /></div>}
        </div>

        {/* ── 요약 통계 ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider">Summary Stats</h2>
            {editMode && <button onClick={() => setEditingStat({})} className="px-2 py-1 text-[10px] font-mono text-[#58A6FF] border border-[#30363D] hover:border-[#58A6FF] flex items-center gap-1"><Plus className="w-3 h-3" />추가</button>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((s, i) => {
              const style = STAT_STYLES[i % STAT_STYLES.length];
              return (
                <div key={s.id} className={`${style.bg} border ${style.border} p-4 relative group`}>
                  {editMode && (
                    <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                      <button onClick={() => setEditingStat(s)} className="w-5 h-5 bg-[#0D1117] border border-[#30363D] flex items-center justify-center"><Pencil className="w-2.5 h-2.5 text-[#58A6FF]" /></button>
                      <button onClick={() => handleDeleteStat(s.id)} className="w-5 h-5 bg-[#0D1117] border border-[#30363D] flex items-center justify-center"><Trash2 className="w-2.5 h-2.5 text-red-400" /></button>
                    </div>
                  )}
                  <p className={`text-2xl font-mono font-bold ${style.color}`}>{s.value}</p>
                  <p className="text-xs font-mono text-[#E6EDF3] mt-1">{s.label}</p>
                  <p className="text-[10px] font-mono text-[#8B949E] mt-0.5">{s.sub}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 워크플로우 미리보기 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-[#30363D] bg-[#161B22] p-4">
            <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider mb-3">Consumer Workflow (6 Tabs)</h2>
            <div className="grid grid-cols-3 gap-2">{CONSUMER_TABS.map((tab, i) => (
              <div key={tab.label} className="bg-[#0D1117] border border-[#21262D] p-2.5 text-center">
                <tab.icon className="w-4 h-4 text-[#58A6FF] mx-auto mb-1" /><p className="text-[10px] font-mono text-[#8B949E]">{String(i + 1).padStart(2, "0")}</p><p className="text-xs font-mono text-[#E6EDF3] font-bold">{tab.label}</p>
              </div>
            ))}</div>
          </div>
          <div className="border border-[#30363D] bg-[#161B22] p-4">
            <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider mb-3">Contractor Portal (8 Pages)</h2>
            <div className="grid grid-cols-4 gap-2">{CONTRACTOR_PAGES.map(p => (
              <div key={p.label} className="bg-[#0D1117] border border-[#21262D] p-2 text-center"><p.icon className="w-3.5 h-3.5 text-[#8B949E] mx-auto mb-1" /><p className="text-[10px] font-mono text-[#E6EDF3]">{p.label}</p></div>
            ))}</div>
          </div>
        </div>

        {/* ── 구현 완료 ── */}
        <FeatureSection title="Completed Features" features={completedFeatures} editMode={editMode} dotColor="bg-emerald-400" cols="lg:grid-cols-3"
          onAdd={() => setEditingFeature({ status: "completed", sort_order: completedFeatures.length })}
          onEdit={f => setEditingFeature(f)} onDelete={f => handleDeleteFeature(f.id)} onDetail={f => setDetailFeature(f)} />

        {/* ── 구현 중 ── */}
        <FeatureSection title="In Progress" features={inProgressFeatures} editMode={editMode} dotColor="bg-blue-400 animate-pulse" cols="lg:grid-cols-3"
          onAdd={() => setEditingFeature({ status: "in_progress", sort_order: inProgressFeatures.length })}
          onEdit={f => setEditingFeature(f)} onDelete={f => handleDeleteFeature(f.id)} onDetail={f => setDetailFeature(f)} />

        {/* ── 앞으로 추가 ── */}
        <FeatureSection title="Planned" features={plannedFeatures} editMode={editMode} dotColor="bg-gray-600" cols="lg:grid-cols-4"
          onAdd={() => setEditingFeature({ status: "planned", sort_order: plannedFeatures.length })}
          onEdit={f => setEditingFeature(f)} onDelete={f => handleDeleteFeature(f.id)} onDetail={f => setDetailFeature(f)} />

        {/* ── 기술 스택 ── */}
        <section className="border border-[#30363D] bg-[#161B22] p-5">
          <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider mb-4">Technology Stack</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{TECH_STACK.map(t => (
            <div key={t.category} className="bg-[#0D1117] border border-[#21262D] p-4">
              <div className="flex items-center gap-2 mb-3"><t.icon className="w-4 h-4 text-[#58A6FF]" /><h3 className="font-mono font-bold text-xs text-[#E6EDF3]">{t.category}</h3></div>
              <ul className="space-y-1">{t.items.map(item => <li key={item} className="text-[11px] font-mono text-[#8B949E] flex items-center gap-2"><span className="w-1 h-1 bg-[#30363D]" />{item}</li>)}</ul>
            </div>
          ))}</div>
        </section>

        {/* ── 마일스톤 타임라인 ── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider">Development Timeline</h2>
            {editMode && <button onClick={() => setEditingMilestone({ sort_order: milestones.length })} className="px-2 py-1 text-[10px] font-mono text-[#58A6FF] border border-[#30363D] hover:border-[#58A6FF] flex items-center gap-1"><Plus className="w-3 h-3" />추가</button>}
          </div>
          <div className="relative">
            <div className="absolute left-[15px] top-0 bottom-0 w-px bg-[#21262D]" />
            <div className="space-y-6">{milestones.map(m => (
              <div key={m.id} className="relative pl-10">
                <div className="absolute left-0 top-1 w-8 h-8 bg-[#0D1117] border border-[#30363D] flex items-center justify-center"><TimelineIcon status={m.status} /></div>
                <div className={`border p-4 relative group ${m.status === "completed" ? "bg-emerald-500/5 border-emerald-500/20" : m.status === "in_progress" ? "bg-blue-500/5 border-blue-500/20" : "bg-[#161B22] border-[#30363D]"}`}>
                  {editMode && (
                    <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                      <button onClick={() => setEditingMilestone(m)} className="w-6 h-6 bg-[#0D1117] border border-[#30363D] flex items-center justify-center"><Pencil className="w-3 h-3 text-[#58A6FF]" /></button>
                      <button onClick={() => handleDeleteMilestone(m.id)} className="w-6 h-6 bg-[#0D1117] border border-[#30363D] flex items-center justify-center"><Trash2 className="w-3 h-3 text-red-400" /></button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono font-bold text-[#8B949E] uppercase">{m.phase}</span>
                    <h3 className="font-mono font-bold text-sm text-[#E6EDF3]">{m.title}</h3>
                    <span className="text-[10px] font-mono text-[#8B949E]">{m.period}</span>
                    <StatusBadge status={m.status} />
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">{m.items.map(item => (
                    <li key={item} className="text-xs font-mono text-[#C9D1D9] flex items-start gap-2">
                      {m.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> : m.status === "in_progress" ? <Zap className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" /> : <Target className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />}
                      {item}
                    </li>
                  ))}</ul>
                </div>
              </div>
            ))}</div>
          </div>
        </section>

        {/* ── IR 갤러리 ── */}
        <section className="border border-[#30363D] bg-[#161B22] p-5">
          <h2 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider mb-1">IR Materials</h2>
          <p className="text-[10px] font-mono text-[#8B949E] mb-4">사업 계획서 (23장) + 기술 개발 계획서 (14장)</p>
          <div className="space-y-4">
            <div>
              <h3 className="text-[10px] font-mono text-[#58A6FF] mb-2 uppercase">Business Plan</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">{IR_SLIDES.map((s, i) => (
                <button key={s.src} onClick={() => setLightboxIndex(i)} className="flex-shrink-0 w-40 h-24 overflow-hidden border border-[#30363D] hover:border-[#58A6FF] relative bg-[#0D1117]">
                  <Image src={s.src} alt={s.label} fill className="object-cover" sizes="160px" /><span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 text-[9px] font-mono text-white">{String(i + 1).padStart(2, "0")}</span>
                </button>
              ))}</div>
            </div>
            <div>
              <h3 className="text-[10px] font-mono text-[#58A6FF] mb-2 uppercase">Technical Plan</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">{TECH_SLIDES.map((s, i) => (
                <button key={s.src} onClick={() => setLightboxIndex(IR_SLIDES.length + i)} className="flex-shrink-0 w-40 h-24 overflow-hidden border border-[#30363D] hover:border-[#58A6FF] relative bg-[#0D1117]">
                  <Image src={s.src} alt={s.label} fill className="object-cover" sizes="160px" /><span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 text-[9px] font-mono text-white">{String(i + 1).padStart(2, "0")}</span>
                </button>
              ))}</div>
            </div>
          </div>
        </section>

        {/* ── 푸터 ── */}
        <div className="border-t border-[#21262D] pt-6 text-center space-y-2">
          <p className="text-xs font-mono text-[#8B949E]">INPICK — AI-powered Interior Estimation Platform</p>
          <p className="text-[10px] font-mono text-[#484F58]">대전광역시 | 대표 김선본 | 예비창업패키지 참여기업</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <a href="/" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-[#58A6FF] hover:underline flex items-center gap-1">WEBSITE <ExternalLink className="w-2.5 h-2.5" /></a>
            <a href="/project/new" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-[#58A6FF] hover:underline flex items-center gap-1">DEMO <ExternalLink className="w-2.5 h-2.5" /></a>
          </div>
        </div>
      </div>

      {/* ── 모달 레이어 ── */}
      {editingFeature !== null && <EditFeatureModal feature={editingFeature} onSave={handleSaveFeature} onClose={() => setEditingFeature(null)} />}
      {editingMilestone !== null && <EditMilestoneModal milestone={editingMilestone} onSave={handleSaveMilestone} onClose={() => setEditingMilestone(null)} />}
      {editingStat !== null && <EditStatModal stat={editingStat} onSave={handleSaveStat} onClose={() => setEditingStat(null)} />}
      {detailFeature && <FeatureDetailModal feature={detailFeature} onClose={() => setDetailFeature(null)} />}

      {/* ── IR Lightbox ── */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button className="absolute top-4 right-4 w-8 h-8 bg-[#21262D] border border-[#30363D] flex items-center justify-center" onClick={() => setLightboxIndex(null)}><X className="w-4 h-4 text-[#8B949E]" /></button>
          {lightboxIndex > 0 && <button className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#21262D] border border-[#30363D] flex items-center justify-center" onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}><ChevronLeft className="w-4 h-4 text-[#8B949E]" /></button>}
          {lightboxIndex < ALL_SLIDES.length - 1 && <button className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#21262D] border border-[#30363D] flex items-center justify-center" onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}><ChevronRight className="w-4 h-4 text-[#8B949E]" /></button>}
          <div className="relative w-[90vw] max-w-5xl h-[80vh]" onClick={e => e.stopPropagation()}><Image src={ALL_SLIDES[lightboxIndex].src} alt={ALL_SLIDES[lightboxIndex].label} fill className="object-contain" sizes="90vw" priority /></div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#21262D] border border-[#30363D] text-[10px] font-mono text-[#8B949E]">{lightboxIndex + 1}/{ALL_SLIDES.length}</div>
        </div>
      )}
    </div>
  );
}

// ─── 기능 섹션 컴포넌트 ───

function FeatureSection({ title, features, editMode, dotColor, cols, onAdd, onEdit, onDelete, onDetail }: {
  title: string; features: DbFeature[]; editMode: boolean; dotColor: string; cols: string;
  onAdd: () => void; onEdit: (f: DbFeature) => void; onDelete: (f: DbFeature) => void; onDetail: (f: DbFeature) => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 ${dotColor}`} />
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#E6EDF3]">{title}</h2>
          <span className="text-[10px] font-mono text-[#8B949E]">— {features.length} modules</span>
        </div>
        {editMode && (
          <button onClick={onAdd} className="px-2 py-1 text-[10px] font-mono text-[#58A6FF] border border-[#30363D] hover:border-[#58A6FF] flex items-center gap-1">
            <Plus className="w-3 h-3" /> 추가
          </button>
        )}
      </div>
      <div className={`grid grid-cols-1 md:grid-cols-2 ${cols} gap-2`}>
        {features.map(f => (
          <FeatureCard key={f.id} feature={f} editMode={editMode} onEdit={() => onEdit(f)} onDelete={() => onDelete(f)} onViewDetail={() => onDetail(f)} />
        ))}
      </div>
    </section>
  );
}
