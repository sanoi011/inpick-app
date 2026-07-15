"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import {
  BUSINESS_INQUIRY_STATUSES,
  BUSINESS_INQUIRY_TYPES,
  type BusinessInquiryStatus,
} from "@/lib/business-center";

type Inquiry = {
  id: string;
  inquiryType: string;
  companyName: string;
  businessRegistrationNo: string;
  businessAddress: string;
  contactEmail: string | null;
  message: string;
  status: BusinessInquiryStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_META: Record<BusinessInquiryStatus, { label: string; description: string }> = {
  new: { label: "신규", description: "아직 확인하지 않은 문의" },
  reviewing: { label: "검토 중", description: "담당자가 내용을 검토 중" },
  contacted: { label: "연락 완료", description: "신청 업체에 1차 연락 완료" },
  approved: { label: "승인", description: "협업·등록 진행이 승인됨" },
  rejected: { label: "보류·반려", description: "현재 진행하지 않는 문의" },
  closed: { label: "종료", description: "처리가 모두 끝난 문의" },
};

function adminHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${typeof window === "undefined" ? "" : localStorage.getItem("admin_token") || ""}`,
  };
}

function formatRegistrationNo(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function BusinessInquiriesAdminPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BusinessInquiryStatus>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setAuthRequired(false);
    setNotice("");
    try {
      const response = await fetch("/api/admin/business-inquiries", {
        headers: adminHeaders(),
        cache: "no-store",
      });
      if (response.status === 401) {
        setAuthRequired(true);
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "문의 목록을 불러오지 못했습니다.");
      const next = (data.inquiries || []) as Inquiry[];
      setInquiries(next);
      setSelectedId((current) => current && next.some((item) => item.id === current) ? current : null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "문의 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => ({
    all: inquiries.length,
    new: inquiries.filter((item) => item.status === "new").length,
    active: inquiries.filter((item) => item.status === "reviewing" || item.status === "contacted").length,
    approved: inquiries.filter((item) => item.status === "approved").length,
  }), [inquiries]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    return inquiries.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.inquiryType !== typeFilter) return false;
      if (!keyword) return true;
      return [
        item.companyName,
        item.businessRegistrationNo,
        item.businessAddress,
        item.contactEmail || "",
        item.message,
      ].some((value) => value.toLocaleLowerCase("ko-KR").includes(keyword));
    });
  }, [inquiries, search, statusFilter, typeFilter]);

  const selected = useMemo(
    () => inquiries.find((item) => item.id === selectedId) || null,
    [inquiries, selectedId],
  );

  const updateSelected = (patch: Partial<Inquiry>) => {
    if (!selectedId) return;
    setInquiries((current) => current.map((item) => item.id === selectedId ? { ...item, ...patch } : item));
  };

  const saveInquiry = async () => {
    if (!selected) return;
    setSavingId(selected.id);
    setNotice("");
    try {
      const response = await fetch("/api/admin/business-inquiries", {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({
          id: selected.id,
          status: selected.status,
          adminNote: selected.adminNote || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "문의 정보를 저장하지 못했습니다.");
      setInquiries((current) => current.map((item) => item.id === selected.id ? { ...item, updatedAt: new Date().toISOString() } : item));
      setNotice(`${selected.companyName} 문의를 저장했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "문의 정보를 저장하지 못했습니다.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/32">Business inquiries</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">비즈니스 문의 관리</h1>
          <p className="mt-2 text-sm text-black/45">자재 납품·제조·지역 협력업체의 신청 내용을 확인하고 처리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 text-xs font-bold transition hover:border-black/25 disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric icon={Inbox} label="전체 문의" value={counts.all} />
        <Metric icon={Clock3} label="신규" value={counts.new} />
        <Metric icon={Building2} label="진행 중" value={counts.active} />
        <Metric icon={CheckCircle2} label="승인" value={counts.approved} />
      </section>

      <section className="mt-5 rounded-[22px] border border-black/[0.07] bg-white p-3 sm:p-4">
        <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_180px_180px]">
          <label className="relative block">
            <span className="sr-only">문의 검색</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="업체명, 사업자번호, 주소, 문의 내용 검색"
              className="h-11 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] pl-11 pr-10 text-xs outline-none transition focus:border-black/30"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="검색어 지우기" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/30 hover:text-black">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="신청 유형 필터"
            className="h-11 rounded-2xl border border-black/10 bg-white px-3 text-xs font-semibold outline-none focus:border-black/30"
          >
            <option value="all">모든 신청 유형</option>
            {BUSINESS_INQUIRY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.shortLabel}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | BusinessInquiryStatus)}
            aria-label="처리 상태 필터"
            className="h-11 rounded-2xl border border-black/10 bg-white px-3 text-xs font-semibold outline-none focus:border-black/30"
          >
            <option value="all">모든 처리 상태</option>
            {BUSINESS_INQUIRY_STATUSES.map((status) => <option key={status} value={status}>{STATUS_META[status].label}</option>)}
          </select>
        </div>
        <p className="mt-3 px-1 text-[11px] text-black/35">검색 결과 {filtered.length}건 · 최근 접수 순</p>
      </section>

      {notice && (
        <div className="mt-4 rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white" role="status">
          {notice}
        </div>
      )}

      {authRequired ? (
        <section className="mt-5 rounded-[22px] border border-black/[0.07] bg-white px-5 py-16 text-center">
          <p className="text-sm font-semibold">관리자 로그인이 필요합니다.</p>
          <Link href="/admin/login" className="mt-4 inline-flex h-10 items-center rounded-full bg-black px-5 text-xs font-bold text-white">관리자 로그인</Link>
        </section>
      ) : loading ? (
        <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-black/30" /></div>
      ) : (
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_140px_100px] gap-4 border-b border-black/[0.06] bg-[#f7f7f5] px-5 py-3 text-[10px] font-bold text-black/35 md:grid">
              <span>업체·문의</span><span>신청 유형</span><span>접수 일시</span><span>상태</span>
            </div>
            {filtered.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                <Inbox className="h-7 w-7 text-black/20" />
                <p className="mt-3 text-sm font-semibold">조건에 맞는 문의가 없습니다.</p>
                <p className="mt-1 text-xs text-black/35">검색어나 필터를 변경해 보세요.</p>
              </div>
            ) : filtered.map((inquiry) => {
              const type = BUSINESS_INQUIRY_TYPES.find((item) => item.value === inquiry.inquiryType);
              const active = selectedId === inquiry.id;
              return (
                <button
                  key={inquiry.id}
                  type="button"
                  onClick={() => setSelectedId(inquiry.id)}
                  className={`grid w-full gap-3 border-b border-black/[0.055] px-4 py-4 text-left transition last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_120px_140px_100px] md:items-center md:gap-4 md:px-5 ${active ? "bg-black/[0.055]" : "hover:bg-black/[0.025]"}`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      {inquiry.status === "new" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-black" />}
                      <span className="truncate text-sm font-semibold">{inquiry.companyName}</span>
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-black/38">{inquiry.message}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 md:block">
                    <span className="text-[10px] text-black/35 md:hidden">신청 유형</span>
                    <span className="text-xs font-medium text-black/62">{type?.shortLabel || inquiry.inquiryType}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 md:block">
                    <span className="text-[10px] text-black/35 md:hidden">접수 일시</span>
                    <span className="text-[11px] text-black/42">{formatDate(inquiry.createdAt)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 md:block">
                    <span className="text-[10px] text-black/35 md:hidden">처리 상태</span>
                    <StatusBadge status={inquiry.status} />
                  </span>
                </button>
              );
            })}
          </section>

          <aside className="xl:sticky xl:top-20">
            {!selected ? (
              <div className="hidden min-h-[420px] items-center justify-center rounded-[22px] border border-dashed border-black/10 bg-white p-8 text-center xl:flex">
                <div>
                  <Building2 className="mx-auto h-7 w-7 text-black/20" />
                  <p className="mt-3 text-sm font-semibold">문의 상세 보기</p>
                  <p className="mt-1 text-xs leading-5 text-black/35">왼쪽 목록에서 업체를 선택하면<br />상세 내용과 처리 도구가 표시됩니다.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border border-black/[0.07] bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.06)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <StatusBadge status={selected.status} />
                    <h2 className="mt-3 truncate text-xl font-semibold tracking-[-0.035em]">{selected.companyName}</h2>
                    <p className="mt-1 text-[11px] text-black/35">{formatDate(selected.createdAt)} 접수</p>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} aria-label="상세 닫기" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/40 hover:text-black">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <dl className="mt-5 space-y-3 rounded-2xl bg-[#f7f7f5] p-4 text-xs">
                  <InfoRow label="신청 유형" value={BUSINESS_INQUIRY_TYPES.find((item) => item.value === selected.inquiryType)?.label || selected.inquiryType} />
                  <InfoRow label="사업자번호" value={formatRegistrationNo(selected.businessRegistrationNo)} />
                  <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-3">
                    <dt className="text-black/35"><MapPin className="mr-1 inline h-3.5 w-3.5" />주소</dt>
                    <dd className="break-words font-medium leading-5">{selected.businessAddress}</dd>
                  </div>
                  <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-3">
                    <dt className="text-black/35"><Mail className="mr-1 inline h-3.5 w-3.5" />이메일</dt>
                    <dd className="min-w-0 break-all font-medium">
                      {selected.contactEmail ? <a href={`mailto:${selected.contactEmail}`} className="underline decoration-black/20 underline-offset-2">{selected.contactEmail}</a> : "미입력"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5">
                  <p className="text-[11px] font-bold text-black/42">문의 내용</p>
                  <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-black/[0.07] p-4 text-xs leading-6 text-black/65">{selected.message}</p>
                </div>

                <label className="mt-5 block">
                  <span className="text-[11px] font-bold text-black/42">처리 상태</span>
                  <select
                    value={selected.status}
                    onChange={(event) => updateSelected({ status: event.target.value as BusinessInquiryStatus })}
                    className="mt-2 h-11 w-full rounded-2xl border border-black/10 bg-white px-3 text-xs font-semibold outline-none focus:border-black/30"
                  >
                    {BUSINESS_INQUIRY_STATUSES.map((status) => <option key={status} value={status}>{STATUS_META[status].label} · {STATUS_META[status].description}</option>)}
                  </select>
                </label>

                <label className="mt-4 block">
                  <span className="text-[11px] font-bold text-black/42">관리자 메모</span>
                  <textarea
                    value={selected.adminNote || ""}
                    onChange={(event) => updateSelected({ adminNote: event.target.value })}
                    rows={5}
                    maxLength={4000}
                    placeholder="연락 결과, 담당자, 후속 일정 등을 기록하세요."
                    className="mt-2 w-full resize-y rounded-2xl border border-black/10 p-3 text-xs leading-5 outline-none focus:border-black/30"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void saveInquiry()}
                  disabled={savingId === selected.id}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-xs font-bold text-white transition hover:bg-black/85 disabled:opacity-45"
                >
                  {savingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  상태·메모 저장
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Inbox; label: string; value: number }) {
  return (
    <article className="rounded-[20px] border border-black/[0.07] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-black/38">{label}</p>
        <Icon className="h-4 w-4 text-black/28" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.05em]">{value.toLocaleString()}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: BusinessInquiryStatus }) {
  const primary = status === "new" || status === "reviewing";
  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${primary ? "bg-black text-white" : "bg-black/[0.06] text-black/55"}`}>
      {STATUS_META[status].label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-3">
      <dt className="text-black/35">{label}</dt>
      <dd className="break-words font-medium leading-5">{value}</dd>
    </div>
  );
}
