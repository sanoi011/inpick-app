"use client";

// EstimateProForm — 오늘 만든 견적서 4문서 세트(+공정표) 재사용 컴포넌트.
// 파이프라인: 디자인 이미지 → Vision 분석 → build-estimate → constructionEstimateToDetailLines → 이 폼.
// props.lines(우리 DetailLine[])를 받아 갑지/총괄표/총괄내역서/세부내역서/공정표 렌더 + 편집/제비율.

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown, ChevronRight, TrendingDown, ImageIcon, Trash2,
  FileText, Receipt, CalendarRange, FileSignature, Layers,
  TriangleAlert, Pencil, RotateCcw,
} from "lucide-react";
import { assembleSheet, assembleByRoom, type DetailLine } from "@/lib/estimate-pro/detail-model";
import {
  computeCostSheet, defaultJebiItems, defaultMarginRates,
  type JebiItem, type MarginRates,
} from "@/lib/estimate-pro/cost-model";
import {
  buildSchedule,
  type PhaseBar,
  type ScheduleResult,
} from "@/lib/estimate-pro/schedule-model";
import { SITE_CONDITION_NOTICES } from "@/lib/inpick/estimate-v2/site-condition-pricing";

const won = (n: number) => Math.round(n || 0).toLocaleString("ko-KR");

// 견적 UI는 메인 서비스와 동일하게 흰색·검정·웜그레이만 사용한다.
const PART_BADGE = "bg-zinc-100 text-zinc-600";

type Row = DetailLine;

function recalc(r: Row): Row {
  const matAmount = Math.round(r.quantity * r.matUnit);
  const labAmount = Math.round(r.quantity * r.labUnit);
  const expenseAmount = Math.round(r.quantity * r.expenseUnit);
  return {
    ...r,
    matAmount,
    labAmount,
    expenseAmount,
    amount: matAmount + labAmount + expenseAmount,
  };
}

function applyScheduleOverrides(
  base: ScheduleResult,
  overrides: Record<string, EstimateScheduleOverride>,
): ScheduleResult {
  let cursor = 0;
  const phases = base.phases.map((phase) => {
    const override = overrides[phase.key] || {};
    const startDay =
      override.startDay == null
        ? cursor
        : Math.max(0, Math.round(override.startDay));
    const durationDays =
      override.durationDays == null
        ? phase.durationDays
        : Math.max(1, Math.round(override.durationDays));
    cursor = Math.max(cursor, startDay + durationDays);
    return {
      ...phase,
      startDay,
      durationDays,
      qualityHoldDays:
        durationDays === phase.durationDays ? phase.qualityHoldDays : 0,
      basis:
        durationDays === phase.durationDays &&
        startDay === phase.startDay
          ? phase.basis
          : `${phase.basis} · 사업자 조정`,
    };
  });
  return {
    ...base,
    phases,
    totalDays: phases.reduce(
      (maximum, phase) =>
        Math.max(maximum, phase.startDay + phase.durationDays),
      0,
    ),
  };
}

export type EstimateProTab =
  | "cover"
  | "summary"
  | "rollup"
  | "detail"
  | "schedule";

export interface EstimateScheduleOverride {
  startDay?: number;
  durationDays?: number;
}

export interface EstimateBidDraft {
  lines: DetailLine[];
  schedule: ScheduleResult;
  directTotal: number;
  contractPrice: number;
}

export interface EstimateProFormProps {
  lines: DetailLine[];
  category?: "residential" | "commercial";
  projectName?: string;
  areaLabel?: string;          // 예: "전용 97.36㎡"
  /** 분석 안내(일부 표준값) 등 상단 배지 */
  visionBadge?: string;
  /** 로컬 샘플·검수 화면에서 처음부터 열어둘 실/공종 */
  initialExpandedGroups?: string[];
  /** 정식 견적서는 갑지부터 시작하고, 특정 검수 화면만 다른 탭을 지정한다. */
  initialTab?: EstimateProTab;
  documentNo?: string;
  clientName?: string;
  vendorName?: string;
  estimateDate?: string;
  siteAddress?: string;
  validUntil?: string;
  expectedPeriodDays?: number;
  /** 사업자 입찰 화면은 bidder로 고정하고 역할 전환을 숨긴다. */
  initialRole?: "owner" | "bidder";
  allowRoleSwitch?: boolean;
  initialGroupBy?: "room" | "trade";
  /** 입찰 제출 metadata에 수정 내역·공정표를 보존하기 위한 draft 콜백 */
  onBidDraftChange?: (draft: EstimateBidDraft) => void;
}

export default function EstimateProForm({
  lines,
  category = "residential",
  projectName,
  areaLabel,
  visionBadge,
  initialExpandedGroups = [],
  initialTab = "cover",
  documentNo = "",
  clientName = "",
  vendorName = "INPICK 제휴 시공사",
  estimateDate = "",
  siteAddress = "",
  validUntil = "",
  expectedPeriodDays = 0,
  initialRole = "owner",
  allowRoleSwitch = true,
  initialGroupBy = "room",
  onBidDraftChange,
}: EstimateProFormProps) {
  const [role, setRole] = useState<"owner" | "bidder">(initialRole);
  const [tab, setTab] = useState<EstimateProTab>(initialTab);
  // 민간 소규모 인테리어 견적의 기본값. 공공공사 제비율은 사업자가 필요할 때 켠다.
  const [includeJebi, setIncludeJebi] = useState(false);
  const [scheduleOverrides, setScheduleOverrides] = useState<
    Record<string, EstimateScheduleOverride>
  >({});
  // 세부내역서 기본 전체 접힘 — 대분류·소계만 먼저 보이게 (모바일 시인성)
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialExpandedGroups),
  );
  const [meta, setMeta] = useState({
    documentNo,
    projectName: projectName || "",
    siteAddress,
    client: clientName,
    vendor: vendorName,
    date: estimateDate,
    validUntil,
    expectedPeriodDays,
  });

  const [rows, setRows] = useState<Row[]>(lines);
  const [jebi, setJebi] = useState<JebiItem[]>(() => defaultJebiItems());
  const [margins, setMargins] = useState<MarginRates>(() => defaultMarginRates());
  const [groupBy, setGroupBy] = useState<"room" | "trade">(initialGroupBy);

  // 견적(lines) 갱신 시 편집행 동기화
  useEffect(() => { setRows(lines); }, [lines]);
  useEffect(() => { if (projectName) setMeta((m) => ({ ...m, projectName })); }, [projectName]);

  // 공종별 집계(총괄내역서·공정표·원가용) + 세부내역서 표시 그룹(실별/공종별)
  const tradeSheet = useMemo(() => assembleSheet(rows), [rows]);
  const detailSheet = useMemo(() => (groupBy === "room" ? assembleByRoom(rows) : tradeSheet), [groupBy, rows, tradeSheet]);
  const sheet = tradeSheet;
  const cost = useMemo(
    () => computeCostSheet({
      directMaterial: sheet.directMaterial,
      directLabor: sheet.directLabor,
      directExpense: sheet.directExpense,
      jebi,
      margins,
      includeJebi,
    }),
    [
      sheet.directMaterial,
      sheet.directLabor,
      sheet.directExpense,
      jebi,
      margins,
      includeJebi,
    ]
  );
  const baseSchedule = useMemo(() => buildSchedule(sheet.groups), [sheet.groups]);
  const schedule = useMemo(
    () => applyScheduleOverrides(baseSchedule, scheduleOverrides),
    [baseSchedule, scheduleOverrides],
  );

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
  const updateSchedulePhase = (
    key: string,
    patch: EstimateScheduleOverride,
  ) =>
    setScheduleOverrides((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));

  useEffect(() => {
    if (!schedule.totalDays) return;
    setMeta((current) =>
      current.expectedPeriodDays === schedule.totalDays
        ? current
        : { ...current, expectedPeriodDays: schedule.totalDays },
    );
  }, [schedule.totalDays]);

  useEffect(() => {
    if (!onBidDraftChange) return;
    onBidDraftChange({
      lines: rows,
      schedule,
      directTotal: sheet.directTotal,
      contractPrice: cost.contractPrice,
    });
  }, [
    cost.contractPrice,
    onBidDraftChange,
    rows,
    schedule,
    sheet.directTotal,
  ]);

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
          {allowRoleSwitch ? (
            <div className="ml-auto flex items-center bg-gray-100 rounded-lg p-0.5">
              <Seg active={role === "owner"} onClick={() => setRole("owner")}>고객 보기</Seg>
              <Seg active={role === "bidder"} onClick={() => setRole("bidder")} icon={<Pencil className="w-3.5 h-3.5" />}>사업자 편집</Seg>
            </div>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 ring-1 ring-blue-100">
              <Pencil className="h-3 w-3" />
              입찰용 편집
            </span>
          )}
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
        {tab === "cover" && <CoverTab meta={meta} setMeta={setMeta} cost={cost} category={category} areaLabel={areaLabel} lineCount={sheet.lineCount} tradeCount={sheet.groups.length} />}
        {tab === "summary" && <CostTab cost={cost} jebi={jebi} margins={margins} role={role} includeJebi={includeJebi} setIncludeJebi={setIncludeJebi} updateJebi={updateJebi} setMargins={setMargins} />}
        {tab === "rollup" && <RollupTab sheet={sheet} cost={cost} />}
        {tab === "detail" && (
          <>
            <SiteConditionSummary rows={rows} role={role} />
            <DetailTab sheet={detailSheet} groupBy={groupBy} setGroupBy={setGroupBy} expanded={expanded} toggleGroup={toggleGroup} updateRow={updateRow} deleteRow={deleteRow} precedingByTrade={precedingByTrade} role={role} />
          </>
        )}
        {tab === "schedule" && (
          <ScheduleTab
            schedule={schedule}
            role={role}
            edited={Object.keys(scheduleOverrides).length > 0}
            updateSchedulePhase={updateSchedulePhase}
            resetSchedule={() => setScheduleOverrides({})}
          />
        )}
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
  const totalRows = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const totalAmount = groups.reduce((sum, group) => sum + group.amount, 0);

  return (
    <details className="group mb-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 marker:content-none hover:bg-zinc-50">
        <div className="flex min-w-0 items-center gap-2.5">
          <TriangleAlert className="h-4 w-4 shrink-0 text-zinc-600" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900">
              현장 확인 가정 및 변동 조건
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              철거·전기·설비 {totalRows}건 · 기본단가 가견적 {won(totalAmount)}원
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600">
          {role === "bidder" ? "사업자 수정 가능" : "눌러서 상세보기"}
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div className="border-t border-zinc-200 px-4 py-4">
        <div className="ml-6 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="mt-0.5 text-[13px] leading-5 text-zinc-500">
                이미지·도면으로 확인하기 어려운 조건을 공종별 한 번만 정리했습니다.
                개별 아이템에는 반복 안내 대신 ‘기본단가·현장확인’ 표시만 제공합니다.
              </p>
            </div>
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
              <Pencil className="h-3 w-3" /> 세부내역서에서 수량·재료단가·노무단가·경비단가를 수정하면 합계가 즉시 재계산됩니다.
            </p>
          )}
        </div>
      </div>
    </details>
  );
}

/* 1. 갑지 */
function CoverTab({ meta, setMeta, cost, category, areaLabel, lineCount, tradeCount }: any) {
  const fld = "w-full border-b border-slate-300 bg-transparent py-1.5 text-xs text-slate-800 outline-none focus:border-black";
  return (
    <div className="mx-auto max-w-4xl border border-slate-300 bg-white p-5 shadow-sm sm:p-9">
      <div className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-slate-400">
            INPICK CONSTRUCTION ESTIMATE
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[0.28em] text-slate-950">
            견 적 서
          </h1>
          <p className="mt-2 text-[11px] text-slate-500">
            {category === "residential"
              ? "공동주택 인테리어 공사"
              : "상가·근린생활시설 인테리어 공사"}
            {areaLabel ? ` · ${areaLabel}` : ""}
          </p>
        </div>
        <div className="w-56 border border-slate-300 text-[11px]">
          <DocumentMetaRow label="견적번호" value={meta.documentNo} placeholder="INPICK-YYYYMMDD-001" onChange={(value) => setMeta({ ...meta, documentNo: value })} />
          <DocumentMetaRow label="견적일자" value={meta.date} placeholder="YYYY-MM-DD" onChange={(value) => setMeta({ ...meta, date: value })} />
          <DocumentMetaRow label="유효기간" value={meta.validUntil} placeholder="YYYY-MM-DD" onChange={(value) => setMeta({ ...meta, validUntil: value })} />
        </div>
      </div>

      <div className="mt-5 grid border border-slate-300 text-xs sm:grid-cols-2">
        <PartyBox title="공급받는 자 · 발주처(갑)" name={meta.client} placeholder="고객명 또는 상호" onChange={(value) => setMeta({ ...meta, client: value })} />
        <PartyBox title="공급자 · 시공사(을)" name={meta.vendor} placeholder="시공사 상호" onChange={(value) => setMeta({ ...meta, vendor: value })} supplier />
      </div>

      <div className="mt-5 grid gap-x-8 gap-y-3 border-y border-slate-300 py-4 text-xs sm:grid-cols-2">
        <Field label="공 사 명">
          <input className={fld} placeholder="○○아파트 인테리어 공사" value={meta.projectName} onChange={(e) => setMeta({ ...meta, projectName: e.target.value })} />
        </Field>
        <Field label="공 사 장 소">
          <input className={fld} placeholder="현장 주소" value={meta.siteAddress} onChange={(e) => setMeta({ ...meta, siteAddress: e.target.value })} />
        </Field>
        <Field label="예상 공사기간">
          <div className="flex items-center justify-between border-b border-slate-300 py-1.5">
            <span className="text-xs text-slate-500">착공일 협의 후 약</span>
            <span className="text-xs font-bold text-slate-800">
              {meta.expectedPeriodDays || 0}일
            </span>
            <span className="text-[9px] text-slate-400">공정표 자동 반영</span>
          </div>
        </Field>
        <Field label="견 적 범 위">
          <p className="border-b border-slate-300 py-1.5 text-xs text-slate-700">
            {tradeCount}개 공종 · {lineCount}개 세부항목
          </p>
        </Field>
      </div>

      <div className="my-6 border-2 border-slate-900">
        <div className="grid items-stretch sm:grid-cols-[180px_1fr]">
          <div className="flex items-center justify-center bg-slate-100 px-4 py-5 text-sm font-black text-slate-800">
            견 적 금 액
          </div>
          <div className="border-t border-slate-900 px-5 py-4 text-right sm:border-l sm:border-t-0">
            <p className="text-[11px] text-slate-500">
              일금 {numToKorean(cost.contractPrice)}원정 · VAT 포함
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-slate-950">
              {won(cost.contractPrice)}
              <span className="ml-1 text-base font-bold">원</span>
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden border border-slate-300 text-xs">
        <RowKV k="직접재료비" v={cost.directMaterial} />
        <RowKV k="직접노무비" v={cost.directLabor} />
        <RowKV k="직접경비" v={cost.directExpense} />
        <RowKV k="간접노무비·제경비" v={cost.indirectLabor + cost.indirectExpenseSubtotal} sub />
        <RowKV k="일반관리비·이윤" v={cost.generalAdmin + cost.profit} sub />
        <RowKV k="공급가액" v={cost.supplyPrice} />
        <RowKV k={`부가가치세 (${cost.margins.vat}%)`} v={cost.vat} />
        <RowKV k="도급금액" v={cost.contractPrice} strong />
      </div>

      <div className="mt-5 grid gap-3 border border-slate-300 p-4 text-[11px] leading-5 text-slate-500 sm:grid-cols-[1fr_240px]">
        <div>
          <p className="font-bold text-slate-700">견적 조건 및 특기사항</p>
          <p>1. 본 견적은 설계 이미지·도면과 입력 수량을 기준으로 작성했습니다.</p>
          <p>2. 철거·전기·설비는 현장 조사 후 수량과 단가를 확정합니다.</p>
          <p>3. 자재 변경·추가공사·현장 여건 변경은 서면 합의 후 반영합니다.</p>
          <p>4. 총괄내역서와 세부내역서는 본 견적서의 부속서로 합니다.</p>
        </div>
        <div className="flex min-h-28 flex-col justify-between border border-slate-300 p-3">
          <div>
            <p className="text-[10px] text-slate-400">공급자 확인</p>
            <p className="mt-1 font-bold text-slate-800">{meta.vendor || "시공사 상호"}</p>
          </div>
          <p className="text-right text-slate-600">대표자: __________________ (인)</p>
        </div>
      </div>
    </div>
  );
}
function Field({ label, children }: any) { return (<div><p className="text-[10px] text-slate-400 mb-0.5">{label}</p>{children}</div>); }
function DocumentMetaRow({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="grid grid-cols-[70px_1fr] border-b border-slate-200 last:border-0">
      <span className="bg-slate-50 px-2 py-1.5 font-semibold text-slate-500">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="min-w-0 bg-transparent px-2 py-1.5 text-right text-[10px] text-slate-700 outline-none" />
    </label>
  );
}
function PartyBox({ title, name, placeholder, onChange, supplier = false }: { title: string; name: string; placeholder: string; onChange: (value: string) => void; supplier?: boolean }) {
  return (
    <div className={`p-4 ${supplier ? "border-t border-slate-300 sm:border-l sm:border-t-0" : ""}`}>
      <p className="text-[10px] font-bold tracking-wide text-slate-400">{title}</p>
      <input value={name} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full border-b border-slate-300 bg-transparent py-1 text-sm font-bold text-slate-800 outline-none" />
      <div className="mt-3 grid grid-cols-2 gap-4 text-[10px] text-slate-400">
        <span>대표자: __________________</span>
        <span>연락처: __________________</span>
        <span className="col-span-2">주소: ____________________________________________</span>
      </div>
    </div>
  );
}
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
            <Fixed label="직접경비" amount={cost.directExpense} bold />
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
            <Fixed
              label="경비 소계 (직접경비+제경비)"
              amount={cost.expenseSubtotal}
              strong
            />
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
  const rows = sheet.groups.map((g: any) => {
    const ratio = g.sum / directTotal;
    const indirectAllocated = Math.round(indirect * ratio);
    const total = g.sum + indirectAllocated;
    return {
      ...g,
      indirectAllocated,
      total,
      share: total / (cost.supplyPrice || 1),
    };
  });
  const maxShare = Math.max(...rows.map((r: any) => r.share), 0.01);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
      <div className="px-4 py-3 border-b border-gray-200"><h2 className="text-base font-bold text-gray-900">총괄내역서 — 공종별 집계표</h2><p className="text-[13px] text-gray-400 mt-0.5">직접비 + 간접비 안분 · 구성비(공급가액 기준)</p></div>
      <table className="w-full text-[13px]">
        <thead><tr className="bg-slate-100 text-slate-600 border-b border-slate-200"><th className="px-3 py-2 text-left font-semibold">공종</th><th className="px-2 py-2 text-right font-semibold">재료비</th><th className="px-2 py-2 text-right font-semibold">노무비</th><th className="px-2 py-2 text-right font-semibold">직접경비</th><th className="px-2 py-2 text-right font-semibold">간접비 안분</th><th className="px-2 py-2 text-right font-semibold">합계</th><th className="px-3 py-2 text-left font-semibold w-40">구성비</th></tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.trade} className="border-b border-slate-50 hover:bg-black/[0.025]">
              <td className="px-3 py-1.5 text-slate-700">{String(r.order).padStart(2, "0")}. {r.trade}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{won(r.matSum)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{won(r.labSum)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{won(r.expenseSum)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{won(r.indirectAllocated)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-slate-900">{won(r.total)}</td>
              <td className="px-3 py-1.5"><div className="flex items-center gap-2"><div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-black rounded-full" style={{ width: `${(r.share / maxShare) * 100}%` }} /></div><span className="text-xs text-slate-400 tabular-nums w-10 text-right">{(r.share * 100).toFixed(1)}%</span></div></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-bold border-t-2 border-slate-200"><td className="px-3 py-2 text-slate-700">직접비 계</td><td className="px-2 py-2 text-right tabular-nums">{won(sheet.directMaterial)}</td><td className="px-2 py-2 text-right tabular-nums">{won(sheet.directLabor)}</td><td className="px-2 py-2 text-right tabular-nums">{won(sheet.directExpense)}</td><td className="px-2 py-2 text-right tabular-nums text-slate-500">{won(indirect)}</td><td className="px-2 py-2 text-right tabular-nums text-black">{won(cost.supplyPrice)}</td><td className="px-3 py-2 text-xs text-slate-400">공급가액</td></tr>
          <tr className="bg-slate-800 text-white"><td colSpan={5} className="px-3 py-2.5 font-bold">도급금액 (VAT 포함)</td><td colSpan={2} className="px-2 py-2.5 text-right text-base font-bold tabular-nums">{won(cost.contractPrice)}원</td></tr>
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
            {groupBy === "room"
              ? "같은 부위의 철거·바탕·마감·부대공정을 1개 공사로 합산했습니다"
              : role === "bidder"
                ? "수량과 단가를 현장 확인값으로 수정할 수 있습니다"
                : "사업자 편집에서 현장 확인값을 조정할 수 있습니다"}
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
                      <th className="px-2 py-2 text-right font-semibold w-20">{groupBy === "room" ? "재료환산" : "재료단가"}</th>
                      <th className="px-2 py-2 text-right font-semibold w-24">재료금액</th>
                      <th className="px-2 py-2 text-right font-semibold w-20">{groupBy === "room" ? "노무환산" : "노무단가"}</th>
                      <th className="px-2 py-2 text-right font-semibold w-24">노무금액</th>
                      <th className="px-2 py-2 text-right font-semibold w-20">{groupBy === "room" ? "경비환산" : "경비단가"}</th>
                      <th className="px-2 py-2 text-right font-semibold w-24">경비금액</th>
                      <th className="px-2 py-2 text-right font-semibold w-28">합계</th><th className="w-8"></th>
                    </tr></thead>
                    <tbody>
                      {g.lines.map((l: Row) => (<EditRow key={l.id} l={l} updateRow={updateRow} deleteRow={deleteRow} role={role} />))}
                      <tr className="bg-zinc-50 border-t border-zinc-200"><td colSpan={6} className="px-2 py-2 text-right font-bold text-zinc-500">소계</td><td className="px-2 py-2 text-right tabular-nums font-bold text-zinc-600">{won(g.matSum)}</td><td></td><td className="px-2 py-2 text-right tabular-nums font-bold text-zinc-600">{won(g.labSum)}</td><td></td><td className="px-2 py-2 text-right tabular-nums font-bold text-zinc-600">{won(g.expenseSum)}</td><td className="px-2 py-2 text-right tabular-nums font-bold text-black">{won(g.sum)}</td><td></td></tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 px-4 py-3.5 text-white">
        <span className="text-sm font-bold">직접공사비 합계</span>
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-[13px] text-white/70">
          <span>재료 {won(sheet.directMaterial)}원</span>
          <span>노무 {won(sheet.directLabor)}원</span>
          <span>경비 {won(sheet.directExpense)}원</span>
          <span className="text-lg font-bold tabular-nums text-white">{won(sheet.directTotal)}원</span>
        </div>
      </div>
    </div>
  );
}
function EditRow({ l, updateRow, deleteRow, role }: { l: Row; updateRow: any; deleteRow: any; role: "owner" | "bidder" }) {
  const hasMat = l.brand !== "-";
  const editable = role === "bidder" && !l.isWorkPackage;
  const numCls = "w-full text-right text-sm bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent hover:border-zinc-200 focus:border-zinc-400 rounded px-1 py-1 focus:outline-none tabular-nums";
  return (
    <tr className="border-b border-zinc-50 hover:bg-zinc-50/60">
      <td className="px-2 py-2 text-center"><span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${PART_BADGE}`}>{l.part}</span></td>
      <td className="px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-zinc-800">{l.itemName}</span>
          {l.siteVerificationRequired && (
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 ring-1 ring-zinc-200">
              기본단가 · 현장확인
            </span>
          )}
        </div>
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
        {l.isWorkPackage && l.workBreakdown && (
          <details className="mt-1.5 max-w-xl text-xs leading-5 text-zinc-500">
            <summary className="cursor-pointer select-none font-semibold text-zinc-600">
              세부 산출근거 {l.workBreakdown.length}개 보기
            </summary>
            <div className="mt-1.5 space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
              {l.workBreakdown.map((item, index) => (
                <div key={item.id} className="grid gap-1 border-b border-zinc-200/70 pb-1 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto]">
                  <div>
                    <span className="font-semibold text-zinc-700">{index + 1}. {item.taskName}</span>
                    <span className="ml-1 text-zinc-400">· {item.quantity}{item.unit} · {item.quantityBasis}</span>
                  </div>
                  <span className="tabular-nums text-zinc-600">
                    재료 {won(item.matAmount)} · 노무 {won(item.laborAmount)} · 경비 {won(item.expenseAmount)} · 합계 {won(item.amount)}
                  </span>
                </div>
              ))}
              {role === "bidder" && (
                <p className="pt-1 font-semibold text-zinc-600">수량·단가는 공종별 탭의 원가 라인에서 수정합니다.</p>
              )}
            </div>
          </details>
        )}
        {l.isWorkPackage && l.quantityBasis && (
          <p className="mt-1 text-[11px] text-zinc-400">대표수량 · {l.quantityBasis}</p>
        )}
      </td>
      <td className="px-2 py-1.5 text-zinc-500">{l.spec}</td>
      <td className="px-2 py-1.5 text-center text-zinc-500">{l.unit}</td>
      <td className="px-1 py-1.5">{editable ? <input aria-label={`${l.itemName} 수량`} type="number" value={l.quantity} onChange={(e) => updateRow(l.id, { quantity: Number(e.target.value) || 0 })} className={numCls} /> : <span className="block px-1 text-right tabular-nums text-zinc-600">{l.quantity}</span>}</td>
      <td className="px-1 py-1.5">{editable ? <input aria-label={`${l.itemName} 재료단가`} type="number" value={l.matUnit} onChange={(e) => updateRow(l.id, { matUnit: Number(e.target.value) || 0 })} className={numCls} /> : <span className="block px-1 text-right tabular-nums text-zinc-600">{won(l.matUnit)}</span>}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-700">{won(l.matAmount)}</td>
      <td className="px-1 py-1.5"><div className="flex items-center">{l.labWas && <span title={`보정 ${won(l.labWas)}→${won(l.labUnit)}`}><TrendingDown className="w-3 h-3 text-zinc-400 flex-shrink-0" /></span>}{editable ? <input aria-label={`${l.itemName} 노무단가`} type="number" value={l.labUnit} onChange={(e) => updateRow(l.id, { labUnit: Number(e.target.value) || 0 })} className={numCls} /> : <span className="block w-full px-1 text-right tabular-nums text-zinc-600">{won(l.labUnit)}</span>}</div></td>
      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-700">{won(l.labAmount)}</td>
      <td className="px-1 py-1.5">{editable ? <input aria-label={`${l.itemName} 경비단가`} type="number" value={l.expenseUnit} onChange={(e) => updateRow(l.id, { expenseUnit: Number(e.target.value) || 0 })} className={numCls} /> : <span className="block px-1 text-right tabular-nums text-zinc-600">{won(l.expenseUnit)}</span>}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-700">{won(l.expenseAmount)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-zinc-900">{won(l.amount)}</td>
      <td className="px-1 py-1.5 text-center">{editable && <button onClick={() => deleteRow(l.id)} className="text-zinc-300 hover:text-black" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
    </tr>
  );
}

/* 공정표 */
function ScheduleTab({
  schedule,
  role,
  edited,
  updateSchedulePhase,
  resetSchedule,
}: {
  schedule: ScheduleResult;
  role: "owner" | "bidder";
  edited: boolean;
  updateSchedulePhase: (
    key: string,
    patch: EstimateScheduleOverride,
  ) => void;
  resetSchedule: () => void;
}) {
  const total = schedule.totalDays || 1;
  const tickStep = total <= 10 ? 1 : total <= 30 ? 5 : 10;
  const ticks = Array.from(
    { length: Math.ceil(total / tickStep) + 1 },
    (_, i) => i * tickStep,
  ).filter((day) => day <= total);
  if (ticks[ticks.length - 1] !== total) ticks.push(total);
  const bidder = role === "bidder";

  return (
    <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-[0_14px_45px_rgba(37,99,235,0.06)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">
              공정표 — 견적 수량 기반 예정 공기
            </h2>
            <span className="rounded-full bg-gradient-to-r from-blue-600 to-sky-400 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm shadow-blue-200">
              총 {schedule.totalDays}일
            </span>
            {edited && (
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
                사업자 조정됨
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-5 text-gray-400">
            견적 수량 ÷ 표준 일당 시공량 + 방수·타일 검사 및 양생기간
          </p>
        </div>
        {bidder && (
          <button
            type="button"
            onClick={resetSchedule}
            disabled={!edited}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <RotateCcw className="h-3 w-3" />
            자동 산정으로 초기화
          </button>
        )}
      </div>

      {schedule.phases.length > 0 ? (
        <>
          <div
            className={`mb-1 flex items-center ${
              bidder ? "pr-[154px]" : "pr-[72px]"
            }`}
          >
            <div className="w-48 shrink-0" />
            <div className="relative h-4 flex-1">
              {ticks.map((day) => (
                <span
                  key={day}
                  className="absolute -translate-x-1/2 text-[11px] text-blue-400"
                  style={{ left: `${(day / total) * 100}%` }}
                >
                  {day}일
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {schedule.phases.map((phase) => (
              <ScheduleRow
                key={phase.key}
                phase={phase}
                total={total}
                ticks={ticks}
                bidder={bidder}
                updateSchedulePhase={updateSchedulePhase}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-blue-100 py-10 text-center text-[13px] text-slate-400">
          견적 공종을 추가하면 수량 기반 공정표가 생성됩니다.
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-blue-50 pt-4 text-[13px]">
        <span className="text-slate-400">
          총 {schedule.phases.length}개 공정 · 기본 순차 시공 · 계약 전 현장
          조건에 따라 조정
        </span>
        <span className="font-bold text-slate-700">
          직접공사비 {won(schedule.totalCost)}원
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-400">
        표준 공기는 예비값입니다. 실제 착공일, 작업 가능 시간, 투입 인원,
        병렬 시공, 자재 제작·납기와 공동주택 관리규약은 사업자 입찰 공정표에서
        확정합니다.
      </p>
    </div>
  );
}

function ScheduleRow({
  phase,
  total,
  ticks,
  bidder,
  updateSchedulePhase,
}: {
  phase: PhaseBar;
  total: number;
  ticks: number[];
  bidder: boolean;
  updateSchedulePhase: (
    key: string,
    patch: EstimateScheduleOverride,
  ) => void;
}) {
  const startDayLabel = phase.startDay + 1;
  const endDayLabel = phase.startDay + phase.durationDays;
  return (
    <div className="group flex items-center gap-2">
      <div className="w-48 shrink-0 pr-2">
        <p
          className="truncate text-[13px] font-bold text-slate-700"
          title={phase.trades.join(", ")}
        >
          {phase.name}
        </p>
        <p
          className="mt-0.5 truncate text-[11px] text-slate-400"
          title={`${phase.basis} · ${phase.standardRef}`}
        >
          {phase.basis}
        </p>
      </div>
      <div className="relative h-9 min-w-[180px] flex-1 overflow-hidden rounded-lg bg-blue-50/60 ring-1 ring-inset ring-blue-100/50">
        {ticks.map((day) => (
          <span
            key={day}
            className="absolute inset-y-0 border-l border-blue-100/70"
            style={{ left: `${(day / total) * 100}%` }}
          />
        ))}
        <div
          className="absolute inset-y-1 flex min-w-[24px] items-center overflow-hidden whitespace-nowrap rounded-md px-2 text-[11px] font-bold text-white shadow-sm shadow-blue-200/70 transition-[filter] group-hover:brightness-105"
          style={{
            left: `${(phase.startDay / total) * 100}%`,
            width: `${(phase.durationDays / total) * 100}%`,
            backgroundImage: phase.gradient,
          }}
          title={`${phase.name} · ${startDayLabel}~${endDayLabel}일차 · ${phase.standardRef}`}
        >
          {phase.durationDays}일
        </div>
      </div>
      {bidder ? (
        <div className="grid w-[146px] shrink-0 grid-cols-2 gap-1.5">
          <label className="text-[11px] text-slate-400">
            시작
            <span className="mt-0.5 flex items-center rounded-md border border-blue-100 bg-white px-1.5">
              <input
                aria-label={`${phase.name} 시작일`}
                type="number"
                min={1}
                value={startDayLabel}
                onChange={(event) =>
                  updateSchedulePhase(phase.key, {
                    startDay: Math.max(
                      0,
                      (Number(event.target.value) || 1) - 1,
                    ),
                  })
                }
                className="w-full bg-transparent py-1 text-right text-xs font-bold text-blue-800 outline-none"
              />
              <span>일</span>
            </span>
          </label>
          <label className="text-[11px] text-slate-400">
            기간
            <span className="mt-0.5 flex items-center rounded-md border border-blue-100 bg-white px-1.5">
              <input
                aria-label={`${phase.name} 공사기간`}
                type="number"
                min={1}
                value={phase.durationDays}
                onChange={(event) =>
                  updateSchedulePhase(phase.key, {
                    durationDays: Math.max(
                      1,
                      Number(event.target.value) || 1,
                    ),
                  })
                }
                className="w-full bg-transparent py-1 text-right text-xs font-bold text-blue-800 outline-none"
              />
              <span>일</span>
            </span>
          </label>
        </div>
      ) : (
        <div className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-blue-700">
          {startDayLabel}~{endDayLabel}일
        </div>
      )}
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
