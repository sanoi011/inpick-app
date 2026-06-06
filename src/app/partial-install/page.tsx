"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { calcPartialEstimate, type PartialSurface } from "@/lib/partial/partial-estimate";
import {
  ArrowRight,
  Bath,
  CheckCircle2,
  Droplet,
  Loader2,
  MapPin,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Toilet,
  Wrench,
} from "lucide-react";
import HeaderV4 from "@/components/landing-v4/HeaderV4";

type ProductPart = {
  id: string;
  room: string;
  part: string;
  icon: typeof Toilet;
  title: string;
  summary: string;
  trend: string;
  installScope: string;
  budget: string;
  searchTerms: string[];
  picks: Array<{
    name: string;
    tag: string;
    reason: string;
    price: string;
    query: string;
  }>;
};

const PRODUCT_PARTS: ProductPart[] = [
  {
    id: "toilet",
    room: "욕실",
    part: "양변기",
    icon: Toilet,
    title: "양변기 교체",
    summary: "물내림 성능, 청소 편의, 절수 등급을 기준으로 제품과 설치 범위를 같이 비교합니다.",
    trend: "림리스, 치마형, 절수형",
    installScope: "기존 철거, 폐기, 플랜지 보수, 백시멘트 마감",
    budget: "제품+시공 25만~70만원대",
    searchTerms: ["치마형 양변기", "림리스 양변기", "대림바스 양변기", "아메리칸스탠다드 양변기"],
    picks: [
      {
        name: "치마형 원피스 양변기",
        tag: "청소 쉬움",
        reason: "측면 배관 굴곡이 적어 욕실을 깔끔하게 보이게 합니다.",
        price: "중가",
        query: "치마형 원피스 양변기 설치",
      },
      {
        name: "림리스 절수 양변기",
        tag: "최근 선호",
        reason: "테두리 오염이 적고 물 사용량을 줄이기 좋습니다.",
        price: "중가",
        query: "림리스 절수 양변기",
      },
      {
        name: "비데 일체형 양변기",
        tag: "프리미엄",
        reason: "콘센트와 방수 상태가 맞는 욕실에서 만족도가 높습니다.",
        price: "고가",
        query: "비데 일체형 양변기",
      },
    ],
  },
  {
    id: "basin",
    room: "욕실",
    part: "세면대",
    icon: Droplet,
    title: "세면대 교체",
    summary: "하부장 유무, 수전 위치, 배수관 노출 여부까지 보고 제품을 추천합니다.",
    trend: "탑볼, 하부장형, 무광 화이트",
    installScope: "기존 세면기 철거, 앵글밸브 점검, 배수 트랩 교체",
    budget: "제품+시공 20만~90만원대",
    searchTerms: ["욕실 세면대 하부장", "탑볼 세면대", "반다리 세면대", "무광 세면대"],
    picks: [
      {
        name: "하부장 일체형 세면대",
        tag: "수납 강화",
        reason: "좁은 욕실에서 청소용품과 수건을 숨기기 좋습니다.",
        price: "중가",
        query: "욕실 세면대 하부장 설치",
      },
      {
        name: "탑볼 세면대",
        tag: "호텔 무드",
        reason: "상판과 수전을 같이 고르면 작은 욕실도 디자인 포인트가 됩니다.",
        price: "중고가",
        query: "탑볼 세면대 수전 세트",
      },
      {
        name: "반다리 세면대",
        tag: "가성비",
        reason: "배관을 가리면서도 시공 변수가 적어 교체가 빠릅니다.",
        price: "저중가",
        query: "반다리 세면대 교체",
      },
    ],
  },
  {
    id: "shower",
    room: "욕실",
    part: "수전/샤워기",
    icon: Bath,
    title: "수전·샤워기 교체",
    summary: "수압, 배관 간격, 욕실 톤에 맞춰 무광 니켈부터 크롬까지 추천합니다.",
    trend: "무광 니켈, 매립형 느낌, 절수 샤워기",
    installScope: "수전 탈거, 편심 교체, 누수 테스트, 실리콘 마감",
    budget: "제품+시공 12만~45만원대",
    searchTerms: ["욕실 샤워수전", "무광 니켈 샤워기", "해바라기 샤워기", "세면 수전"],
    picks: [
      {
        name: "무광 니켈 샤워수전",
        tag: "트렌드",
        reason: "웜톤 타일, 호텔식 욕실과 잘 맞고 지문이 덜 보입니다.",
        price: "중고가",
        query: "무광 니켈 샤워수전",
      },
      {
        name: "절수형 샤워헤드 세트",
        tag: "실속",
        reason: "큰 공사 없이 체감 변화를 만들 수 있는 교체 항목입니다.",
        price: "저가",
        query: "절수 샤워헤드 세트",
      },
      {
        name: "해바라기 샤워기",
        tag: "만족도",
        reason: "천장 높이와 급수 위치가 맞으면 샤워 경험이 크게 좋아집니다.",
        price: "중가",
        query: "해바라기 샤워기 설치",
      },
    ],
  },
  {
    id: "sink",
    room: "주방",
    part: "싱크볼/수전",
    icon: Wrench,
    title: "싱크볼·주방수전 교체",
    summary: "상판 타공 사이즈와 배수 구조를 기준으로 교체 가능한 제품만 좁혀 추천합니다.",
    trend: "사각 싱크볼, 거위목 수전, 무광 스테인리스",
    installScope: "싱크볼 탈거, 상판 실링, 배수구·트랩 교체",
    budget: "제품+시공 25만~85만원대",
    searchTerms: ["사각 싱크볼", "거위목 주방수전", "백조 싱크볼", "무광 싱크볼"],
    picks: [
      {
        name: "사각 언더 싱크볼",
        tag: "인기",
        reason: "상판과 일체감이 좋고 큰 냄비 세척이 편합니다.",
        price: "중가",
        query: "사각 언더 싱크볼",
      },
      {
        name: "거위목 주방수전",
        tag: "교체 효과",
        reason: "기존 싱크대도 수전만 바꾸면 사용성이 크게 좋아집니다.",
        price: "저중가",
        query: "거위목 주방수전",
      },
      {
        name: "무광 스테인리스 싱크볼",
        tag: "프리미엄",
        reason: "스크래치가 덜 도드라지고 모던 주방과 잘 맞습니다.",
        price: "중고가",
        query: "무광 스테인리스 싱크볼",
      },
    ],
  },
];

type ProductResult = {
  productId: string;
  title: string;
  image: string | null;
  price: number;
  mallName: string;
  link: string;
  brand?: string;
};

const EXTRA_SEARCHES = [
  "비데", "욕실장", "주방 후드", "쿡탑", "주방 상판", "싱크대 하부장",
  "벽 타일", "바닥 타일", "강마루", "장판", "벽지", "도어록", "문고리",
  "붙박이장", "신발장", "조명", "콘센트 스위치", "블라인드", "커튼",
];
const POPULAR_SEARCHES = Array.from(
  new Set([...PRODUCT_PARTS.flatMap((p) => p.searchTerms), ...EXTRA_SEARCHES])
);

export default function PartialInstallPage() {
  const [region, setRegion] = useState("대전 유성구");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeQuery, setActiveQuery] = useState("");

  const searchProducts = async (q: string) => {
    const term = q.trim();
    if (!term) return;
    setActiveQuery(term);
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

  // URL ?q= 자동 검색 (딥링크/검증용)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) searchProducts(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 검색어 → 부위 추정 (적산 노무 단가용)
  const inferSurface = (q: string): PartialSurface => {
    if (/마루|바닥|장판|데코타일|폴리싱|LVT|타일.*바닥|바닥.*타일/i.test(q)) return "floor";
    if (/벽지|도배|타일|아트월|템바|스타코|월패널|포세린/i.test(q)) return "wall";
    if (/천장|천정|몰딩|루버|우물/i.test(q)) return "ceiling";
    return "etc";
  };

  // 검색 결과 대표가(중앙값)로 예상 시공 견적 산출
  const estimate = useMemo(() => {
    if (!activeQuery || products.length === 0) return null;
    const prices = products.map((p) => p.price).filter((n) => n > 0).sort((a, b) => a - b);
    if (prices.length === 0) return null;
    const median = prices[Math.floor(prices.length / 2)];
    return calcPartialEstimate({
      surface: inferSurface(activeQuery),
      materialName: activeQuery,
      unitPrice: median,
      region,
    });
  }, [activeQuery, products, region]);

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
          surface: inferSurface(activeQuery),
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
              변기 하나, 세면대 하나도 제품 추천부터 설치업체까지
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-200">
              교체하고 싶은 부위를 고르면 인기 자재 유형, 실시간 상품 추천,
              예상 시공 범위, 근처 설치업체 연결까지 한 화면에서 정리합니다.
            </p>
            <div className="mt-7 flex flex-wrap gap-2 text-sm">
              {["자재 추천", "실시간 상품 검색", "근처 설치업체", "부분 견적"].map((label) => (
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
                  placeholder="예: 변기, 세면대, 싱크볼 (Enter로 상품 검색)"
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
          </div>
        </div>
      </section>

      {/* 자재 검색 — 모든 건축 자재·도기·가구를 빠른검색 또는 인기 카테고리로 */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">인기 자재 검색</p>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            위 빠른검색에 자재명을 입력하거나 아래 카테고리를 누르면 상품을 찾아드립니다. 도기·수전·주방가구·마감재·타일·바닥재·조명·철물·수납가구 등 인테리어에 필요한 모든 자재를 검색할 수 있어요.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => searchProducts(term)}
                className="inline-flex items-center gap-1 border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 hover:border-primary-300 hover:text-primary-600"
              >
                <Search className="h-3 w-3" />
                {term}
              </button>
            ))}
          </div>
          <Link
            href={`/find-contractors?region=${encodeURIComponent(region)}`}
            className="mt-6 inline-flex items-center gap-2 bg-zinc-950 px-4 py-3 text-sm font-black text-white hover:bg-primary-600"
          >
            {region} 설치업체 찾기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 상품 검색 결과 — 사진 + 가격 + 쇼핑몰별 (클릭 시 해당 쇼핑몰에서 구매) */}
      {(searching || products.length > 0 || activeQuery) && (
        <section id="product-results" className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary-600">상품 검색</p>
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
                      <span className="inline-flex w-fit items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-bold text-zinc-500">
                        {p.mallName}
                      </span>
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-zinc-700">{p.title}</p>
                      <p className="mt-auto pt-2 text-base font-black text-zinc-950">
                        {p.price.toLocaleString()}
                        <span className="text-xs font-bold text-zinc-500">원~</span>
                      </p>
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
                              {l.source === "product" && " · 네이버 참고가"}
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
              ["1", "교체 부위 선택", "욕실, 주방 등 원하는 부분만 고릅니다."],
              ["2", "제품 후보 비교", "인기 검색어와 자재 선택 기준을 확인합니다."],
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
              <p className="text-sm font-bold text-zinc-500">운영 확장 포인트</p>
              <p className="mt-1 text-lg font-black">실시간 상품 검색·가격 비교, 설치업체 지역 재고, 실측 예약까지 붙일 수 있습니다.</p>
            </div>
            <Link href="/workflow" className="inline-flex items-center gap-2 bg-primary-500 px-4 py-3 text-sm font-black text-white hover:bg-primary-600">
              전체 인테리어도 보기
              <Sparkles className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
