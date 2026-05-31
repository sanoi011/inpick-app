"use client";

// /estimate-lab — 견적서 디테일 프로토타입
// ① 수량내역서(편집·엑셀식 면적연동) ② 원가계산서(조달청 제비율·편집·코멘트) ③ 공정표(막대그래프)
// 카테고리(아파트/상가) 분기 · 역할(소비자 1차 / 사업자 입찰) · 제비용 포함 토글.

import { useEffect, useMemo, useState } from "react";
import {
  Building2, Store, Calculator, ChevronDown, ChevronRight, Check,
  TrendingDown, ImageIcon, Trash2, FileText, Receipt, CalendarRange, Ruler, MessageSquare,
  FileSignature, Layers,
} from "lucide-react";
import { RESIDENTIAL_MASTER } from "@/lib/estimate-pro/residential-master";
import { COMMERCIAL_MASTER } from "@/lib/estimate-pro/commercial-master";
import { assembleSheet, type DetailLine } from "@/lib/estimate-pro/detail-model";
import {
  computeCostSheet, defaultJebiItems, defaultMarginRates,
  type JebiItem, type MarginRates,
} from "@/lib/estimate-pro/cost-model";
import { buildSchedule } from "@/lib/estimate-pro/schedule-model";

const won = (n: number) => Math.round(n).toLocaleString("ko-KR");

const PART_COLOR: Record<string, string> = {
  "바닥": "bg-amber-100 text-amber-700", "벽": "bg-sky-100 text-sky-700",
  "천장": "bg-violet-100 text-violet-700", "걸레받이/몰딩": "bg-orange-100 text-orange-700",
  "욕실": "bg-teal-100 text-teal-700", "주방": "bg-rose-100 text-rose-700",
  "창호/문": "bg-indigo-100 text-indigo-700", "설비": "bg-cyan-100 text-cyan-700",
  "전기": "bg-yellow-100 text-yellow-700", "단열": "bg-lime-100 text-lime-700",
  "공통": "bg-gray-100 text-gray-600",
};

type Row = DetailLine & { baseQty: number };

const BASE_AREA = { residential: 84, commercial: 165 };

function buildRows(category: "residential" | "commercial", sash: boolean, insulation: boolean, area: number): Row[] {
  const f = area / BASE_AREA[category];
  const master = category === "residential"
    ? RESIDENTIAL_MASTER.filter((m) => (m.trade !== "샷시" || sash) && (m.trade !== "단열" || insulation))
    : COMMERCIAL_MASTER;
  let i = 0;
  return master.map((m) => {
    const scale = m.unit === "m²" ? f : m.unit === "m" ? Math.sqrt(f) : 1;
    const qty = Math.round(m.quantity * scale * 100) / 100;
    const matAmount = Math.round(qty * m.matUnit);
    const labAmount = Math.round(qty * m.labUnit);
    return {
      id: `r-${i++}`, trade: m.trade, order: m.order, itemCode: "", itemName: m.itemName,
      part: m.part, spec: m.spec, brand: m.brand, product: m.product, priceBand: m.priceBand, imageHint: m.imageHint,
      unit: m.unit, quantity: qty, matUnit: m.matUnit, labUnit: m.labUnit, labWas: m.labWas, labNote: m.labNote,
      matAmount, labAmount, amount: matAmount + labAmount, room: "전체", source: m.source,
      optional: m.optional, added: false, baseQty: qty,
    };
  });
}

function recalc(r: Row): Row {
  const matAmount = Math.round(r.quantity * r.matUnit);
  const labAmount = Math.round(r.quantity * r.labUnit);
  return { ...r, matAmount, labAmount, amount: matAmount + labAmount, baseQty: r.quantity };
}

export default function EstimateLabPage() {
  const [category, setCategory] = useState<"residential" | "commercial">("residential");
  const [role, setRole] = useState<"owner" | "bidder">("owner");
  const [tab, setTab] = useState<"cover" | "summary" | "rollup" | "detail" | "schedule">("cover");
  const [meta, setMeta] = useState({ projectName: "", client: "", vendor: "INPICK 제휴 시공사", date: "" });
  const [sash, setSash] = useState(false);
  const [insulation, setInsulation] = useState(false);
  const [area, setArea] = useState(BASE_AREA.residential);
  const [includeJebi, setIncludeJebi] = useState(true);
  const [targetDays, setTargetDays] = useState(30);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [rows, setRows] = useState<Row[]>(() => buildRows("residential", false, false, BASE_AREA.residential));
  const [jebi, setJebi] = useState<JebiItem[]>(() => defaultJebiItems());
  const [margins, setMargins] = useState<MarginRates>(() => defaultMarginRates());

  // 카테고리/옵션/면적 변경 → 행 재생성 (엑셀식 면적 연동)
  useEffect(() => {
    setRows(buildRows(category, sash, insulation, area));
  }, [category, sash, insulation, area]);

  const sheet = useMemo(() => assembleSheet(rows), [rows]);
  const cost = useMemo(
    () => computeCostSheet({ directMaterial: sheet.directMaterial, directLabor: sheet.directLabor, jebi, margins, includeJebi }),
    [sheet.directMaterial, sheet.directLabor, jebi, margins, includeJebi]
  );
  const schedule = useMemo(() => buildSchedule(sheet.groups, targetDays), [sheet.groups, targetDays]);

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? recalc({ ...r, ...patch }) : r)));
  const deleteRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const updateJebi = (key: string, patch: Partial<JebiItem>) =>
    setJebi((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const switchCategory = (c: "residential" | "commercial") => {
    setCategory(c);
    setArea(BASE_AREA[c]);
    setSash(false); setInsulation(false);
  };

  const toggleGroup = (t: string) =>
    setCollapsed((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-3">
          <h1 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-amber-600" /> 견적서 디테일 LAB
          </h1>
          {/* 카테고리 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <SegBtn active={category === "residential"} onClick={() => switchCategory("residential")} icon={<Building2 className="w-3.5 h-3.5" />}>아파트/주택</SegBtn>
            <SegBtn active={category === "commercial"} onClick={() => switchCategory("commercial")} icon={<Store className="w-3.5 h-3.5" />}>상가</SegBtn>
          </div>
          {/* 역할 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-auto">
            <SegBtn active={role === "owner"} onClick={() => setRole("owner")}>1차 작성(고객/업체)</SegBtn>
            <SegBtn active={role === "bidder"} onClick={() => setRole("bidder")} icon={<MessageSquare className="w-3.5 h-3.5" />}>사업자 입찰</SegBtn>
          </div>
        </div>
        {/* 탭 — 견적서 표준 세트 순서 */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          <TabBtn active={tab === "cover"} onClick={() => setTab("cover")} icon={<FileSignature className="w-3.5 h-3.5" />}>1. 갑지</TabBtn>
          <TabBtn active={tab === "summary"} onClick={() => setTab("summary")} icon={<Receipt className="w-3.5 h-3.5" />}>2. 총괄표</TabBtn>
          <TabBtn active={tab === "rollup"} onClick={() => setTab("rollup")} icon={<Layers className="w-3.5 h-3.5" />}>3. 총괄내역서</TabBtn>
          <TabBtn active={tab === "detail"} onClick={() => setTab("detail")} icon={<FileText className="w-3.5 h-3.5" />}>4. 세부내역서</TabBtn>
          <TabBtn active={tab === "schedule"} onClick={() => setTab("schedule")} icon={<CalendarRange className="w-3.5 h-3.5" />}>공정표</TabBtn>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5">
        {/* 상단 요약 + 면적 드라이버 */}
        <div className="grid md:grid-cols-3 gap-3 mb-5">
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <Ruler className="w-3.5 h-3.5 text-gray-400" /> {category === "residential" ? "전용면적" : "점포면적"}
                <input type="number" value={area} min={20} max={500}
                  onChange={(e) => setArea(Math.max(10, Number(e.target.value) || 0))}
                  className="w-20 text-right text-xs font-bold border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <span className="text-gray-400">m² ({(area / 3.305).toFixed(1)}평)</span>
              </label>
              <span className="text-[11px] text-blue-500">면적 변경 시 바닥/벽/천장 등 면적·길이 물량이 일괄 재계산됩니다(엑셀식 연동)</span>
            </div>
            {category === "residential" && (
              <div className="flex flex-wrap gap-2 mt-3">
                <OptionToggle label="발코니 샷시 교체" hint="옵션" on={sash} onClick={() => setSash((v) => !v)} />
                <OptionToggle label="발코니 확장 단열" hint="옵션" on={insulation} onClick={() => setInsulation((v) => !v)} />
              </div>
            )}
          </div>
          <div className="bg-slate-800 text-white rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">도급금액 (VAT 포함)</p>
            <p className="text-2xl font-bold tabular-nums">{won(cost.contractPrice)}<span className="text-sm font-normal text-slate-400 ml-1">원</span></p>
            <div className="mt-2 space-y-0.5 text-[11px]">
              <Sum label="직접공사비" v={sheet.directTotal} />
              <Sum label={`제비·간접 (${includeJebi ? "포함" : "제외"})`} v={cost.netConstructionCost - sheet.directTotal + cost.generalAdmin + cost.profit} />
              <Sum label="부가세" v={cost.vat} />
            </div>
          </div>
        </div>

        {tab === "cover" && (
          <CoverTab meta={meta} setMeta={setMeta} cost={cost} category={category} area={area} lineCount={sheet.lineCount} tradeCount={sheet.groups.length} />
        )}
        {tab === "summary" && (
          <CostTab cost={cost} jebi={jebi} margins={margins} role={role}
            includeJebi={includeJebi} setIncludeJebi={setIncludeJebi}
            updateJebi={updateJebi} setMargins={setMargins} directTotal={sheet.directTotal} />
        )}
        {tab === "rollup" && (
          <RollupTab sheet={sheet} cost={cost} />
        )}
        {tab === "detail" && (
          <DetailTab sheet={sheet} collapsed={collapsed} toggleGroup={toggleGroup} role={role}
            updateRow={updateRow} deleteRow={deleteRow} />
        )}
        {tab === "schedule" && (
          <ScheduleTab schedule={schedule} targetDays={targetDays} setTargetDays={setTargetDays} />
        )}
      </div>
    </div>
  );
}

/* ───────────────── 탭 1: 수량내역서 (편집) ───────────────── */
function DetailTab({ sheet, collapsed, toggleGroup, role, updateRow, deleteRow }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">수량내역서 — 공종별 (모든 값 편집 가능)</h2>
        <span className="text-[11px] text-gray-400">수량·단가 직접 수정 · 자재명 hover로 추천 제품 · 🗑 삭제</span>
      </div>
      {sheet.groups.map((g: any) => {
        const open = !collapsed.has(g.trade);
        return (
          <div key={g.trade} className="border-b border-gray-100 last:border-0">
            <button onClick={() => toggleGroup(g.trade)} className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100">
              <div className="flex items-center gap-2">
                {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <span className="text-xs font-bold text-slate-700">{String(g.order).padStart(2, "0")}. {g.trade}</span>
                <span className="text-[11px] text-slate-400">{g.lines.length}건</span>
              </div>
              <span className="text-xs font-bold text-slate-800 tabular-nums">{won(g.sum)}원</span>
            </button>
            {open && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-slate-200 text-slate-500">
                      <th className="px-2 py-1.5 text-center font-semibold w-14">부위</th>
                      <th className="px-2 py-1.5 text-left font-semibold min-w-[160px]">품명 / 자재</th>
                      <th className="px-2 py-1.5 text-left font-semibold min-w-[110px]">규격</th>
                      <th className="px-2 py-1.5 text-center font-semibold w-9">단위</th>
                      <th className="px-2 py-1.5 text-right font-semibold w-16">수량</th>
                      <th className="px-2 py-1.5 text-right font-semibold w-20 bg-blue-50/40">재료단가</th>
                      <th className="px-2 py-1.5 text-right font-semibold w-24 bg-blue-50/40">재료금액</th>
                      <th className="px-2 py-1.5 text-right font-semibold w-20 bg-emerald-50/40">노무단가</th>
                      <th className="px-2 py-1.5 text-right font-semibold w-24 bg-emerald-50/40">노무금액</th>
                      <th className="px-2 py-1.5 text-right font-semibold w-28">합계</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map((l: Row) => (
                      <EditLineRow key={l.id} l={l} updateRow={updateRow} deleteRow={deleteRow} />
                    ))}
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={6} className="px-2 py-1.5 text-right font-bold text-slate-500">소계</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-bold text-slate-700">{won(g.matSum)}</td>
                      <td></td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-bold text-slate-700">{won(g.labSum)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-bold text-blue-700">{won(g.sum)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-bold">직접공사비 합계</span>
        <span className="text-lg font-bold tabular-nums">{won(sheet.directTotal)}원</span>
      </div>
    </div>
  );
}

function EditLineRow({ l, updateRow, deleteRow }: { l: Row; updateRow: any; deleteRow: any }) {
  const hasMat = l.brand !== "-";
  const numCls = "w-full text-right text-[11px] bg-transparent hover:bg-blue-50 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-400 rounded px-1 py-0.5 focus:outline-none tabular-nums";
  return (
    <tr className="border-b border-slate-50 hover:bg-blue-50/20">
      <td className="px-2 py-1 text-center">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${PART_COLOR[l.part] || "bg-gray-100 text-gray-600"}`}>{l.part}</span>
      </td>
      <td className="px-2 py-1">
        <div className="font-medium text-slate-800 flex items-center gap-1">
          {l.itemName}
          {l.optional && <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-600">옵션</span>}
        </div>
        {hasMat && (
          <div className="relative inline-block group mt-0.5">
            <span className="text-[10px] text-slate-500 border-b border-dotted border-slate-300 cursor-help">{l.brand} · {l.product}</span>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 z-40 w-64 bg-white border border-slate-200 rounded-lg shadow-xl p-3">
              <div className="flex items-start gap-2">
                <div className="w-14 h-14 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0"><ImageIcon className="w-5 h-5 text-slate-300" /></div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800">{l.brand}</p>
                  <p className="text-[11px] text-slate-600 leading-tight">{l.product}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">규격 {l.spec}</p>
                </div>
              </div>
              {l.priceBand && <p className="text-[10px] text-blue-600 mt-2 font-medium">금액대 · {l.priceBand}</p>}
              {l.imageHint && <p className="text-[10px] text-slate-500 mt-0.5">이미지 구현 · {l.imageHint}</p>}
              <p className="text-[9px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100">표준 추천 — 디자인/예산 따라 자동 추천·교체(연동 예정)</p>
            </div>
          </div>
        )}
      </td>
      <td className="px-2 py-1 text-slate-500">{l.spec}</td>
      <td className="px-2 py-1 text-center text-slate-500">{l.unit}</td>
      <td className="px-1 py-1"><input type="number" value={l.quantity} onChange={(e) => updateRow(l.id, { quantity: Number(e.target.value) || 0 })} className={numCls} /></td>
      <td className="px-1 py-1 bg-blue-50/20"><input type="number" value={l.matUnit} onChange={(e) => updateRow(l.id, { matUnit: Number(e.target.value) || 0 })} className={numCls} /></td>
      <td className="px-2 py-1 text-right tabular-nums text-slate-700 bg-blue-50/20">{won(l.matAmount)}</td>
      <td className="px-1 py-1 bg-emerald-50/20">
        <div className="flex items-center">
          {l.labWas && <span title={`보정 ${won(l.labWas)}→${won(l.labUnit)} · ${l.labNote || ""}`}><TrendingDown className="w-3 h-3 text-emerald-500 flex-shrink-0" /></span>}
          <input type="number" value={l.labUnit} onChange={(e) => updateRow(l.id, { labUnit: Number(e.target.value) || 0 })} className={numCls} />
        </div>
      </td>
      <td className="px-2 py-1 text-right tabular-nums text-slate-700 bg-emerald-50/20">{won(l.labAmount)}</td>
      <td className="px-2 py-1 text-right tabular-nums font-semibold text-slate-900">{won(l.amount)}</td>
      <td className="px-1 py-1 text-center">
        <button onClick={() => deleteRow(l.id)} className="text-slate-300 hover:text-red-500" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
      </td>
    </tr>
  );
}

/* ───────────────── 탭 2: 원가계산서 (제비율) ───────────────── */
function CostTab({ cost, jebi, margins, role, includeJebi, setIncludeJebi, updateJebi, setMargins, directTotal }: any) {
  const rateCls = "w-14 text-right text-[11px] border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">공사원가계산서 — 조달청 제비율 기준</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">소규모 인테리어 현장 기준 — 모든 요율 편집 가능. 인테리어는 대부분 <b>필수 아님</b>.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <span className={includeJebi ? "text-blue-600" : "text-gray-400"}>제비용(간접경비) 포함</span>
          <button onClick={() => setIncludeJebi(!includeJebi)} className={`w-10 h-5 rounded-full transition-colors relative ${includeJebi ? "bg-blue-600" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${includeJebi ? "left-5" : "left-0.5"}`} />
          </button>
        </label>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
              <th className="px-3 py-2 text-left font-semibold">비목</th>
              <th className="px-2 py-2 text-left font-semibold">산출기준</th>
              <th className="px-2 py-2 text-right font-semibold">기준금액</th>
              <th className="px-2 py-2 text-center font-semibold w-16">요율%</th>
              <th className="px-2 py-2 text-right font-semibold w-28">금액</th>
              <th className="px-2 py-2 text-center font-semibold w-12">포함</th>
              <th className="px-2 py-2 text-left font-semibold min-w-[160px]">비고 / {role === "bidder" ? "사업자 코멘트" : "코멘트"}</th>
            </tr>
          </thead>
          <tbody>
            {/* 직접비 */}
            <CostFixedRow label="직접재료비" amount={cost.directMaterial} bold />
            <CostFixedRow label="직접노무비" amount={cost.directLabor} bold />
            {/* 간접노무비 + 경비 */}
            {jebi.map((j: JebiItem) => {
              const row = j.group === "INDIRECT_LABOR" ? cost.indirectLaborRow : cost.expenseRows.find((r: any) => r.key === j.key);
              if (!row) return null;
              return (
                <tr key={j.key} className={`border-b border-slate-50 ${!row.included ? "opacity-40" : ""}`}>
                  <td className="px-3 py-1.5 text-slate-700">{j.label}{!j.required && <span className="ml-1 text-[9px] px-1 rounded bg-gray-100 text-gray-500">필수아님</span>}</td>
                  <td className="px-2 py-1.5 text-slate-400">{j.basisLabel}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{won(row.base)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <input type="number" step={0.01} value={j.rate} onChange={(e) => updateJebi(j.key, { rate: Number(e.target.value) || 0 })} className={rateCls} />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-800">{won(row.amount)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={j.include} onChange={(e) => updateJebi(j.key, { include: e.target.checked })} />
                  </td>
                  <td className="px-2 py-1.5">
                    {role === "bidder" ? (
                      <input value={j.comment} placeholder="코멘트 입력…" onChange={(e) => updateJebi(j.key, { comment: e.target.value })}
                        className="w-full text-[10px] border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    ) : (
                      <span className="text-[10px] text-slate-400">{j.note}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* 순공사원가 */}
            <CostFixedRow label="순공사원가 (재료+노무+경비)" amount={cost.netConstructionCost} strong />
            {/* 마진 */}
            <CostMarginRow label="일반관리비" basis="순공사원가 × 요율" amount={cost.generalAdmin} rate={margins.generalAdmin} onRate={(v: number) => setMargins({ ...margins, generalAdmin: v })} rateCls={rateCls} />
            <CostMarginRow label="이윤" basis="(노무+경비+관리비) × 요율" amount={cost.profit} rate={margins.profit} onRate={(v: number) => setMargins({ ...margins, profit: v })} rateCls={rateCls} />
            <CostFixedRow label="총원가" amount={cost.totalCost} strong />
            <CostMarginRow label="공사손해보험료" basis="총원가 × 요율" amount={cost.lossInsurance} rate={margins.lossInsurance} onRate={(v: number) => setMargins({ ...margins, lossInsurance: v })} rateCls={rateCls}
              checkbox={margins.lossInsuranceInclude} onCheck={(c: boolean) => setMargins({ ...margins, lossInsuranceInclude: c })} />
            <CostFixedRow label="공급가액" amount={cost.supplyPrice} strong />
            <CostMarginRow label="부가가치세" basis="공급가액 × 요율" amount={cost.vat} rate={margins.vat} onRate={(v: number) => setMargins({ ...margins, vat: v })} rateCls={rateCls} />
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 text-white">
              <td colSpan={4} className="px-3 py-2.5 font-bold">도급금액 (계약금액)</td>
              <td className="px-2 py-2.5 text-right text-base font-bold tabular-nums" colSpan={3}>{won(cost.contractPrice)}원</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-gray-400">
        ※ 기본 요율 = 조달청 2025 제비율. 인테리어 소규모 현장은 간접노무비·4대보험·산안비·환경보전비·퇴직공제 등이 <b>법적 필수가 아닌</b> 경우가 많아, 위 토글/체크로 제외하거나 사업자가 입찰 시 코멘트와 함께 조정합니다.
      </p>
    </div>
  );
}

function CostFixedRow({ label, amount, bold, strong }: { label: string; amount: number; bold?: boolean; strong?: boolean }) {
  return (
    <tr className={`border-b border-slate-100 ${strong ? "bg-slate-50 font-bold text-slate-800" : ""}`}>
      <td className={`px-3 py-1.5 ${bold ? "font-semibold text-slate-700" : ""}`}>{label}</td>
      <td colSpan={3}></td>
      <td className="px-2 py-1.5 text-right tabular-nums">{won(amount)}</td>
      <td colSpan={2}></td>
    </tr>
  );
}

function CostMarginRow({ label, basis, amount, rate, onRate, rateCls, checkbox, onCheck }: any) {
  return (
    <tr className="border-b border-slate-50">
      <td className="px-3 py-1.5 text-slate-700">{label}</td>
      <td className="px-2 py-1.5 text-slate-400">{basis}</td>
      <td></td>
      <td className="px-2 py-1.5 text-center">
        <input type="number" step={0.1} value={rate} onChange={(e) => onRate(Number(e.target.value) || 0)} className={rateCls} />
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-800">{won(amount)}</td>
      <td className="px-2 py-1.5 text-center">
        {onCheck !== undefined && <input type="checkbox" checked={checkbox} onChange={(e) => onCheck(e.target.checked)} />}
      </td>
      <td></td>
    </tr>
  );
}

/* ───────────────── 탭 3: 공정표 (막대그래프) ───────────────── */
function ScheduleTab({ schedule, targetDays, setTargetDays }: any) {
  const total = schedule.totalDays || 1;
  const ticks = Array.from({ length: Math.ceil(total / 5) + 1 }, (_, i) => i * 5);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">공정표 — 견적 기반 막대그래프</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">공종별 금액 비중으로 공기 자동 배분 · 총 {schedule.totalDays}일 ({Math.ceil(schedule.totalDays / 6)}주)</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          목표 공사일
          <input type="number" value={targetDays} min={10} max={120} onChange={(e) => setTargetDays(Math.max(5, Number(e.target.value) || 30))}
            className="w-16 text-right text-xs font-bold border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <span className="text-gray-400">일</span>
        </label>
      </div>

      {/* 눈금 */}
      <div className="flex items-center mb-1 pl-44">
        <div className="flex-1 relative h-4">
          {ticks.map((d) => (
            <span key={d} className="absolute text-[9px] text-slate-400 -translate-x-1/2" style={{ left: `${(d / total) * 100}%` }}>{d}일</span>
          ))}
        </div>
      </div>

      {/* 막대 */}
      <div className="space-y-1.5">
        {schedule.phases.map((p: any) => (
          <div key={p.key} className="flex items-center">
            <div className="w-44 flex-shrink-0 pr-2 text-[11px] text-slate-600 font-medium truncate" title={p.trades.join(", ")}>{p.name}</div>
            <div className="flex-1 relative h-6 bg-slate-50 rounded">
              {ticks.map((d) => (
                <span key={d} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: `${(d / total) * 100}%` }} />
              ))}
              <div className="absolute top-0.5 bottom-0.5 rounded flex items-center px-1.5 text-[9px] text-white font-medium overflow-hidden whitespace-nowrap"
                style={{ left: `${(p.startDay / total) * 100}%`, width: `${(p.durationDays / total) * 100}%`, backgroundColor: p.color }}
                title={`${p.name} · ${p.durationDays}일 · ${won(p.cost)}원`}>
                {p.durationDays}일
              </div>
            </div>
            <div className="w-24 flex-shrink-0 text-right text-[10px] text-slate-500 tabular-nums">{won(p.cost)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400">총 {schedule.phases.length}개 공정 · 순차 시공 기준(병행 시 단축 가능)</span>
        <span className="font-bold text-slate-700">총 공사비 {won(schedule.totalCost)}원</span>
      </div>
    </div>
  );
}

/* ───────────────── 1. 갑지 (표지) ───────────────── */
function CoverTab({ meta, setMeta, cost, category, area, lineCount, tradeCount }: any) {
  const fld = "w-full text-xs border-b border-slate-200 focus:border-blue-400 focus:outline-none py-1 bg-transparent";
  return (
    <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-8">
      <div className="text-center border-b-2 border-slate-800 pb-5 mb-6">
        <p className="text-xs tracking-[0.3em] text-amber-600 font-semibold">INPICK ESTIMATE</p>
        <h1 className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">견　적　서</h1>
        <p className="text-[11px] text-slate-400 mt-2">{category === "residential" ? "공동주택(아파트) 인테리어" : "상가·근린생활시설 인테리어"} · 전용 {area}㎡</p>
      </div>

      {/* 견적 금액 강조 */}
      <div className="bg-slate-800 text-white rounded-lg px-6 py-5 text-center mb-6">
        <p className="text-xs text-slate-400">견 적 금 액 (VAT 포함)</p>
        <p className="text-4xl font-bold tabular-nums mt-1">{won(cost.contractPrice)}<span className="text-lg font-normal text-slate-400 ml-1">원</span></p>
        <p className="text-[11px] text-slate-400 mt-1">금 {numToKorean(cost.contractPrice)}원정</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-xs">
        <Field label="공 사 명"><input className={fld} placeholder="○○아파트 84㎡ 인테리어" value={meta.projectName} onChange={(e) => setMeta({ ...meta, projectName: e.target.value })} /></Field>
        <Field label="견 적 일"><input className={fld} placeholder="2026-05-31" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} /></Field>
        <Field label="발주처 (갑)"><input className={fld} placeholder="고객명 / 상호" value={meta.client} onChange={(e) => setMeta({ ...meta, client: e.target.value })} /></Field>
        <Field label="시공사 (을)"><input className={fld} value={meta.vendor} onChange={(e) => setMeta({ ...meta, vendor: e.target.value })} /></Field>
      </div>

      {/* 금액 요약 */}
      <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden text-xs">
        <RowKV k="직접공사비 (재료+노무)" v={cost.directMaterial + cost.directLabor} />
        <RowKV k="제비 (간접노무+경비)" v={cost.indirectLabor + cost.expenseSubtotal} sub />
        <RowKV k="일반관리비 + 이윤" v={cost.generalAdmin + cost.profit} sub />
        <RowKV k="공급가액" v={cost.supplyPrice} />
        <RowKV k="부가가치세 (10%)" v={cost.vat} />
        <RowKV k="도급금액" v={cost.contractPrice} strong />
      </div>

      <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
        · 본 견적은 {tradeCount}개 공종 / {lineCount}개 항목 기준이며, 현장 실측 후 물량이 조정될 수 있습니다.<br />
        · 유효기간: 견적일로부터 30일. · 위 금액은 부가가치세를 포함합니다.
      </p>
      <div className="flex justify-end mt-6 gap-8 text-xs text-slate-400">
        <span>시공사: {meta.vendor} &nbsp;(인)</span>
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return (<div><p className="text-[10px] text-slate-400 mb-0.5">{label}</p>{children}</div>);
}
function RowKV({ k, v, strong, sub }: { k: string; v: number; strong?: boolean; sub?: boolean }) {
  return (
    <div className={`flex justify-between px-4 py-2 border-b border-slate-100 last:border-0 ${strong ? "bg-slate-800 text-white font-bold" : sub ? "bg-slate-50/50 text-slate-500" : ""}`}>
      <span className={sub ? "pl-3 text-[11px]" : ""}>{k}</span>
      <span className="tabular-nums">{won(v)}원</span>
    </div>
  );
}

// 간단 한글 금액 (억/만 단위)
function numToKorean(n: number): string {
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  const rest = n % 10000;
  let s = "";
  if (eok) s += `${eok}억 `;
  if (man) s += `${man.toLocaleString("ko-KR")}만 `;
  if (rest) s += `${rest}`;
  return s.trim() || "0";
}

/* ───────────────── 3. 총괄내역서 (공종별 집계표) ───────────────── */
function RollupTab({ sheet, cost }: any) {
  const directTotal = sheet.directTotal || 1;
  const indirect = cost.supplyPrice - sheet.directTotal; // 안분 대상(간접노무+경비+관리비+이윤)
  const rows = sheet.groups.map((g: any) => {
    const ratio = g.sum / directTotal;
    const exp = Math.round(indirect * ratio);
    const total = g.sum + exp;
    return { ...g, exp, total, share: total / cost.supplyPrice };
  });
  const maxShare = Math.max(...rows.map((r: any) => r.share), 0.01);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-900">총괄내역서 — 공종별 집계표</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">직접비 + 간접비(제비·관리비·이윤) 안분 · 구성비(공급가액 기준)</p>
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
            <th className="px-3 py-2 text-left font-semibold">공종</th>
            <th className="px-2 py-2 text-right font-semibold">재료비</th>
            <th className="px-2 py-2 text-right font-semibold">노무비</th>
            <th className="px-2 py-2 text-right font-semibold">경비(안분)</th>
            <th className="px-2 py-2 text-right font-semibold">합계</th>
            <th className="px-3 py-2 text-left font-semibold w-40">구성비</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.trade} className="border-b border-slate-50 hover:bg-blue-50/30">
              <td className="px-3 py-1.5 text-slate-700">{String(r.order).padStart(2, "0")}. {r.trade}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{won(r.matSum)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{won(r.labSum)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{won(r.exp)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-slate-900">{won(r.total)}</td>
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(r.share / maxShare) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 tabular-nums w-9 text-right">{(r.share * 100).toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
            <td className="px-3 py-2 text-slate-700">직접비 계</td>
            <td className="px-2 py-2 text-right tabular-nums">{won(sheet.directMaterial)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{won(sheet.directLabor)}</td>
            <td className="px-2 py-2 text-right tabular-nums text-slate-500">{won(indirect)}</td>
            <td className="px-2 py-2 text-right tabular-nums text-blue-700">{won(cost.supplyPrice)}</td>
            <td className="px-3 py-2 text-[10px] text-slate-400">공급가액</td>
          </tr>
          <tr className="bg-slate-800 text-white">
            <td colSpan={4} className="px-3 py-2.5 font-bold">도급금액 (VAT 포함)</td>
            <td colSpan={2} className="px-2 py-2.5 text-right text-base font-bold tabular-nums">{won(cost.contractPrice)}원</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ───────────────── 공통 UI ───────────────── */
function Sum({ label, v }: { label: string; v: number }) {
  return <div className="flex justify-between"><span className="text-slate-400">{label}</span><span className="tabular-nums">{won(v)}</span></div>;
}
function SegBtn({ active, onClick, icon, children }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
      {icon}{children}
    </button>
  );
}
function TabBtn({ active, onClick, icon, children }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${active ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
      {icon}{children}
    </button>
  );
}
function OptionToggle({ label, hint, on, onClick }: { label: string; hint: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${on ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
      <span className={`w-4 h-4 rounded flex items-center justify-center ${on ? "bg-white/20" : "border border-gray-300"}`}>{on && <Check className="w-3 h-3" />}</span>
      {label}<span className={on ? "text-blue-100" : "text-gray-400"}>{hint}</span>
    </button>
  );
}
