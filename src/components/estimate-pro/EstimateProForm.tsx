"use client";

// EstimateProForm — 오늘 만든 견적서 4문서 세트(+공정표) 재사용 컴포넌트.
// 파이프라인: 디자인 이미지 → Vision 분석 → build-estimate → constructionEstimateToDetailLines → 이 폼.
// props.lines(우리 DetailLine[])를 받아 갑지/총괄표/총괄내역서/세부내역서/공정표 렌더 + 편집/제비율.

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown, ChevronRight, TrendingDown, ImageIcon, Trash2,
  FileText, Receipt, CalendarRange, FileSignature, Layers,
  TriangleAlert, Pencil,
} from "lucide-react";
import { assembleSheet, assembleByRoom, type DetailLine } from "@/lib/estimate-pro/detail-model";
import {
  computeCostSheet, defaultJebiItems, defaultMarginRates,
  type JebiItem, type MarginRates,
} from "@/lib/estimate-pro/cost-model";
import { buildSchedule } from "@/lib/estimate-pro/schedule-model";
import { SITE_CONDITION_NOTICES } from "@/lib/inpick/estimate-v2/site-condition-pricing";

const won = (n: number) => Math.round(n || 0).toLocaleString("ko-KR");

// 견적 UI는 메인 서비스와 동일하게 흰색·검정·웜그레이만 사용한다.
const PART_BADGE = "bg-zinc-100 text-zinc-600";

type Row = DetailLine;

function recalc(r: Row): Row {
  const matAmount = Math.round(r.quantity * r.matUnit);
  const labAmount = Math.round(r.quantity * r.labUnit);
  return { ...r, matAmount, labAmount, amount: matAmount + labAmount };
}

export interface EstimateProFormProps {
  lines: DetailLine[];
  category?: "residential" | "commercial";
  projectName?: string;
  areaLabel?: string;          // 예: "전용 97.36㎡"
  /** 분석 안내(일부 표준값) 등 상단 배지 */
  visionBadge?: string;
}

export default function EstimateProForm({ lines, category = "residential", projectName, areaLabel, visionBadge }: EstimateProFormProps) {
  const [role, setRole] = useState<"owner" | "bidder">("owner");
  const [tab, setTab] = useState<"cover" | "summary" | "rollup" | "detail" | "schedule">("detail");
  const [includeJebi, setIncludeJebi] = useState(true);
  const [targetDays, setTargetDays] = useState(30);
  // 세부내역서 기본 전체 접힘 — 대분류·소계만 먼저 보이게 (모바일 시인성)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState({ projectName: projectName || "", client: "", vendor: "INPICK 제휴 시공사", date: "" });

  const [rows, setRows] = useState<Row[]>(lines);
  const [jebi, setJebi] = useState<JebiItem[]>(() => defaultJebiItems());
  const [margins, setMargins] = useState<MarginRates>(() => defaultMarginRates());
  const [groupBy, setGroupBy] = useState<"room" | "trade">("room"); // 세부내역서: 기본 실별×부위별

  // 견적(lines) 갱신 시 편집행 동기화
  useEffect(() => { setRows(lines); }, [lines]);
  useEffect(() => { if (projectName) setMeta((m) => ({ ...m, projectName })); }, [projectName]);

  // 공종별 집계(총괄내역서·공정표·원가용) + 세부내역서 표시 그룹(실별/공종별)
  const tradeSheet = useMemo(() => assembleSheet(rows), [rows]);
  const detailSheet = useMemo(() => (groupBy === "room" ? assembleByRoom(rows) : tradeSheet), [groupBy, rows, tradeSheet]);
  const sheet = tradeSheet;
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
  const toggleGroup = (t: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  // 공종별 선행공정 (공정표 순서 기반 — 견적에 있는 공종만)
  const precedingByTrade = useMemo(() => {
    const map: Record<string, string> = {};
    const phases = (schedule?.phases ?? []) as Array<{ name: string; trades: string[] }>;
    phases.forEach((p, i) => {
      const prior = phases.slice(0, i).map((x) => x.name);
      for (const t of p.trades) map[t] = prior.join(" → ");
    });
    return map;
  }, [schedule]);

  return (
    <div className="rounded-2xl bg-[#f4f4f2]">
      {/* 탭 + 역할 */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 rounded-t-2xl">
        <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
          {visionBadge && (
            <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] text-black/65">{visionBadge}</span>
          )}
          <div className="ml-auto flex items-center bg-gray-100 rounded-lg p-0.5">
            <Seg active={role === "owner"} onClick={() => setRole("owner")}>고객 보기</Seg>
            <Seg active={role === "bidder"} onClick={() => setRole("bidder")} icon={<Pencil className="w-3.5 h-3.5" />}>사업자 편집</Seg>
          </div>
        </div>
        <div className="px-4 flex gap-1 overflow-x-auto">
          <Tab active={tab === "cover"} onClick={() => setTab("cover")} icon={<FileSignature className="w-3.5 h-3.5" />}>1. 갑지</Tab>
          <Tab active={tab === "summary"} onClick={() => setTab("summary")} icon={<Receipt className="w-3.5 h-3.5" />}>2. 총괄표</Tab>
          <Tab active={tab === "rollup"} onClick={() => setTab("rollup")} icon={<Layers className="w-3.5 h-3.5" />}>3. 총괄내역서</Tab>
          <Tab active={tab === "detail"} onClick={() => setTab("detail")} icon={<FileText className="w-3.5 h-3.5" />}>4. 세부내역서</Tab>
          <Tab active={tab === "schedule"} onClick={() => setTab("schedule")} icon={<CalendarRange className="w-3.5 h-3.5" />}>공정표</Tab>
        </div>
      </div>

      <div className="p-4">
        <SiteConditionSummary rows={rows} role={role} />
        {tab === "cover" && <CoverTab meta={meta} setMeta={setMeta} cost={cost} category={category} areaLabel={areaLabel} lineCount={sheet.lineCount} tradeCount={sheet.groups.length} />}
        {tab === "summary" && <CostTab cost={cost} jebi={jebi} margins={margins} role={role} includeJebi={includeJebi} setIncludeJebi={setIncludeJebi} updateJebi={updateJebi} setMargins={setMargins} />}
        {tab === "rollup" && <RollupTab sheet={sheet} cost={cost} />}
        {tab === "detail" && <DetailTab sheet={detailSheet} groupBy={groupBy} setGroupBy={setGroupBy} expanded={expanded} toggleGroup={toggleGroup} updateRow={updateRow} deleteRow={deleteRow} precedingByTrade={precedingByTrade} role={role} />}
        {tab === "schedule" && <ScheduleTab schedule={schedule} targetDays={targetDays} setTargetDays={setTargetDays} />}
      </div>
    </div>
  );
}

function SiteConditionSummary({ rows, role }: { rows: Row[]; role: "owner" | "bidder" }) {
  const groups = [
    {
      key: "demolition",
      label: "철거·폐기",
      notice: SITE_CONDITION_NOTICES.demolition,
      matches: (row: Row) => row.trade.includes("철거") || row.trade.includes("폐기물"),
    },
    {
      key: "electrical",
      label: "전기",
      notice: SITE_CONDITION_NOTICES.electrical,
      matches: (row: Row) => row.trade.includes("전기"),
    },
    {
      key: "plumbing",
      label: "설비·배관",
      notice: SITE_CONDITION_NOTICES.plumbing,
      matches: (row: Row) => row.trade.includes("설비") || row.trade.includes("배관"),
    },
  ].map((group) => ({
    ...group,
    rows: rows.filter(group.matches),
    amount: rows.filter(group.matches).reduce((sum, row) => sum + row.amount, 0),
  })).filter((group) => group.rows.length > 0);

  if (groups.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">현장 확인 공종</h2>
              <p className="mt-0.5 text-[13px] leading-5 text-zinc-500">
                이미지·도면으로 확인하기 어려운 공종은 기본단가 가견적으로 먼저 반영했습니다.
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600">
              {role === "bidder" ? "사업자 수정 가능" : "현장 확인 후 확정"}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.key} className="rounded-lg bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-200/70">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-zinc-600">{group.label}</span>
                  <span className="text-xs text-zinc-400">{group.rows.length}건</span>
                </div>
                <p className="mt-1 text-sm font-black tabular-nums text-zinc-900">{won(group.amount)}원</p>
                <p className="mt-1 line-clamp-2 text-xs leading-4 text-zinc-400" title={group.notice}>
                  {group.notice}
                </p>
              </div>
            ))}
          </div>

          {role === "bidder" && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-zinc-600">
              <Pencil className="h-3 w-3" /> 세부내역서에서 현장 확인 수량·재료단가·노무단가를 수정하면 합계가 즉시 재계산됩니다.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* 1. 갑지 */
function CoverTab({ meta, setMeta, cost, category, areaLabel, lineCount, tradeCount }: any) {
  const fld = "w-full text-xs border-b border-slate-200 focus:border-black focus:outline-none py-1 bg-transparent";
  return (
    <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-8">
      <div className="text-center border-b-2 border-slate-800 pb-5 mb-6">
        <p className="text-xs font-semibold tracking-[0.3em] text-black/55">INPICK ESTIMATE</p>
        <h1 className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">견　적　서</h1>
        <p className="text-[11px] text-slate-400 mt-2">{category === "residential" ? "공동주택(아파트) 인테리어" : "상가·근린생활시설 인테리어"}{areaLabel ? ` · ${areaLabel}` : ""}</p>
      </div>
      <div className="bg-slate-800 text-white rounded-lg px-6 py-5 text-center mb-6">
        <p className="text-xs text-slate-400">견 적 금 액 (VAT 포함)</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-white">{won(cost.contractPrice)}<span className="ml-1 text-lg font-normal text-white/55">원</span></p>
        <p className="text-[11px] text-slate-400 mt-1">금 {numToKorean(cost.contractPrice)}원정</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-xs">
        <Field label="공 사 명"><input className={fld} placeholder="○○아파트 인테리어" value={meta.projectName} onChange={(e) => setMeta({ ...meta, projectName: e.target.value })} /></Field>
        <Field label="견 적 일"><input className={fld} placeholder="2026-05-31" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} /></Field>
        <Field label="발주처 (갑)"><input className={fld} placeholder="고객명 / 상호" value={meta.client} onChange={(e) => setMeta({ ...meta, client: e.target.value })} /></Field>
        <Field label="시공사 (을)"><input className={fld} value={meta.vendor} onChange={(e) => setMeta({ ...meta, vendor: e.target.value })} /></Field>
      </div>
      <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden text-xs">
        <RowKV k="직접공사비 (재료+노무)" v={cost.directMaterial + cost.directLabor} />
        <RowKV k="제비 (간접노무+경비)" v={cost.indirectLabor + cost.expenseSubtotal} sub />
        <RowKV k="일반관리비 + 이윤" v={cost.generalAdmin + cost.profit} sub />
        <RowKV k="공급가액" v={cost.supplyPrice} />
        <RowKV k="부가가치세 (10%)" v={cost.vat} />
        <RowKV k="도급금액" v={cost.contractPrice} strong />
      </div>
      <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
        · 본 견적은 {tradeCount}개 공종 / {lineCount}개 항목 · 생성 디자인의 Vision 분석 기반입니다. 현장 실측 후 물량이 조정될 수 있습니다.<br />
        · 철거·전기·설비 금액은 현장 확인 전 기본단가 가견적이며, 현장 상태 확인 후 사업자가 수정·확정합니다.<br />
        · 유효기간: 견적일로부터 30일. · 위 금액은 부가가치세를 포함합니다.
      </p>
    </div>
  );
}
function Field({ label, children }: any) { return (<div><p className="text-[10px] text-slate-400 mb-0.5">{label}</p>{children}</div>); }
function RowKV({ k, v, strong, sub }: { k: string; v: number; strong?: boolean; sub?: boolean }) {
  return (
    <div className={`flex justify-between px-4 py-2 border-b border-slate-100 last:border-0 ${strong ? "bg-slate-800 text-white font-bold" : sub ? "bg-slate-50/50 text-slate-500" : ""}`}>
      <span className={sub ? "pl-3 text-[11px]" : ""}>{k}</span><span className={`tabular-nums ${strong ? "text-white" : ""}`}>{won(v)}원</span>
    </div>
  );
}
function numToKorean(n: number): string {
  const eok = Math.floor(n / 100000000); const man = Math.floor((n % 100000000) / 10000); const rest = n % 10000;
  let s = ""; if (eok) s += `${eok}억 `; if (man) s += `${man.toLocaleString("ko-KR")}만 `; if (rest) s += `${rest}`;
  return s.trim() || "0";
}

/* 2. 총괄표 (원가계산서) */
function CostTab({ cost, jebi, margins, role, includeJebi, setIncludeJebi, updateJebi, setMargins }: any) {
  const rateCls = "w-16 text-right text-[13px] border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-black tabular-nums";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">공사원가계산서 — 조달청 제비율 기준</h2>
          <p className="text-[13px] text-gray-400 mt-0.5">소규모 인테리어 현장 기준 — 모든 요율 편집 가능. 인테리어는 대부분 <b>필수 아님</b>.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <span className={includeJebi ? "text-black" : "text-gray-400"}>제비용 포함</span>
          <button onClick={() => setIncludeJebi(!includeJebi)} className={`w-10 h-5 rounded-full relative ${includeJebi ? "bg-black" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${includeJebi ? "left-5" : "left-0.5"}`} />
          </button>
        </label>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
              <th className="px-3 py-2 text-left font-semibold">비목</th>
              <th className="px-2 py-2 text-left font-semibold">산출기준</th>
              <th className="px-2 py-2 text-right font-semibold">기준금액</th>
              <th className="px-2 py-2 text-center font-semibold w-16">요율%</th>
              <th className="px-2 py-2 text-right font-semibold w-28">금액</th>
              <th className="px-2 py-2 text-center font-semibold w-12">포함</th>
              <th className="px-2 py-2 text-left font-semibold min-w-[150px]">비고 / {role === "bidder" ? "사업자 코멘트" : "코멘트"}</th>
            </tr>
          </thead>
          <tbody>
            <Fixed label="직접재료비" amount={cost.directMaterial} bold />
            <Fixed label="직접노무비" amount={cost.directLabor} bold />
            {jebi.map((j: JebiItem) => {
              const row = j.group === "INDIRECT_LABOR" ? cost.indirectLaborRow : cost.expenseRows.find((r: any) => r.key === j.key);
              if (!row) return null;
              return (
                <tr key={j.key} className={`border-b border-slate-50 ${!row.included ? "opacity-40" : ""}`}>
                  <td className="px-3 py-1.5 text-slate-700">{j.label}{!j.required && <span className="ml-1 text-[9px] px-1 rounded bg-gray-100 text-gray-500">필수아님</span>}</td>
                  <td className="px-2 py-1.5 text-slate-400">{j.basisLabel}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{won(row.base)}</td>
                  <td className="px-2 py-1.5 text-center"><input type="number" step={0.01} value={j.rate} onChange={(e) => updateJebi(j.key, { rate: Number(e.target.value) || 0 })} className={rateCls} /></td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-800">{won(row.amount)}</td>
                  <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={j.include} onChange={(e) => updateJebi(j.key, { include: e.target.checked })} /></td>
                  <td className="px-2 py-1.5">{role === "bidder" ? (
                    <input value={j.comment} placeholder="코멘트…" onChange={(e) => updateJebi(j.key, { comment: e.target.value })} className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black" />
                  ) : (<span className="text-xs text-slate-400">{j.note}</span>)}</td>
                </tr>
              );
            })}
            <Fixed label="순공사원가 (재료+노무+경비)" amount={cost.netConstructionCost} strong />
            <Margin label="일반관리비" basis="순공사원가 × 요율" amount={cost.generalAdmin} rate={margins.generalAdmin} onRate={(v: number) => setMargins({ ...margins, generalAdmin: v })} rateCls={rateCls} />
            <Margin label="이윤" basis="(노무+경비+관리비) × 요율" amount={cost.profit} rate={margins.profit} onRate={(v: number) => setMargins({ ...margins, profit: v })} rateCls={rateCls} />
            <Fixed label="총원가" amount={cost.totalCost} strong />
            <Margin label="공사손해보험료" basis="총원가 × 요율" amount={cost.lossInsurance} rate={margins.lossInsurance} onRate={(v: number) => setMargins({ ...margins, lossInsurance: v })} rateCls={rateCls} checkbox={margins.lossInsuranceInclude} onCheck={(c: boolean) => setMargins({ ...margins, lossInsuranceInclude: c })} />
            <Fixed label="공급가액" amount={cost.supplyPrice} strong />
            <Margin label="부가가치세" basis="공급가액 × 요율" amount={cost.vat} rate={margins.vat} onRate={(v: number) => setMargins({ ...margins, vat: v })} rateCls={rateCls} />
          </tbody>
          <tfoot><tr className="bg-slate-800 text-white"><td colSpan={4} className="px-3 py-2.5 font-bold">도급금액 (계약금액)</td><td colSpan={3} className="px-2 py-2.5 text-right text-base font-bold tabular-nums text-white">{won(cost.contractPrice)}원</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}
function Fixed({ label, amount, bold, strong }: any) {
  return (<tr className={`border-b border-slate-100 ${strong ? "bg-slate-50 font-bold text-slate-800" : ""}`}><td className={`px-3 py-1.5 ${bold ? "font-semibold text-slate-700" : ""}`}>{label}</td><td colSpan={3}></td><td className="px-2 py-1.5 text-right tabular-nums">{won(amount)}</td><td colSpan={2}></td></tr>);
}
function Margin({ label, basis, amount, rate, onRate, rateCls, checkbox, onCheck }: any) {
  return (<tr className="border-b border-slate-50"><td className="px-3 py-1.5 text-slate-700">{label}</td><td className="px-2 py-1.5 text-slate-400">{basis}</td><td></td><td className="px-2 py-1.5 text-center"><input type="number" step={0.1} value={rate} onChange={(e) => onRate(Number(e.target.value) || 0)} className={rateCls} /></td><td className="px-2 py-1.5 text-right tabular-nums text-slate-800">{won(amount)}</td><td className="px-2 py-1.5 text-center">{onCheck !== undefined && <input type="checkbox" checked={checkbox} onChange={(e) => onCheck(e.target.checked)} />}</td><td></td></tr>);
}

/* 3. 총괄내역서 */
function RollupTab({ sheet, cost }: any) {
  const directTotal = sheet.directTotal || 1;
  const indirect = cost.supplyPrice - sheet.directTotal;
  const rows = sheet.groups.map((g: any) => { const ratio = g.sum / directTotal; const exp = Math.round(indirect * ratio); const total = g.sum + exp; return { ...g, exp, total, share: total / (cost.supplyPrice || 1) }; });
  const maxShare = Math.max(...rows.map((r: any) => r.share), 0.01);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
      <div className="px-4 py-3 border-b border-gray-200"><h2 className="text-base font-bold text-gray-900">총괄내역서 — 공종별 집계표</h2><p className="text-[13px] text-gray-400 mt-0.5">직접비 + 간접비 안분 · 구성비(공급가액 기준)</p></div>
      <table className="w-full text-[13px]">
        <thead><tr className="bg-slate-100 text-slate-600 border-b border-slate-200"><th className="px-3 py-2 text-left font-semibold">공종</th><th className="px-2 py-2 text-right font-semibold">재료비</th><th className="px-2 py-2 text-right font-semibold">노무비</th><th className="px-2 py-2 text-right font-semibold">경비(안분)</th><th className="px-2 py-2 text-right font-semibold">합계</th><th className="px-3 py-2 text-left font-semibold w-40">구성비</th></tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.trade} className="border-b border-slate-50 hover:bg-black/[0.025]">
              <td className="px-3 py-1.5 text-slate-700">{String(r.order).padStart(2, "0")}. {r.trade}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{won(r.matSum)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{won(r.labSum)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{won(r.exp)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-slate-900">{won(r.total)}</td>
              <td className="px-3 py-1.5"><div className="flex items-center gap-2"><div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-black rounded-full" style={{ width: `${(r.share / maxShare) * 100}%` }} /></div><span className="text-xs text-slate-400 tabular-nums w-10 text-right">{(r.share * 100).toFixed(1)}%</span></div></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-bold border-t-2 border-slate-200"><td className="px-3 py-2 text-slate-700">직접비 계</td><td className="px-2 py-2 text-right tabular-nums">{won(sheet.directMaterial)}</td><td className="px-2 py-2 text-right tabular-nums">{won(sheet.directLabor)}</td><td className="px-2 py-2 text-right tabular-nums text-slate-500">{won(indirect)}</td><td className="px-2 py-2 text-right tabular-nums text-black">{won(cost.supplyPrice)}</td><td className="px-3 py-2 text-xs text-slate-400">공급가액</td></tr>
          <tr className="bg-slate-800 text-white"><td colSpan={4} className="px-3 py-2.5 font-bold">도급금액 (VAT 포함)</td><td colSpan={2} className="px-2 py-2.5 text-right text-base font-bold tabular-nums">{won(cost.contractPrice)}원</td></tr>
        </tfoot>
      </table>
    </div>
  );
}

/* 4. 세부내역서 (편집) */
function DetailTab({ sheet, groupBy, setGroupBy, expanded, toggleGroup, updateRow, deleteRow, precedingByTrade, role }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-gray-900">세부내역서 — {groupBy === "room" ? "실별 × 부위별" : "공종별"}</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setGroupBy("room")} className={`px-3 py-1.5 rounded-md text-xs font-bold ${groupBy === "room" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>실별</button>
            <button onClick={() => setGroupBy("trade")} className={`px-3 py-1.5 rounded-md text-xs font-bold ${groupBy === "trade" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>공종별</button>
          </div>
          <span className="text-[13px] text-gray-400 hidden sm:inline">
            {role === "bidder" ? "수량과 단가를 현장 확인값으로 수정할 수 있습니다" : "사업자 편집에서 현장 확인값을 조정할 수 있습니다"}
          </span>
        </div>
      </div>
      {sheet.groups.map((g: any) => {
        const open = expanded.has(g.trade);
        const preceding = precedingByTrade?.[g.trade];
        return (
          <div key={g.trade} className="border-b border-zinc-100 last:border-0">
            {/* 대분류와 소계 모두 무채색으로 표시 */}
            <button onClick={() => toggleGroup(g.trade)} className="w-full flex items-center justify-between gap-2 px-4 py-3.5 bg-zinc-100 hover:bg-zinc-200/70 transition-colors">
              <div className="flex min-w-0 items-center gap-2">
                {open ? <ChevronDown className="w-4 h-4 shrink-0 text-zinc-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-zinc-400" />}
                <span className="truncate text-sm font-bold text-zinc-700">{String(g.order).padStart(2, "0")}. {g.trade}</span>
                <span className="shrink-0 text-sm text-zinc-400">{g.lines.length}건</span>
              </div>
              <span className="shrink-0 text-sm font-bold text-black tabular-nums">{won(g.sum)}원</span>
            </button>
            {open && (
              <>
                {preceding && (
                  <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-sm text-zinc-500">
                    <span className="font-bold text-zinc-600">선행 공정</span> {preceding} <span className="text-zinc-400">→ 완료 후 착수</span>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="bg-white border-b border-zinc-200 text-zinc-500">
                      <th className="px-2 py-2 text-center font-semibold w-14">부위</th>
                      <th className="px-2 py-2 text-left font-semibold min-w-[160px]">품명 / 자재</th>
                      <th className="px-2 py-2 text-left font-semibold min-w-[110px]">규격</th>
                      <th className="px-2 py-2 text-center font-semibold w-9">단위</th>
                      <th className="px-2 py-2 text-right font-semibold w-16">수량</th>
                      <th className="px-2 py-2 text-right font-semibold w-20">재료단가</th>
                      <th className="px-2 py-2 text-right font-semibold w-24">재료금액</th>
                      <th className="px-2 py-2 text-right font-semibold w-20">노무단가</th>
                      <th className="px-2 py-2 text-right font-semibold w-24">노무금액</th>
                      <th className="px-2 py-2 text-right font-semibold w-28">합계</th><th className="w-8"></th>
                    </tr></thead>
                    <tbody>
                      {g.lines.map((l: Row) => (<EditRow key={l.id} l={l} updateRow={updateRow} deleteRow={deleteRow} role={role} />))}
                      <tr className="bg-zinc-50 border-t border-zinc-200"><td colSpan={6} className="px-2 py-2 text-right font-bold text-zinc-500">소계</td><td className="px-2 py-2 text-right tabular-nums font-bold text-zinc-600">{won(g.matSum)}</td><td></td><td className="px-2 py-2 text-right tabular-nums font-bold text-zinc-600">{won(g.labSum)}</td><td className="px-2 py-2 text-right tabular-nums font-bold text-black">{won(g.sum)}</td><td></td></tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}
      <div className="bg-zinc-900 text-white px-4 py-3.5 flex items-center justify-between"><span className="text-sm font-bold">직접공사비 합계</span><span className="text-lg font-bold tabular-nums text-white">{won(sheet.directTotal)}원</span></div>
    </div>
  );
}
function EditRow({ l, updateRow, deleteRow, role }: { l: Row; updateRow: any; deleteRow: any; role: "owner" | "bidder" }) {
  const hasMat = l.brand !== "-";
  const editable = role === "bidder";
  const numCls = "w-full text-right text-sm bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent hover:border-zinc-200 focus:border-zinc-400 rounded px-1 py-1 focus:outline-none tabular-nums";
  return (
    <tr className="border-b border-zinc-50 hover:bg-zinc-50/60">
      <td className="px-2 py-2 text-center"><span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${PART_BADGE}`}>{l.part}</span></td>
      <td className="px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-zinc-800">{l.itemName}</span>
          {l.siteVerificationRequired && (
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600 ring-1 ring-zinc-200">
              기본단가 · 현장확인
            </span>
          )}
        </div>
        {l.variationNotice && (
          <p
            className="mt-0.5 max-w-md text-xs leading-4 text-zinc-400"
            title={(l.siteAdjustmentFactors || []).join(" · ")}
          >
            {l.variationNotice}
          </p>
        )}
        {l.siteConditionAdjustmentReason && (
          <p className="mt-0.5 text-xs font-semibold text-zinc-600">
            사용자 조건 반영 · {l.siteConditionAdjustmentReason}
            {l.siteConditionAdjustmentFactor != null && ` · ×${l.siteConditionAdjustmentFactor.toFixed(2)}`}
          </p>
        )}
        {hasMat && (
          <div className="relative inline-block group mt-0.5">
            <span className="text-[13px] text-zinc-500 border-b border-dotted border-zinc-300 cursor-help">{l.brand} · {l.product}</span>
            <div className="hidden group-hover:block absolute left-0 top-full mt-1 z-40 w-64 bg-white border border-zinc-200 rounded-lg shadow-xl p-3">
              <div className="flex items-start gap-2"><div className="w-14 h-14 rounded-md bg-zinc-100 flex items-center justify-center flex-shrink-0"><ImageIcon className="w-5 h-5 text-zinc-300" /></div><div className="min-w-0"><p className="text-xs font-bold text-zinc-800">{l.brand}</p><p className="text-xs text-zinc-600 leading-tight">{l.product}</p><p className="text-[11px] text-zinc-400 mt-0.5">규격 {l.spec}</p></div></div>
              {l.priceBand && <p className="text-[11px] text-zinc-600 mt-2 font-medium">금액대 · {l.priceBand}</p>}
              {l.imageHint && <p className="text-[11px] text-zinc-500 mt-0.5">이미지 구현 · {l.imageHint}</p>}
            </div>
          </div>
        )}
      </td>
      <td className="px-2 py-1.5 text-zinc-500">{l.spec}</td>
      <td className="px-2 py-1.5 text-center text-zinc-500">{l.unit}</td>
      <td className="px-1 py-1.5">{editable ? <input aria-label={`${l.itemName} 수량`} type="number" value={l.quantity} onChange={(e) => updateRow(l.id, { quantity: Number(e.target.value) || 0 })} className={numCls} /> : <span className="block px-1 text-right tabular-nums text-zinc-600">{l.quantity}</span>}</td>
      <td className="px-1 py-1.5">{editable ? <input aria-label={`${l.itemName} 재료단가`} type="number" value={l.matUnit} onChange={(e) => updateRow(l.id, { matUnit: Number(e.target.value) || 0 })} className={numCls} /> : <span className="block px-1 text-right tabular-nums text-zinc-600">{won(l.matUnit)}</span>}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-700">{won(l.matAmount)}</td>
      <td className="px-1 py-1.5"><div className="flex items-center">{l.labWas && <span title={`보정 ${won(l.labWas)}→${won(l.labUnit)}`}><TrendingDown className="w-3 h-3 text-zinc-400 flex-shrink-0" /></span>}{editable ? <input aria-label={`${l.itemName} 노무단가`} type="number" value={l.labUnit} onChange={(e) => updateRow(l.id, { labUnit: Number(e.target.value) || 0 })} className={numCls} /> : <span className="block w-full px-1 text-right tabular-nums text-zinc-600">{won(l.labUnit)}</span>}</div></td>
      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-700">{won(l.labAmount)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-zinc-900">{won(l.amount)}</td>
      <td className="px-1 py-1.5 text-center">{editable && <button onClick={() => deleteRow(l.id)} className="text-zinc-300 hover:text-black" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
    </tr>
  );
}

/* 공정표 */
function ScheduleTab({ schedule, targetDays, setTargetDays }: any) {
  const total = schedule.totalDays || 1;
  const ticks = Array.from({ length: Math.ceil(total / 5) + 1 }, (_, i) => i * 5);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-base font-bold text-gray-900">공정표 — 견적 기반 막대그래프</h2><p className="text-[13px] text-gray-400 mt-0.5">공종별 금액 비중으로 공기 자동 배분 · 총 {schedule.totalDays}일</p></div>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">목표 공사일<input type="number" value={targetDays} min={10} max={120} onChange={(e) => setTargetDays(Math.max(5, Number(e.target.value) || 30))} className="w-16 text-right text-sm font-bold border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-black" /><span className="text-gray-400">일</span></label>
      </div>
      <div className="flex items-center mb-1 pl-44"><div className="flex-1 relative h-4">{ticks.map((d) => (<span key={d} className="absolute text-[11px] text-slate-400 -translate-x-1/2" style={{ left: `${(d / total) * 100}%` }}>{d}일</span>))}</div></div>
      <div className="space-y-1.5">
        {schedule.phases.map((p: any) => (
          <div key={p.key} className="flex items-center">
            <div className="w-44 flex-shrink-0 pr-2 text-[13px] text-slate-600 font-medium truncate" title={p.trades.join(", ")}>{p.name}</div>
            <div className="flex-1 relative h-6 bg-slate-50 rounded">
              {ticks.map((d) => (<span key={d} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: `${(d / total) * 100}%` }} />))}
              <div className="absolute top-0.5 bottom-0.5 rounded flex items-center px-1.5 text-[11px] text-white font-medium overflow-hidden whitespace-nowrap" style={{ left: `${(p.startDay / total) * 100}%`, width: `${(p.durationDays / total) * 100}%`, backgroundColor: "#111111" }} title={`${p.name} · ${p.durationDays}일 · ${won(p.cost)}원`}>{p.durationDays}일</div>
            </div>
            <div className="w-24 flex-shrink-0 text-right text-xs text-slate-500 tabular-nums">{won(p.cost)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[13px]"><span className="text-slate-400">총 {schedule.phases.length}개 공정 · 순차 시공 기준</span><span className="font-bold text-slate-700">총 공사비 {won(schedule.totalCost)}원</span></div>
    </div>
  );
}

/* 공통 */
function Seg({ active, onClick, icon, children }: any) {
  return (<button onClick={onClick} className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{icon}{children}</button>);
}
function Tab({ active, onClick, icon, children }: any) {
  return (<button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${active ? "border-black text-black" : "border-transparent text-gray-400 hover:text-gray-600"}`}>{icon}{children}</button>);
}
