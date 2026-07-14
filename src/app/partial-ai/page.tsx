"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Check,
  ChefHat,
  DoorOpen,
  Download,
  ExternalLink,
  Hexagon,
  Loader2,
  MapPin,
  PaintBucket,
  PanelTop,
  ShoppingBag,
  Sofa,
  Sparkles,
  SquareStack,
  Wand2,
} from "lucide-react";
import HeaderV4 from "@/components/landing-v4/HeaderV4";
import ClickableRenderImage from "@/components/workflow/ClickableRenderImage";
import { useTokens } from "@/contexts/TokensContext";
import type { SamPolygonResult } from "@/hooks/useSamClient";
import type { SamSurfaceTarget } from "@/lib/inpick/sam-surface-prompts";

type RoomKey = "living" | "kitchen" | "master" | "bath" | "foyer";
type SurfaceKey = "floor" | "wall" | "ceiling";

type RoomOption = {
  key: RoomKey;
  label: string;
  area: string;
  size: string;
  image: string;
  icon: typeof Sofa;
  description: string;
};

type MaterialOption = {
  name: string;
  prompt: string;
  query: string;
  swatch: string;
};

type ProductResult = {
  productId: string;
  title: string;
  image: string | null;
  price: number;
  mallName: string;
  link: string;
  brand?: string;
  source?: "internal" | "naver" | "mock";
};

const ROOMS: RoomOption[] = [
  { key: "living", label: "거실", area: "약 24㎡", size: "4.8 × 5.0m", image: "/partial-ai/base-living-v1.png", icon: Sofa, description: "30평대 아파트의 가장 보편적인 거실 비례" },
  { key: "kitchen", label: "부엌", area: "약 12㎡", size: "3.0 × 4.0m", image: "/images/hero-kitchen.jpg", icon: ChefHat, description: "아일랜드 또는 ㄱ자 주방을 적용하기 좋은 기본형" },
  { key: "master", label: "안방", area: "약 14㎡", size: "3.5 × 4.0m", image: "/showcase/elevation-04.jpg", icon: BedDouble, description: "침대와 붙박이장 배치를 고려한 기본형" },
  { key: "bath", label: "욕실", area: "약 4㎡", size: "2.0 × 2.0m", image: "/showcase/elevation-08.jpg", icon: Bath, description: "세면대·양변기·샤워 공간이 있는 공용욕실형" },
  { key: "foyer", label: "현관", area: "약 4.5㎡", size: "1.8 × 2.5m", image: "/showcase/elevation-09.jpg", icon: DoorOpen, description: "신발장과 중문을 배치할 수 있는 아파트 현관형" },
];

const STYLES = [
  { key: "warm", label: "웜 내추럴", prompt: "warm natural contemporary Korean interior, calm oak and creamy neutral palette" },
  { key: "minimal", label: "화이트 미니멀", prompt: "clean white minimal interior, seamless details, soft neutral materials" },
  { key: "hotel", label: "호텔 모던", prompt: "refined hotel modern interior, stone accents, layered indirect lighting" },
  { key: "midcentury", label: "미드센추리", prompt: "mid-century modern interior, walnut accents, warm muted colors" },
  { key: "classic", label: "모던 클래식", prompt: "modern classic interior, subtle wall molding, balanced premium finishes" },
] as const;

const MATERIALS: Record<SurfaceKey, MaterialOption[]> = {
  floor: [
    { name: "광폭 오크 강마루", prompt: "wide plank natural oak engineered wood flooring", query: "광폭 오크 강마루", swatch: "#b78d61" },
    { name: "웜그레이 포세린", prompt: "large warm gray matte porcelain floor tile", query: "웜그레이 포세린 바닥타일", swatch: "#c8c5bd" },
    { name: "내추럴 원목마루", prompt: "natural solid hardwood plank flooring", query: "내추럴 원목마루", swatch: "#caa574" },
    { name: "테라조 타일", prompt: "subtle light terrazzo floor tile", query: "테라조 바닥타일", swatch: "#ddd8ce" },
  ],
  wall: [
    { name: "웜화이트 실크벽지", prompt: "warm white silk wallpaper with soft matte texture", query: "웜화이트 실크벽지", swatch: "#eee8dd" },
    { name: "오프화이트 도장", prompt: "smooth off-white painted wall finish", query: "오프화이트 친환경 페인트", swatch: "#f2f0e9" },
    { name: "우드 템바보드", prompt: "natural oak vertical tambour wall panel", query: "오크 템바보드", swatch: "#a8784f" },
    { name: "대리석 아트월", prompt: "bookmatched light marble slab feature wall", query: "대리석 아트월", swatch: "#e2e0dc" },
  ],
  ceiling: [
    { name: "무몰딩 평천장", prompt: "flat seamless white ceiling without crown molding", query: "무몰딩 천장", swatch: "#fafafa" },
    { name: "간접조명 우물천장", prompt: "recessed cove ceiling with warm indirect lighting", query: "우물천장 간접조명", swatch: "#f2ecdf" },
    { name: "슬림 라인조명", prompt: "minimal ceiling with slim recessed linear lighting", query: "매입 라인조명", swatch: "#e9e8e3" },
  ],
};

const SURFACES: Array<{ key: SurfaceKey; label: string; icon: typeof SquareStack }> = [
  { key: "floor", label: "바닥", icon: SquareStack },
  { key: "wall", label: "벽", icon: PaintBucket },
  { key: "ceiling", label: "천장·조명", icon: PanelTop },
];

const ROOM_FEATURES: Record<RoomKey, Array<{ label: string; options: string[] }>> = {
  living: [
    { label: "TV 벽", options: ["벽걸이 TV만", "낮은 수납장", "매립형 TV월"] },
    { label: "조명", options: ["다운라이트", "간접조명", "실링팬+간접조명"] },
  ],
  kitchen: [
    { label: "주방 형태", options: ["ㄱ자 주방", "아일랜드 주방", "11자 대면형"] },
    { label: "도어", options: ["무광 웜화이트", "우드 하부장", "다크그레이"] },
    { label: "상판", options: ["화이트 엔지니어드 스톤", "베이지 세라믹", "다크 천연석"] },
  ],
  master: [
    { label: "헤드월", options: ["벽지만", "템바보드", "패브릭 패널"] },
    { label: "수납", options: ["붙박이장", "오픈 드레스룸", "수납장 없음"] },
  ],
  bath: [
    { label: "세면대", options: ["하부장형", "벽걸이형", "조적 세면대"] },
    { label: "샤워", options: ["유리 파티션", "욕조형", "오픈 샤워형"] },
    { label: "수전", options: ["크롬", "무광 니켈", "매트 블랙"] },
  ],
  foyer: [
    { label: "중문", options: ["슬림 3연동", "원슬라이딩", "중문 없음"] },
    { label: "신발장", options: ["띄움 시공", "벽면 전체장", "오픈 선반 혼합"] },
  ],
};

const targetToSurface = (target: SamSurfaceTarget): SurfaceKey | null => {
  if (target === "floor" || target === "wall" || target === "ceiling") return target;
  return null;
};

export default function PartialAiPage() {
  const { balance, refresh } = useTokens();
  const [room, setRoom] = useState<RoomKey>("living");
  const [styleKey, setStyleKey] = useState<(typeof STYLES)[number]["key"]>("warm");
  const [surface, setSurface] = useState<SurfaceKey>("floor");
  const [materialChoices, setMaterialChoices] = useState<Record<SurfaceKey, number>>({ floor: 0, wall: 0, ceiling: 0 });
  const [featureChoices, setFeatureChoices] = useState<Record<string, number>>({});
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<{ target: SamSurfaceTarget; confidence: number } | null>(null);

  const roomMeta = ROOMS.find((item) => item.key === room) ?? ROOMS[0];
  const styleMeta = STYLES.find((item) => item.key === styleKey) ?? STYLES[0];
  const currentMaterial = MATERIALS[surface][materialChoices[surface]] ?? MATERIALS[surface][0];
  const selectedMaterials = useMemo(
    () => ({
      floor: MATERIALS.floor[materialChoices.floor] ?? MATERIALS.floor[0],
      wall: MATERIALS.wall[materialChoices.wall] ?? MATERIALS.wall[0],
      ceiling: MATERIALS.ceiling[materialChoices.ceiling] ?? MATERIALS.ceiling[0],
    }),
    [materialChoices],
  );

  const changeRoom = (next: RoomKey) => {
    setRoom(next);
    setFeatureChoices({});
    setResultUrl(null);
    setSelectedRegion(null);
    setProducts([]);
  };

  const buildPrompt = () => {
    const features = ROOM_FEATURES[room]
      .map((group) => `${group.label}: ${group.options[featureChoices[group.label] ?? 0]}`)
      .join(", ");
    return [
      `${roomMeta.label} ${roomMeta.area} (${roomMeta.size}) 기본 공간을 고정된 시점과 구조로 인테리어합니다.`,
      styleMeta.prompt,
      `Floor: ${selectedMaterials.floor.prompt}.`,
      `Walls: ${selectedMaterials.wall.prompt}.`,
      `Ceiling: ${selectedMaterials.ceiling.prompt}.`,
      `Room-specific choices: ${features}.`,
      customPrompt.trim() ? `User preference: ${customPrompt.trim()}.` : "",
      "Photorealistic high-end Korean residential interior. Keep all main finish surfaces clearly visible for later material identification. Use only essential built-in fixtures and minimal movable furniture.",
    ].filter(Boolean).join("\n");
  };

  const generate = async () => {
    setGenerating(true);
    setError("");
    setResultUrl(null);
    setProducts([]);
    setSelectedRegion(null);
    try {
      const res = await fetch("/api/inpick/render-space-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImage: { url: `${window.location.origin}${roomMeta.image}` },
          editPrompt: buildPrompt(),
          targetSurfaces: room === "kitchen"
            ? ["floor", "wall", "ceiling", "cabinet", "counter"]
            : room === "bath"
              ? ["floor", "wall", "ceiling", "tile_wall", "fixture"]
              : ["floor", "wall", "ceiling", "door", "window"],
          preserveGeometry: true,
          quality: "medium",
          serviceMode: "partial_ai_room",
          spaceType: room,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setError("로그인 후 이용할 수 있습니다.");
        else if (res.status === 402 || data?.error === "INSUFFICIENT_CREDITS") setError("토큰이 부족합니다. 1실 렌더에는 5토큰이 필요합니다.");
        else setError(data?.hint || data?.error || "이미지 생성에 실패했습니다.");
        return;
      }
      setResultUrl(data.imageUrl);
      await refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const recommendProducts = async (region: SamPolygonResult, target: SamSurfaceTarget) => {
    const mapped = targetToSurface(target);
    const query = mapped
      ? selectedMaterials[mapped].query
      : target === "window"
        ? "아파트 시스템 창호"
        : target === "door"
          ? "아파트 방문 도어"
          : "맞춤 커튼 블라인드";
    setSelectedRegion({ target, confidence: region.confidence });
    setProductQuery(query);
    setProducts([]);
    setProductLoading(true);
    try {
      const res = await fetch(`/api/product-search?query=${encodeURIComponent(query)}&display=8&sort=sim&start=1`);
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch {
      setProducts([]);
    } finally {
      setProductLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-black">
      <HeaderV4 variant="solid" />

      <section className="bg-white pt-24">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-10 lg:px-8 lg:pb-16">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/40">02 · PARTIAL AI INTERIOR</p>
          <div className="mt-4 grid items-end gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h1 className="text-4xl font-black tracking-[-0.05em] sm:text-5xl">한 공간만, 빠르게<br />AI 인테리어</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-black/60">
                주소나 도면 없이 거실·부엌·안방·욕실·현관의 기본 공간을 고르고 분위기와 자재만 선택하세요.
                선택한 한 공간을 5토큰으로 렌더링합니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-black/10 bg-[#f7f7f5] p-4 text-center">
              {[["입력", "주소·도면 없음"], ["기준", "기본 면적·시점"], ["비용", "1실 5토큰"]].map(([title, value]) => (
                <div key={title} className="rounded-2xl bg-white px-2 py-4">
                  <p className="text-[11px] font-bold text-black/40">{title}</p>
                  <p className="mt-1 text-sm font-black">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-black/[0.07] bg-[#f7f7f5]">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">STEP 1 · 공간 선택</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {ROOMS.map((item) => {
              const Icon = item.icon;
              const active = item.key === room;
              return (
                <button key={item.key} type="button" onClick={() => changeRoom(item.key)} className={`overflow-hidden rounded-2xl border text-left transition ${active ? "border-black ring-1 ring-black" : "border-black/10 bg-white hover:border-black/35"}`}>
                  <div className="aspect-[16/10] overflow-hidden bg-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm font-black"><Icon className="h-4 w-4" />{item.label}</span>
                      {active && <Check className="h-4 w-4" />}
                    </div>
                    <p className="mt-1 text-xs font-bold text-black/45">{item.area} · {item.size}</p>
                    <p className="mt-1.5 text-[11px] leading-4 text-black/45">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">STEP 2 · 디자인 선택</p>
            <div className="mt-4 overflow-hidden rounded-[24px] border border-black/10 bg-[#f7f7f5]">
              <div className="relative aspect-[4/3] bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultUrl || roomMeta.image} alt={`${roomMeta.label} 기본 공간`} className="h-full w-full object-cover" />
                {generating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/88 text-black backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="mt-3 text-sm font-black">선택한 {roomMeta.label}을 렌더링 중입니다</p>
                    <p className="mt-1 text-xs text-black/50">구조를 유지하면서 자재와 분위기를 적용하고 있어요</p>
                  </div>
                )}
                {!resultUrl && !generating && (
                  <span className="absolute bottom-3 left-3 rounded-full bg-black px-3 py-1.5 text-xs font-bold text-white">기본 공간 · {roomMeta.area}</span>
                )}
              </div>
              <div className="p-4">
                <button type="button" onClick={generate} disabled={generating} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-4 py-3.5 text-sm font-black text-white hover:bg-black/75 disabled:opacity-50">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {resultUrl ? "같은 조건으로 다시 생성" : `${roomMeta.label} AI 이미지 생성`} · 5토큰
                </button>
                <div className="mt-2 flex items-center justify-between px-1 text-xs text-black/50">
                  <span className="inline-flex items-center gap-1"><Hexagon className="h-3.5 w-3.5 fill-black" />보유 <b className="text-black">{balance}</b>토큰</span>
                  <Link href="/account/tokens" className="font-bold text-black hover:underline">토큰 충전</Link>
                </div>
                {error && <p className="mt-3 rounded-xl bg-black/[0.04] px-3 py-2 text-xs font-semibold text-black">{error}</p>}
                {resultUrl && (
                  <a href={resultUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-black/55 hover:text-black">
                    <Download className="h-3.5 w-3.5" /> 원본 이미지 열기
                  </a>
                )}
              </div>
            </div>
          </div>

          <div>
            <div>
              <p className="text-xs font-bold text-black/45">전체 분위기</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STYLES.map((item) => (
                  <button key={item.key} type="button" onClick={() => setStyleKey(item.key)} className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${styleKey === item.key ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/65 hover:border-black"}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-black/10 bg-[#f7f7f5] p-4 sm:p-5">
              <div className="flex gap-2 overflow-x-auto">
                {SURFACES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" onClick={() => setSurface(item.key)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-black ${surface === item.key ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60"}`}>
                      <Icon className="h-3.5 w-3.5" />{item.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {MATERIALS[surface].map((item, index) => {
                  const active = materialChoices[surface] === index;
                  return (
                    <button key={item.name} type="button" onClick={() => setMaterialChoices((current) => ({ ...current, [surface]: index }))} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-black bg-white ring-1 ring-black" : "border-black/[0.08] bg-white/70 hover:border-black/30"}`}>
                      <span className="h-10 w-10 shrink-0 rounded-xl border border-black/10" style={{ backgroundColor: item.swatch }} />
                      <span className="min-w-0 flex-1 truncate text-xs font-black">{item.name}</span>
                      {active && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-black/45">현재 {SURFACES.find((item) => item.key === surface)?.label}: <b className="text-black">{currentMaterial.name}</b></p>
            </div>

            <div className="mt-6">
              <p className="text-xs font-bold text-black/45">{roomMeta.label} 전용 옵션</p>
              <div className="mt-3 space-y-4">
                {ROOM_FEATURES[room].map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-black">{group.label}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.options.map((option, index) => (
                        <button key={option} type="button" onClick={() => setFeatureChoices((current) => ({ ...current, [group.label]: index }))} className={`rounded-full border px-3 py-2 text-xs font-semibold ${featureChoices[group.label] === index || (featureChoices[group.label] == null && index === 0) ? "border-black bg-black text-white" : "border-black/10 text-black/60 hover:border-black"}`}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="mt-6 block">
              <span className="text-xs font-bold text-black/45">추가로 원하는 분위기</span>
              <textarea value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} rows={3} maxLength={300} placeholder="예: 밝은 오후 햇살, 따뜻한 우드톤, 가구는 최소한으로 보여줘" className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none placeholder:text-black/30 focus:border-black" />
              <span className="mt-1 block text-right text-[10px] text-black/35">{customPrompt.length}/300</span>
            </label>
          </div>
        </div>
      </section>

      {resultUrl && (
        <section className="border-t border-black/[0.07] bg-[#f7f7f5]">
          <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">STEP 3 · 실제 자재와 시공 연결</p>
            <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-black tracking-tight">렌더 이미지에서 자재가 궁금한 부위를 선택하세요</h2>
                <p className="mt-2 text-sm text-black/55">SAM 정밀 경계 선택 후 해당 부위에 맞는 실제 제품과 부분시공 업체를 연결합니다.</p>
              </div>
              <Link href="/partial-install" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-black text-white">바로 부분시공 보기 <ArrowRight className="h-4 w-4" /></Link>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-[24px] border border-black/10 bg-white p-4">
                <ClickableRenderImage imageUrl={resultUrl} initialMode="select" onConfirm={recommendProducts} hint="바닥·벽·천장·창문·문·커튼 중 먼저 부위를 고른 뒤 이미지 안쪽을 클릭하세요." />
              </div>
              <div className="rounded-[24px] border border-black/10 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-black/40">이 이미지의 기본 자재 구성</p>
                <div className="mt-3 space-y-2">
                  {(Object.keys(selectedMaterials) as SurfaceKey[]).map((key) => (
                    <Link key={key} href={`/partial-install?q=${encodeURIComponent(selectedMaterials[key].query)}&room=${room}`} className="flex items-center justify-between rounded-2xl border border-black/[0.08] bg-[#f7f7f5] p-3 hover:border-black/30">
                      <span className="flex items-center gap-3"><span className="h-9 w-9 rounded-xl border border-black/10" style={{ backgroundColor: selectedMaterials[key].swatch }} /><span><span className="block text-[11px] text-black/40">{SURFACES.find((item) => item.key === key)?.label}</span><span className="block text-sm font-black">{selectedMaterials[key].name}</span></span></span>
                      <ArrowRight className="h-4 w-4 text-black/35" />
                    </Link>
                  ))}
                </div>

                {selectedRegion && (
                  <div className="mt-5 border-t border-black/[0.07] pt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-black/40">선택한 부위 추천</p>
                        <p className="mt-1 text-base font-black">{productQuery}</p>
                      </div>
                      <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-bold text-white">경계 신뢰도 {Math.round(selectedRegion.confidence * 100)}%</span>
                    </div>
                    {productLoading ? (
                      <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : products.length > 0 ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {products.slice(0, 4).map((product) => (
                          <a key={product.productId} href={product.link} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white hover:border-black/30">
                            <div className="aspect-[4/3] bg-black/[0.04]">
                              {product.image ? <img src={product.image} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="m-auto h-8 w-8 text-black/20" />}
                            </div>
                            <div className="p-2.5"><p className="line-clamp-2 text-[11px] font-bold leading-4">{product.title}</p><p className="mt-1 text-xs font-black">{product.price > 0 ? `${product.price.toLocaleString()}원~` : "가격 문의"}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-black/40">{product.mallName}<ExternalLink className="h-2.5 w-2.5" /></p></div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-xl bg-[#f7f7f5] px-3 py-5 text-center text-xs text-black/45">추천 제품을 찾지 못했습니다.</p>
                    )}
                    <Link href={`/partial-install?q=${encodeURIComponent(productQuery)}&room=${room}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-black text-white">
                      <MapPin className="h-4 w-4" /> 이 자재와 시공업체 비교
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-black/[0.07] bg-white">
        <div className="mx-auto grid max-w-7xl gap-3 px-5 py-8 md:grid-cols-3 lg:px-8">
          {[
            ["01", "전체 AI 디자인", "주소·도면부터 전체 공간 디자인과 견적", "/workflow"],
            ["02", "부분 AI 인테리어", "기본 공간 하나를 5토큰으로 빠르게 렌더", "/partial-ai"],
            ["03", "부분시공", "실제 자재·가격·지역 시공업체 비교", "/partial-install"],
          ].map(([number, title, description, href]) => (
            <Link key={number} href={href} className={`rounded-2xl border p-4 ${number === "02" ? "border-black bg-black text-white" : "border-black/10 bg-white"}`}>
              <p className={`text-[11px] font-bold ${number === "02" ? "text-white/50" : "text-black/35"}`}>SERVICE {number}</p>
              <p className="mt-1 text-sm font-black">{title}</p>
              <p className={`mt-1 text-xs ${number === "02" ? "text-white/55" : "text-black/45"}`}>{description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
