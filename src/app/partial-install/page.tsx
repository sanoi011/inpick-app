"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  calcPartialEstimate,
  surfaceUnitLabel,
  type PartialSurface,
  type PartialRates,
} from "@/lib/partial/partial-estimate";
import {
  MATERIAL_GROUPS,
  HOT_CATEGORIES,
  ALL_CATEGORIES,
  type MaterialCategory,
} from "@/lib/materials/catalog";
import {
  ArrowRight,
  Bath,
  Blinds,
  CheckCircle2,
  DoorOpen,
  Droplet,
  Hammer,
  Layers,
  Lightbulb,
  Loader2,
  MapPin,
  Paintbrush,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  Star,
  Utensils,
  Wrench,
} from "lucide-react";
import HeaderV4 from "@/components/landing-v4/HeaderV4";

type ProductResult = {
  productId: string;
  title: string;
  image: string | null;
  price: number;
  mallName: string;
  link: string;
  brand?: string;
  sku?: string;
  spec?: string;
  source?: "internal" | "naver" | "mock";
};

// 그룹 키 → 아이콘
const GROUP_ICONS: Record<string, typeof Bath> = {
  bath: Bath,
  kitchen: Utensils,
  door: DoorOpen,
  furniture: Sofa,
  floor: Layers,
  wall: Paintbrush,
  electric: Lightbulb,
  window: Blinds,
  plumbing: Droplet,
  repair: Hammer,
};

export default function PartialInstallPage() {
  const [region, setRegion] = useState("대전 유성구");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeQuery, setActiveQuery] = useState("");
  const [scaleInput, setScaleInput] = useState(""); // 시공 규모(면적㎡/수량EA), 빈 값=기본
  const [activeGroupKey, setActiveGroupKey] = useState(MATERIAL_GROUPS[0]?.key ?? "bath");
  const [surfaceOverride, setSurfaceOverride] = useState<PartialSurface | null>(null);
  const [rates, setRates] = useState<Partial<Record<PartialSurface, Partial<PartialRates>>>>();

  const activeGroup = useMemo(
    () => MATERIAL_GROUPS.find((g) => g.key === activeGroupKey) ?? MATERIAL_GROUPS[0],
    [activeGroupKey]
  );

  const searchProducts = async (q: string, surface?: PartialSurface) => {
    const term = q.trim();
    if (!term) return;
    setActiveQuery(term);
    setSurfaceOverride(surface ?? null);
    setSearching(true);
    try {
      const res = await fetch(`/api/product-search?query=${encodeURIComponent(term)}`);
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch {
      setProducts([]);
    } finally {
      setSearching(false);
    }
    if (typeof document !== "undefined") {
      document.getElementById("product-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 카탈로그 카테고리 클릭 → 실구매 상품 검색 + 적산 부위 지정
  const pickCategory = (cat: MaterialCategory) => searchProducts(cat.query, cat.surface);

  // URL ?q= 자동 검색 (딥링크/검증용)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) searchProducts(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 관리자 단가DB 로드 (없으면 적산 엔진 내장 기본값 사용)
  useEffect(() => {
    fetch("/api/partial/rates")
      .then((r) => r.json())
      .then((d) => {
        if (d?.rates && Object.keys(d.rates).length > 0) setRates(d.rates);
      })
      .catch(() => {});
  }, []);

  // 자유 검색어 → 부위 추정 (카탈로그 클릭 시엔 명시 부위 우선)
  const inferSurface = (q: string): PartialSurface => {
    if (/마루|바닥|장판|데코타일|폴리싱|LVT|SPC|타일.*바닥|바닥.*타일/i.test(q)) return "floor";
    if (/벽지|도배|타일|아트월|템바|스타코|월패널|포세린|필름|페인트|도장/i.test(q)) return "wall";
    if (/천장|천정|몰딩|루버|우물/i.test(q)) return "ceiling";
    return "etc";
  };

  const activeSurface = useMemo(
    () => surfaceOverride ?? inferSurface(activeQuery),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surfaceOverride, activeQuery]
  );
  const scaleUnit = surfaceUnitLabel(activeSurface);

  // 검색 결과 대표가(중앙값) + 시공규모(면적/수량)로 예상 시공 견적 산출
  const estimate = useMemo(() => {
    if (!activeQuery || products.length === 0) return null;
    const prices = products.map((p) => p.price).filter((n) => n > 0).sort((a, b) => a - b);
    if (prices.length === 0) return null;
    const median = prices[Math.floor(prices.length / 2)];
    const parsed = Number(scaleInput);
    const quantity = scaleInput.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    return calcPartialEstimate({
      surface: activeSurface,
      materialName: activeQuery,
      unitPrice: median,
      quantity,
      region,
      rates,
    });
  }, [activeQuery, activeSurface, products, region, scaleInput, rates]);

  const [installContact, setInstallContact] = useState("");
  const [installNote, setInstallNote] = useState("");
  const [installSending, setInstallSending] = useState(false);
  const [installMsg, setInstallMsg] = useState("");

  const submitInstall = async () => {
    if (!estimate) return;
    setInstallSending(true);
    setInstallMsg("");
    try {
      const cheapest = [...products].sort((a, b) => a.price - b.price)[0];
      const res = await fetch("/api/partial/install-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface: activeSurface,
          materialQuery: activeQuery,
          productTitle: cheapest?.title,
          productPrice: cheapest?.price,
          productLink: cheapest?.link,
          region,
          contact: installContact,
          note: installNote,
          estimateTotal: estimate.total,
          estimateLines: estimate.lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInstallMsg(data?.error || "요청에 실패했습니다.");
        return;
      }
      setInstallMsg("설치 요청이 접수됐어요. 지역 설치업체가 확인 후 연락드립니다.");
      setInstallContact("");
      setInstallNote("");
    } catch {
      setInstallMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setInstallSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <HeaderV4 />

      <section className="relative overflow-hidden bg-zinc-950 pt-28 text-white">
        <img
          src="/images/hero-kitchen.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-zinc-950/70" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-5 pb-16 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary-300">부분 자재·시공</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              건축 자재·기구 전부, 제품 추천부터 실구매·설치까지
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-200">
              욕실·주방·문·가구·바닥·벽·조명·창호·설비까지 {ALL_CATEGORIES.length}개 카테고리.
              원하는 자재를 고르면 실시간 상품(실제 구매 가능), 예상 시공 견적,
              근처 설치업체 연결까지 한 화면에서 정리합니다.
            </p>
            <div className="mt-7 flex flex-wrap gap-2 text-sm">
              {["전 카테고리 자재", "실제 구매 링크", "예상 시공 견적", "근처 설치업체"].map((label) => (
                <span key={label} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary-300" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="self-end border border-white/15 bg-white/10 p-5 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-bold text-primary-200">
              <SlidersHorizontal className="h-4 w-4" />
              빠른 검색
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.8fr]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && query.trim()) searchProducts(query);
                  }}
                  placeholder="예: 변기, 강마루, 도어록 (Enter로 상품 검색)"
                  className="h-11 w-full border border-white/20 bg-white/95 pl-10 pr-3 text-sm font-semibold text-zinc-950 outline-none focus:border-primary-400"
                />
              </label>
              <label className="relative block">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="h-11 w-full border border-white/20 bg-white/95 pl-10 pr-3 text-sm font-semibold text-zinc-950 outline-none focus:border-primary-400"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {HOT_CATEGORIES.slice(0, 8).map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => pickCategory(c)}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-500"
                >
                  <Star className="h-3 w-3 text-primary-300" />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 전체 자재 카탈로그 — 그룹 탭 → 카테고리 (클릭 시 실구매 상품 검색 + 적산) */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">전체 자재 카탈로그</p>
              <p className="mt-1 max-w-2xl text-sm text-zinc-600">
                건축·인테리어에 들어가는 모든 자재·기구를 {MATERIAL_GROUPS.length}개 그룹 · {ALL_CATEGORIES.length}개 카테고리로 정리했어요.
                카테고리를 누르면 실제 구매 가능한 상품과 예상 시공 견적을 바로 보여드립니다.
              </p>
            </div>
            <Link
              href={`/find-contractors?region=${encodeURIComponent(region)}`}
              className="hidden shrink-0 items-center gap-2 bg-zinc-950 px-4 py-3 text-sm font-black text-white hover:bg-primary-600 sm:inline-flex"
            >
              {region} 설치업체 찾기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* 그룹 탭 */}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {MATERIAL_GROUPS.map((g) => {
              const Icon = GROUP_ICONS[g.key] ?? ShoppingBag;
              const active = g.key === activeGroupKey;
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setActiveGroupKey(g.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 border px-3.5 py-2 text-sm font-bold transition ${
                    active
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-primary-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {g.title}
                  <span className={`ml-0.5 text-[11px] font-bold ${active ? "text-white/70" : "text-zinc-400"}`}>
                    {g.items.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 활성 그룹의 카테고리 칩 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {activeGroup?.items.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pickCategory(c)}
                className={`inline-flex items-center gap-1 border px-3 py-2 text-xs font-bold transition ${
                  activeQuery === c.query
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-primary-300 hover:text-primary-600"
                }`}
              >
                {c.hot && <Star className="h-3 w-3 text-amber-400" />}
                {c.name}
              </button>
            ))}
          </div>

          <Link
            href={`/find-contractors?region=${encodeURIComponent(region)}`}
            className="mt-6 inline-flex items-center gap-2 bg-zinc-950 px-4 py-3 text-sm font-black text-white hover:bg-primary-600 sm:hidden"
          >
            {region} 설치업체 찾기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 상품 검색 결과 — 사진 + 가격 + 쇼핑몰별 (클릭 시 해당 쇼핑몰에서 실제 구매) */}
      {(searching || products.length > 0 || activeQuery) && (
        <section id="product-results" className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary-600">상품 검색 · 실구매</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  {activeQuery ? `‘${activeQuery}’ 추천 상품` : "추천 상품"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">사진·가격·쇼핑몰을 비교하고, 카드를 누르면 해당 쇼핑몰에서 바로 구매할 수 있어요.</p>
              </div>
            </div>

            {searching ? (
              <div className="flex items-center justify-center py-20 text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <div className="mt-6 border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-400">
                검색 결과가 없습니다. 다른 검색어로 시도해보세요.
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((p) => (
                  <a
                    key={p.productId}
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col overflow-hidden border border-zinc-200 bg-white transition hover:shadow-md"
                  >
                    <div className="flex aspect-square items-center justify-center overflow-hidden bg-zinc-100">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt={p.title}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <ShoppingBag className="h-10 w-10 text-zinc-300" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <span
                        className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[11px] font-bold ${
                          p.source === "internal" ? "bg-primary-100 text-primary-700" : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {p.mallName}
                      </span>
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-zinc-700">{p.title}</p>
                      {(p.brand || p.sku) && (
                        <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                          {p.brand}
                          {p.brand && p.sku ? " · " : ""}
                          {p.sku}
                        </p>
                      )}
                      <p className="mt-auto pt-2 text-base font-black text-zinc-950">
                        {p.price > 0 ? (
                          <>
                            {p.price.toLocaleString()}
                            <span className="text-xs font-bold text-zinc-500">원~</span>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-zinc-500">가격 문의</span>
                        )}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary-600">
                        {p.source === "internal" ? "상품 보러가기" : "구매하러 가기"} <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {estimate && !searching && (
              <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                {/* 예상 적산 견적 */}
                <div className="border border-zinc-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black tracking-tight">예상 시공 견적</h3>
                    <span className="bg-primary-50 px-2 py-1 text-[11px] font-black text-primary-700">{activeQuery}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-zinc-50 p-3 text-sm">
                    <label className="font-bold text-zinc-600">시공 규모</label>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={scaleInput}
                      onChange={(e) => setScaleInput(e.target.value)}
                      placeholder={String(estimate.effectiveQty)}
                      className="h-9 w-24 border border-zinc-300 px-2 text-right font-bold outline-none focus:border-primary-500"
                    />
                    <span className="font-bold text-zinc-500">{scaleUnit}</span>
                    <span className="text-[12px] text-zinc-400">
                      {estimate.basis === "area" ? "바닥·벽·천정은 면적(㎡) 기준" : "도기·설비는 수량(개) 기준"}
                      {estimate.regionMultiplier > 1 && ` · 지역 노무 ×${estimate.regionMultiplier.toFixed(2)}`}
                    </span>
                  </div>
                  <table className="mt-4 w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                        <th className="py-2 font-semibold">공종 / 품명</th>
                        <th className="py-2 text-right font-semibold">수량</th>
                        <th className="py-2 text-right font-semibold">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimate.lines.map((l, i) => (
                        <tr key={i} className="border-b border-zinc-100 align-top">
                          <td className="py-2">
                            <span className="block font-bold text-zinc-800">{l.item}</span>
                            <span className="text-[11px] text-zinc-400">
                              {l.trade}
                              {l.source === "product" && " · 상품 참고가"}
                            </span>
                          </td>
                          <td className="py-2 text-right text-zinc-500">{l.qty}{l.unit}</td>
                          <td className="py-2 text-right font-bold text-zinc-900">{l.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 space-y-1 text-sm text-zinc-600">
                    <div className="flex justify-between"><span>소계</span><span>{estimate.subtotal.toLocaleString()}원</span></div>
                    <div className="flex justify-between"><span>간접비 (6%)</span><span>{estimate.overhead.toLocaleString()}원</span></div>
                    <div className="flex justify-between"><span>이윤 (5%)</span><span>{estimate.profit.toLocaleString()}원</span></div>
                    <div className="flex justify-between"><span>부가세 (10%)</span><span>{estimate.vat.toLocaleString()}원</span></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t-2 border-zinc-900 pt-3">
                    <span className="text-base font-black">예상 합계</span>
                    <span className="text-2xl font-black text-primary-600">{estimate.total.toLocaleString()}원</span>
                  </div>
                  {estimate.warnings.map((w, i) => (
                    <p key={i} className="mt-2 text-[12px] leading-5 text-zinc-400">· {w}</p>
                  ))}
                  {estimate.basis === "area" && (
                    <Link
                      href={`/material-preview?surface=${activeSurface}&mat=${encodeURIComponent(activeQuery)}`}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-primary-500 px-4 py-2.5 text-sm font-black text-primary-600 hover:bg-primary-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      이 자재 내 공간에 미리보기
                    </Link>
                  )}
                </div>

                {/* 설치업체 연결 (리드) */}
                <div className="border border-zinc-200 bg-zinc-50 p-5">
                  <h3 className="text-lg font-black tracking-tight">설치업체 연결</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {region} 검증 설치업체에게 이 자재 시공을 요청합니다. 업체가 확인 후 연락드려요.
                  </p>
                  <label className="mt-4 block text-xs font-bold text-zinc-500">지역</label>
                  <input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="mt-1 h-11 w-full border border-zinc-300 px-3 text-sm outline-none focus:border-primary-500"
                  />
                  <label className="mt-3 block text-xs font-bold text-zinc-500">연락처 (휴대폰/이메일)</label>
                  <input
                    value={installContact}
                    onChange={(e) => setInstallContact(e.target.value)}
                    placeholder="010-0000-0000"
                    className="mt-1 h-11 w-full border border-zinc-300 px-3 text-sm outline-none focus:border-primary-500"
                  />
                  <label className="mt-3 block text-xs font-bold text-zinc-500">요청사항 (선택)</label>
                  <textarea
                    value={installNote}
                    onChange={(e) => setInstallNote(e.target.value)}
                    rows={2}
                    placeholder="희망 일정, 현장 상황 등"
                    className="mt-1 w-full resize-none border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                  <button
                    type="button"
                    onClick={submitInstall}
                    disabled={installSending}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-zinc-950 px-4 py-3 text-sm font-black text-white hover:bg-primary-600 disabled:opacity-60"
                  >
                    {installSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                    설치 요청 보내기
                  </button>
                  {installMsg && <p className="mt-2 text-[13px] font-semibold text-emerald-600">{installMsg}</p>}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["1", "자재·기구 선택", "전 카테고리에서 교체할 자재를 고릅니다."],
              ["2", "실구매 상품 비교", "사진·가격·쇼핑몰을 비교하고 바로 구매합니다."],
              ["3", "근처 시공 연결", "지역 기반 설치 파트너에게 부분 시공 상담을 보냅니다."],
            ].map(([step, title, desc]) => (
              <div key={step} className="border border-zinc-200 p-5">
                <span className="text-xs font-black text-primary-600">STEP {step}</span>
                <h3 className="mt-2 text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-zinc-200 bg-zinc-50 p-5">
            <div>
              <p className="text-sm font-bold text-zinc-500">전체 인테리어가 필요하신가요?</p>
              <p className="mt-1 text-lg font-black">주소만 입력하면 AI가 도면·디자인·17공종 견적까지 한 번에 만들어 드립니다.</p>
            </div>
            <Link href="/workflow" className="inline-flex items-center gap-2 bg-primary-500 px-4 py-3 text-sm font-black text-white hover:bg-primary-600">
              전체 인테리어 시작
              <Sparkles className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
