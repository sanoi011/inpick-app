"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Clock, CheckCircle2, HardHat, PenLine, Inbox, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/Toast";
import { SkeletonContractCard, SkeletonSummaryCards } from "@/components/ui/Skeleton";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import type { Contract, ContractStatus } from "@/types/contract";
import { mapDbContract, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS } from "@/types/contract";

const CONTRACT_FILTERS = [
  { label: "전체", value: "all" },
  { label: "서명 대기", value: "pending" },
  { label: "시공중", value: "active" },
  { label: "완공", value: "done" },
];

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

const STATUS_ICONS: Record<ContractStatus, React.ReactNode> = {
  DRAFT: <FileText className="w-4 h-4" />,
  PENDING_SIGNATURE: <PenLine className="w-4 h-4" />,
  SIGNED: <CheckCircle2 className="w-4 h-4" />,
  IN_PROGRESS: <HardHat className="w-4 h-4" />,
  COMPLETED: <CheckCircle2 className="w-4 h-4" />,
};

function SummaryCards({ contracts }: { contracts: Contract[] }) {
  const total = contracts.length;
  const pending = contracts.filter((c) => c.status === "DRAFT" || c.status === "PENDING_SIGNATURE").length;
  const inProgress = contracts.filter((c) => c.status === "SIGNED" || c.status === "IN_PROGRESS").length;
  const completed = contracts.filter((c) => c.status === "COMPLETED").length;
  const cards = [
    { label: "전체", count: total },
    { label: "서명 대기", count: pending },
    { label: "시공중", count: inProgress },
    { label: "완공", count: completed },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-[20px] border border-black/[0.07] bg-white px-4 py-4">
          <p className="text-xs font-medium text-black/42">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{card.count}</p>
        </div>
      ))}
    </div>
  );
}

function ContractCard({ contract, onClick }: { contract: Contract; onClick: () => void }) {
  const contractor = ((contract as unknown as Record<string, unknown>)?.specialty_contractors || null) as Record<string, string> | null;
  return (
    <button onClick={onClick} className="w-full rounded-[22px] border border-black/[0.07] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-black/20">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {STATUS_ICONS[contract.status]}
          <h3 className="text-sm font-semibold">{contract.projectName || "인테리어 공사"}</h3>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CONTRACT_STATUS_COLORS[contract.status]}`}>
          {CONTRACT_STATUS_LABELS[contract.status]}
        </span>
      </div>
      {contract.address && <p className="mb-2 text-xs text-black/45">{contract.address}</p>}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs text-black/42">
          {contractor?.company_name && <span>시공사: {contractor.company_name}</span>}
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(contract.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
        <span className="text-sm font-semibold">{fmt(contract.totalAmount)}원</span>
      </div>
    </button>
  );
}

export default function MyPageContracts() {
  const router = useRouter();
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(10);

  const loadContracts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/contracts?consumerId=${user.id}`);
      const data = await res.json();
      setContracts((data.contracts || []).map((c: Record<string, unknown>) => mapDbContract(c)));
    } catch {
      setError(true);
      toast({ type: "error", title: "계약 정보 로드 실패", message: "잠시 후 다시 시도해주세요" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user) loadContracts(); }, [user, loadContracts]);

  const filtered = useMemo(() => {
    let list = contracts;
    if (statusFilter === "pending") list = list.filter((c) => c.status === "DRAFT" || c.status === "PENDING_SIGNATURE");
    else if (statusFilter === "active") list = list.filter((c) => c.status === "SIGNED" || c.status === "IN_PROGRESS");
    else if (statusFilter === "done") list = list.filter((c) => c.status === "COMPLETED");
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => {
        const name = c.projectName || "";
        const addr = c.address || "";
        const ctr = (((c as unknown as Record<string, unknown>)?.specialty_contractors || {}) as Record<string, string>).company_name || "";
        return name.toLowerCase().includes(q) || addr.toLowerCase().includes(q) || ctr.toLowerCase().includes(q);
      });
    }
    return list;
  }, [contracts, statusFilter, search]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
        <SkeletonSummaryCards />
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonContractCard key={i} />)}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      <div><p className="text-[11px] font-semibold tracking-[0.16em] text-black/38">CONTRACTS</p><h1 className="mt-2 text-[30px] font-medium tracking-[-0.055em] sm:text-[36px]">내 계약서</h1><p className="mt-2 text-sm text-black/45">서명부터 시공 완료까지 계약 상태를 확인합니다.</p></div>
      <SummaryCards contracts={contracts} />
      {contracts.length > 0 && (
        <SearchFilterBar searchValue={search} onSearchChange={setSearch} placeholder="프로젝트명, 주소, 시공사 검색..." filters={CONTRACT_FILTERS} activeFilter={statusFilter} onFilterChange={setStatusFilter} />
      )}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">계약 정보를 불러오지 못했습니다.</p>
          <button onClick={loadContracts} className="flex items-center gap-1 text-sm text-red-600 font-medium hover:text-red-800"><RefreshCw className="w-3.5 h-3.5" /> 재시도</button>
        </div>
      )}
      {filtered.length === 0 && !error ? (
        <div className="rounded-[24px] border border-black/[0.07] bg-white p-12 text-center">
          <Inbox className="mx-auto mb-4 h-12 w-12 text-black/18" strokeWidth={1.5} />
          <h3 className="mb-2 text-lg font-medium">{contracts.length === 0 ? "아직 계약이 없습니다" : "검색 결과가 없습니다"}</h3>
          <p className="mb-6 text-sm text-black/45">{contracts.length === 0 ? "프로젝트를 시작하고 견적을 받아보세요" : "다른 검색어나 필터를 시도해보세요"}</p>
          {contracts.length === 0 && (
            <button onClick={() => router.push("/project/new")} className="rounded-full bg-[#0d0d0d] px-6 py-2.5 text-sm font-medium text-white hover:bg-black/80">프로젝트 시작하기</button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, visibleCount).map((contract) => (
            <ContractCard key={contract.id} contract={contract} onClick={() => router.push(`/contract/${contract.id}`)} />
          ))}
          {filtered.length > visibleCount && (
            <button onClick={() => setVisibleCount((v) => v + 10)} className="w-full rounded-full border border-black/[0.08] bg-white py-3 text-sm font-medium text-black/60 transition hover:border-black/30 hover:text-black">
              더 보기 ({filtered.length - visibleCount}개 남음)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
