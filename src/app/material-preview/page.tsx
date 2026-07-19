"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Check,
  ChefHat,
  Download,
  Hexagon,
  Layers,
  Loader2,
  PaintBucket,
  PanelTop,
  Save,
  Sofa,
  Box,
  Sparkles,
  SquareStack,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useTokens } from "@/contexts/TokensContext";
import HeaderV4 from "@/components/landing-v4/HeaderV4";

const Material3DViewer = dynamic(() => import("@/components/material-preview/Material3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-400">
      3D 뷰어 로딩…
    </div>
  ),
});

type RoomKey = "living" | "master" | "kitchen" | "bath";
type SurfaceKey = "floor" | "wall" | "ceiling";

const ROOMS: Array<{ key: RoomKey; label: string; icon: typeof Sofa; image: string }> = [
  { key: "living", label: "거실", icon: Sofa, image: "/showcase/elevation-01.jpg" },
  { key: "master", label: "안방", icon: BedDouble, image: "/showcase/elevation-04.jpg" },
  { key: "kitchen", label: "부엌", icon: ChefHat, image: "/images/hero-kitchen.jpg" },
  { key: "bath", label: "욕실", icon: Bath, image: "/showcase/elevation-08.jpg" },
];

const SURFACES: Array<{ key: SurfaceKey; label: string; icon: typeof PanelTop }> = [
  { key: "floor", label: "바닥", icon: SquareStack },
  { key: "wall", label: "벽", icon: PaintBucket },
  { key: "ceiling", label: "천정", icon: PanelTop },
];

const MATERIALS: Record<
  SurfaceKey,
  Array<{ name: string; tone: string; scene: string; prompt: string; swatch: string; query: string }>
> = {
  floor: [
    { name: "광폭 오크 마루", tone: "따뜻한 우드", scene: "집 전체가 넓어 보이고 가구 톤을 맞추기 쉽습니다.", prompt: "wide plank natural oak wood floor in a Korean apartment living room", swatch: "#B58A5A", query: "광폭 오크 강마루" },
    { name: "헤링본 강마루", tone: "클래식 포인트", scene: "거실·안방에 리듬감이 생기고 클래식한 분위기가 강해집니다.", prompt: "herringbone engineered wood floor in a warm modern interior", swatch: "#8E6A46", query: "헤링본 강마루" },
    { name: "내추럴 원목마루", tone: "고급 우드", scene: "발 촉감이 좋고 빈티지·내추럴 가구와 잘 어울립니다.", prompt: "natural solid hardwood plank floor in a bright living room", swatch: "#C8A06A", query: "원목마루" },
    { name: "포세린 바닥타일", tone: "모던 스톤", scene: "물·오염에 강하고 호텔식 깔끔한 분위기를 냅니다.", prompt: "large format porcelain floor tile in a modern minimalist room", swatch: "#D8D5CE", query: "포세린 바닥타일 600x600" },
    { name: "폴리싱 타일", tone: "광택 모던", scene: "빛 반사로 공간이 넓어 보이고 럭셔리한 느낌을 줍니다.", prompt: "glossy polished tile floor in a luxurious modern living room", swatch: "#E3E1DC", query: "폴리싱 타일 바닥" },
    { name: "럭셔리 비닐타일(LVT)", tone: "실용 우드", scene: "시공이 빠르고 물에 강해 주방·상가에 적합합니다.", prompt: "luxury vinyl tile wood-look flooring in a compact kitchen", swatch: "#A98C68", query: "LVT 바닥재" },
    { name: "노출 콘크리트", tone: "인더스트리얼", scene: "미니멀·인더스트리얼 가구, 스틸 소품과 잘 맞습니다.", prompt: "polished exposed concrete floor in an industrial style space", swatch: "#9A9994", query: "에폭시 노출 콘크리트 바닥" },
  ],
  wall: [
    { name: "웜화이트 실크벽지", tone: "기본형", scene: "빛 반사가 부드러워 실이 밝아지고 선호도가 안정적입니다.", prompt: "warm white silk wallpaper in a Korean apartment living room", swatch: "#EFE7DA", query: "실크벽지 화이트" },
    { name: "그레이 포인트 벽지", tone: "차분한 포인트", scene: "한 면만 바꿔도 공간이 정돈되고 가구가 돋보입니다.", prompt: "soft gray accent wallpaper on one feature wall", swatch: "#B8B6B1", query: "포인트 벽지 그레이" },
    { name: "템바보드 월", tone: "입체감", scene: "TV월·헤드월처럼 한 면 시공 시 효과가 큽니다.", prompt: "vertical tambour wood wall panel behind a sofa", swatch: "#B9895E", query: "템바보드" },
    { name: "대형 포세린 타일", tone: "호텔식", scene: "욕실·주방 벽이 정돈돼 보이고 줄눈이 줄어듭니다.", prompt: "large format porcelain wall tile in a hotel style bathroom", swatch: "#D2D0C8", query: "대형 포세린 벽타일" },
    { name: "베네시안 스타코", tone: "유러피언", scene: "은은한 질감으로 고급스러운 무드월을 만듭니다.", prompt: "venetian stucco plaster textured wall in a modern living room", swatch: "#E7DECF", query: "베네시안 스타코" },
    { name: "우드 패널 월", tone: "내추럴", scene: "따뜻한 우드 톤으로 카페 같은 분위기를 냅니다.", prompt: "warm wood slat wall panel in a cozy interior", swatch: "#A97C52", query: "우드 월패널" },
    { name: "대리석 아트월", tone: "럭셔리", scene: "거실 TV월을 고급 호텔 라운지처럼 연출합니다.", prompt: "marble slab accent wall behind a TV in a luxury living room", swatch: "#E8E6E1", query: "대리석 아트월" },
  ],
  ceiling: [
    { name: "무몰딩 평천정", tone: "깔끔함", scene: "천정선이 정리되어 실이 더 높고 조용해 보입니다.", prompt: "minimal flat ceiling without crown molding in a modern apartment", swatch: "#FFFFFF", query: "무몰딩 천장" },
    { name: "간접조명 우물천정", tone: "무드", scene: "야간 분위기가 좋아지고 조도 조절이 쉽습니다.", prompt: "cove lighting recessed ceiling in a cozy master bedroom", swatch: "#F3EFE6", query: "우물천장 간접조명" },
    { name: "우드 루버 천정", tone: "내추럴 포인트", scene: "현관·거실 천정에 따뜻한 우드 포인트를 줍니다.", prompt: "wood louver slat ceiling in a warm modern entrance", swatch: "#B68A5C", query: "우드 루버 천장" },
    { name: "방수 욕실 천정재", tone: "실용", scene: "습기·곰팡이 관리에 유리하고 점검구 시공이 편합니다.", prompt: "waterproof SMC bathroom ceiling panel in a clean bathroom", swatch: "#E8EEF0", query: "욕실 천장재 SMC" },
    { name: "노출 천정(인더스트리얼)", tone: "카페 무드", scene: "상가·카페 느낌의 개방감 있는 천정을 만듭니다.", prompt: "exposed industrial ceiling with track lighting in a cafe space", swatch: "#8E8C88", query: "노출 천장 트랙조명" },
  ],
};

const ROOM_SURFACE_NOTE: Record<RoomKey, Record<SurfaceKey, string>> = {
  living: {
    floor: "거실 바닥은 전체 집 분위기를 결정하므로 마루 폭과 걸레받이 색을 같이 봐야 합니다.",
    wall: "TV월 한 면만 바꿔도 전체 리모델링처럼 보이는 효과가 납니다.",
    ceiling: "천정은 조명 계획과 같이 봐야 체감 변화가 큽니다.",
  },
  master: {
    floor: "안방은 발촉감과 소음이 중요해 우드 계열 선호도가 높습니다.",
    wall: "침대 헤드월은 컬러 벽지나 템바보드 적용 효과가 좋습니다.",
    ceiling: "간접조명은 수면 공간의 눈부심을 줄이는 방향으로 추천합니다.",
  },
  kitchen: {
    floor: "부엌 바닥은 오염과 물 튐을 고려해 내수성과 청소성을 우선합니다.",
    wall: "싱크대 벽은 타일, 패널, 상판 연장 마감 중 관리성을 비교합니다.",
    ceiling: "후드와 조명 위치를 같이 보며 밝고 얼룩이 덜 보이는 마감을 추천합니다.",
  },
  bath: {
    floor: "욕실 바닥은 미끄럼 저항과 배수 경사를 우선합니다.",
    wall: "욕실 벽은 대형 타일을 적용하면 줄눈 관리가 쉬워집니다.",
    ceiling: "욕실 천정은 방수, 환기, 점검구 위치가 핵심입니다.",
  },
};

export default function MaterialPreviewPage() {
  const [room, setRoom] = useState<RoomKey>("living");
  const [surface, setSurface] = useState<SurfaceKey>("floor");
  const [materialIdx, setMaterialIdx] = useState(0);

  // 카탈로그/부분시공에서 ?surface=&mat= 으로 진입 시 자재 자동 선택
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("surface");
    const mat = sp.get("mat");
    if (s === "floor" || s === "wall" || s === "ceiling") {
      setSurface(s);
      if (mat) {
        const t = mat.toLowerCase();
        const idx = MATERIALS[s].findIndex(
          (m) =>
            t.includes(m.query.toLowerCase()) ||
            m.query.toLowerCase().includes(t) ||
            t.includes(m.name.toLowerCase()) ||
            m.name.toLowerCase().includes(t)
        );
        if (idx >= 0) setMaterialIdx(idx);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roomMeta = ROOMS.find((item) => item.key === room) || ROOMS[0];
  const materials = MATERIALS[surface];
  const selected = materials[materialIdx] || materials[0];

  const previewTitle = useMemo(() => `${roomMeta.label} ${SURFACES.find((s) => s.key === surface)?.label} · ${selected.name}`, [roomMeta.label, selected.name, surface]);
  const surfaceLabel = SURFACES.find((s) => s.key === surface)?.label ?? "";

  const { balance, refresh } = useTokens();
  const [sourceMode, setSourceMode] = useState<"sample" | "upload">("sample");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null); // dataURL
  const fileRef = useRef<HTMLInputElement>(null);

  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{ prompt: string; model: string; sourceLabel: string } | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  type SavedPreview = {
    id: string;
    room: string | null;
    surface: string | null;
    materialName: string | null;
    resultUrl: string;
    createdAt: string;
  };
  const [gallery, setGallery] = useState<SavedPreview[]>([]);

  const loadGallery = useCallback(async () => {
    try {
      const res = await fetch("/api/material-preview");
      const data = await res.json();
      setGallery(data.previews ?? []);
    } catch {
      /* noop */
    }
  }, []);
  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  // 자재 카드 실제 제품 이미지 — 부위 변경 시 상품 검색(네이버)에서 대표 썸네일 로드
  const [materialImages, setMaterialImages] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const queries = MATERIALS[surface].map((m) => m.query);
      // 1) 우리 소유(자산화) 이미지 우선 — material_products
      let owned: Record<string, string> = {};
      try {
        const res = await fetch(`/api/material-assets?queries=${encodeURIComponent(queries.join("|"))}`);
        owned = (await res.json())?.images ?? {};
      } catch {
        /* noop */
      }
      if (!cancelled && Object.keys(owned).length) {
        setMaterialImages((prev) => ({ ...prev, ...owned }));
      }
      // 2) 자산화 안 된 항목만 라이브 상품검색(네이버) 폴백
      const missing = queries.filter((q) => !owned[q]);
      await Promise.all(
        missing.map(async (q) => {
          try {
            const res = await fetch(`/api/product-search?query=${encodeURIComponent(q)}&display=1`);
            const data = await res.json();
            const img = data.products?.[0]?.image as string | undefined;
            if (!cancelled && img) setMaterialImages((prev) => ({ ...prev, [q]: img }));
          } catch {
            /* noop */
          }
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [surface]);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedUrl(reader.result as string);
      setSourceMode("upload");
      setResultUrl(null);
    };
    reader.readAsDataURL(file);
  };

  const currentSourcePreview =
    sourceMode === "upload" && uploadedUrl ? uploadedUrl : roomMeta.image;

  const generate = async () => {
    setError("");
    setSavedMsg("");
    setGenerating(true);
    setResultUrl(null);
    try {
      const sourceImage =
        sourceMode === "upload" && uploadedUrl
          ? { dataUrl: uploadedUrl }
          : { url: `${window.location.origin}${roomMeta.image}` };
      const editPrompt = `${selected.prompt}. Keep the room's structure, layout, furniture and camera perspective exactly the same; only change the ${surface}.`;
      const res = await fetch("/api/inpick/render-space-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImage,
          editPrompt,
          targetSurfaces: [surface],
          preserveGeometry: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setError("로그인 후 이용할 수 있어요.");
        else if (res.status === 402 || data?.error === "INSUFFICIENT_CREDITS")
          setError("토큰이 부족합니다. 충전 후 다시 시도해주세요.");
        else setError(data?.hint || data?.error || "생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      setResultUrl(data.imageUrl);
      setResultMeta({
        prompt: data.prompt,
        model: data.model,
        sourceLabel: sourceMode === "upload" ? "내 사진" : `${roomMeta.label} 샘플`,
      });
      setShowBefore(false);
      refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!resultUrl) return;
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/material-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomMeta.label,
          surface,
          materialName: selected.name,
          prompt: resultMeta?.prompt,
          sourceUrl: resultMeta?.sourceLabel,
          resultUrl,
          model: resultMeta?.model,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSavedMsg(data?.error || "저장에 실패했습니다.");
        return;
      }
      setSavedMsg("내 미리보기에 저장됐어요.");
      loadGallery();
    } finally {
      setSaving(false);
    }
  };

  const removeSaved = async (id: string) => {
    setGallery((g) => g.filter((p) => p.id !== id));
    await fetch(`/api/material-preview?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <HeaderV4 />

      <section className="relative overflow-hidden bg-zinc-950 pt-[calc(7rem+env(safe-area-inset-top,0px))] text-white">
        <img src="/images/feature-living.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-zinc-950/65" />
        <div className="relative mx-auto max-w-7xl px-5 pb-14 pt-10 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-300">부위별 자재뷰</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                샘플 조각이 아니라, 설치됐을 때의 공간 이미지로 고릅니다
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-200">
                공간·부위·자재를 고르고 버튼 한 번이면, 내 공간 사진(또는 샘플 공간)에 그 자재가
                실제로 적용된 이미지를 AI가 만들어 드립니다. 생성 1회당 1토큰, 마음에 들면 저장하세요.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 self-end text-sm">
              {[
                ["실 선택", "거실, 안방, 부엌, 욕실"],
                ["부위 선택", "바닥, 벽, 천정"],
                ["시공 이미지", "적용 후 분위기"],
              ].map(([title, desc]) => (
                <div key={title} className="border border-white/15 bg-white/10 p-4">
                  <p className="font-black text-white">{title}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-300">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-[1fr_1fr] lg:px-8">
          <div className="flex gap-2 overflow-x-auto">
            {ROOMS.map((item) => {
              const Icon = item.icon;
              const active = item.key === room;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setRoom(item.key);
                    setMaterialIdx(0);
                  }}
                  className={`inline-flex min-w-[108px] items-center justify-center gap-2 border px-4 py-3 text-sm font-black ${
                    active ? "border-primary-500 bg-primary-500 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 overflow-x-auto lg:justify-end">
            {SURFACES.map((item) => {
              const Icon = item.icon;
              const active = item.key === surface;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setSurface(item.key);
                    setMaterialIdx(0);
                  }}
                  className={`inline-flex min-w-[104px] items-center justify-center gap-2 border px-4 py-3 text-sm font-black ${
                    active ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div>
          {/* 소스 선택: 샘플 공간 또는 내 사진 */}
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setSourceMode("sample"); setResultUrl(null); }}
              className={`inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-black ${
                sourceMode === "sample" ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> 샘플 공간
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-black ${
                sourceMode === "upload" ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
            >
              <Upload className="h-3.5 w-3.5" /> 내 사진 업로드
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
            {/* 2D / 3D 토글 */}
            <div className="ml-auto inline-flex border border-zinc-200">
              <button
                type="button"
                onClick={() => setViewMode("2d")}
                className={`px-3 py-2 text-xs font-black ${viewMode === "2d" ? "bg-zinc-950 text-white" : "bg-white text-zinc-600"}`}
              >
                2D
              </button>
              <button
                type="button"
                onClick={() => setViewMode("3d")}
                className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-black ${viewMode === "3d" ? "bg-zinc-950 text-white" : "bg-white text-zinc-600"}`}
              >
                <Box className="h-3.5 w-3.5" /> 3D
              </button>
            </div>
          </div>

          {/* 미리보기 캔버스 */}
          <div id="preview-canvas" className="relative overflow-hidden border border-zinc-200 bg-zinc-100 scroll-mt-24">
            <div className="relative aspect-[4/3]">
              {viewMode === "3d" ? (
                <Material3DViewer
                  surface={surface}
                  textureUrl={
                    materialImages[selected.query]?.includes("supabase")
                      ? materialImages[selected.query]
                      : null
                  }
                  color={selected.swatch}
                />
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resultUrl && !showBefore ? resultUrl : currentSourcePreview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {generating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/70 text-white">
                      <Loader2 className="h-7 w-7 animate-spin" />
                      <p className="text-sm font-bold">AI가 {surfaceLabel}에 자재를 적용 중… (최대 30초)</p>
                    </div>
                  )}
                  {!resultUrl && !generating && (
                    <div className="absolute bottom-4 left-4 right-4 bg-white/92 p-4 backdrop-blur">
                      <p className="text-xs font-bold uppercase tracking-widest text-primary-600">미리보기 대상</p>
                      <h2 className="mt-1 text-xl font-black tracking-tight">{previewTitle}</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">아래 버튼을 누르면 이 공간에 선택한 자재가 실제로 적용된 이미지를 만들어 드려요.</p>
                    </div>
                  )}
                  {resultUrl && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-zinc-950/80 px-2.5 py-1 text-[11px] font-black text-white">
                      {showBefore ? "적용 전" : "적용 후"}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 생성 버튼 (1토큰) + 잔액 */}
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-primary-500 px-4 py-3.5 text-sm font-black text-white transition hover:bg-primary-600 disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {resultUrl ? "다시 생성" : "AI 미리보기 생성"} · 1토큰
          </button>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Hexagon className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              보유 토큰 <b className="text-zinc-800">{balance}</b>
            </span>
            <Link href="/mypage/billing" className="font-bold text-primary-600 hover:underline">토큰 충전</Link>
          </div>
          {error && <p className="mt-2 text-[13px] font-semibold text-red-500">{error}</p>}

          {/* 결과 액션 */}
          {resultUrl && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBefore((v) => !v)}
                className="inline-flex items-center gap-1.5 border border-zinc-300 px-3 py-2 text-xs font-black text-zinc-700 hover:border-zinc-500"
              >
                {showBefore ? "적용 후 보기" : "적용 전과 비교"}
              </button>
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-zinc-300 px-3 py-2 text-xs font-black text-zinc-700 hover:border-zinc-500"
              >
                <Download className="h-3.5 w-3.5" /> 다운로드
              </a>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-zinc-950 px-3 py-2 text-xs font-black text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                내 미리보기에 저장
              </button>
              {savedMsg && <span className="text-xs font-semibold text-emerald-600">{savedMsg}</span>}
            </div>
          )}
        </div>

        <div>
          <div className="border border-zinc-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">선택 조건</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">{roomMeta.label} · {SURFACES.find((s) => s.key === surface)?.label}</h2>
              </div>
              <span className="inline-flex items-center gap-1 bg-primary-50 px-3 py-2 text-xs font-black text-primary-700">
                <Sparkles className="h-3 w-3" />
                적용형 추천
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-600">{ROOM_SURFACE_NOTE[room][surface]}</p>
          </div>

          <div id="materials" className="mt-4 grid gap-3 scroll-mt-24">
            {materials.map((item, idx) => {
              const active = idx === materialIdx;
              return (
                <button
                  key={item.name}
                  onClick={() => setMaterialIdx(idx)}
                  className={`grid grid-cols-[48px_1fr_auto] items-center gap-4 border p-4 text-left transition ${
                    active ? "border-primary-500 bg-primary-50" : "border-zinc-200 bg-white hover:border-zinc-400"
                  }`}
                >
                  {materialImages[item.query] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={materialImages[item.query]}
                      alt={item.name}
                      className="h-12 w-12 border border-zinc-200 object-cover"
                    />
                  ) : (
                    <span className="h-12 w-12 border border-zinc-200" style={{ backgroundColor: item.swatch }} />
                  )}
                  <span>
                    <span className="block text-base font-black tracking-tight">{item.name}</span>
                    <span className="mt-1 block text-sm text-zinc-600">{item.tone} · {item.scene}</span>
                  </span>
                  <span className={`flex h-7 w-7 items-center justify-center border ${active ? "border-primary-500 bg-primary-500 text-white" : "border-zinc-300 text-zinc-300"}`}>
                    <Check className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/workflow"
              className="inline-flex items-center justify-center gap-2 bg-primary-500 px-4 py-3 text-sm font-black text-white hover:bg-primary-600"
            >
              이 자재로 전체 디자인
              <Wand2 className="h-4 w-4" />
            </Link>
            <Link
              href={`/partial-install?room=${room}&surface=${surface}`}
              className="inline-flex items-center justify-center gap-2 border border-zinc-950 px-4 py-3 text-sm font-black text-zinc-950 hover:bg-zinc-950 hover:text-white"
            >
              부분 시공 연결
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 내 미리보기 — 저장한 결과 갤러리 */}
      {gallery.length > 0 && (
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary-600">MY PREVIEWS</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">내 미리보기</h2>
              </div>
              <span className="text-sm text-zinc-500">{gallery.length}개 저장됨</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {gallery.map((p) => (
                <div key={p.id} className="group relative overflow-hidden border border-zinc-200 bg-white">
                  <div className="aspect-[4/3] overflow-hidden bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.resultUrl} alt={p.materialName ?? ""} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="truncate text-[13px] font-bold text-zinc-900">{p.materialName}</p>
                    <p className="text-[11px] text-zinc-500">{p.room} · {p.surface}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSaved(p.id)}
                    aria-label="삭제"
                    className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full bg-white/90 text-zinc-600 shadow group-hover:flex hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["실별", "거실, 안방, 부엌, 욕실처럼 사용 맥락이 다른 공간을 먼저 나눕니다."],
              ["부위별", "바닥, 벽, 천정처럼 실제 견적 항목과 연결되는 기준으로 나눕니다."],
              ["자재별", "샘플 컬러가 아니라 시공 후 공간 장면과 견적 연결까지 보여줍니다."],
            ].map(([title, desc]) => (
              <div key={title} className="border border-white/15 p-5">
                <Layers className="h-5 w-5 text-primary-300" />
                <h3 className="mt-4 text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
