"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Clock,
  CheckCircle2,
  HardHat,
  PenLine,
  ArrowLeft,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/Toast";
import { SkeletonContractCard, SkeletonSummaryCards } from "@/components/ui/Skeleton";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import type { Contract, ContractStatus } from "@/types/contract";
import {
  mapDbContract,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
} from "@/types/contract";

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
  const pending = contracts.filter(
    (c) => c.status === "DRAFT" || c.status === "PENDING_SIGNATURE"
  ).length;
  const inProgress = contracts.filter(
    (c) => c.status === "SIGNED" || c.status === "IN_PROGRESS"
  ).length;
  const completed = contracts.filter((c) => c.status === "COMPLETED").length;

  const cards = [
    { label: "전체", count: total, color: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: "서명 대기", count: pending, color: "bg-amber-50 text-amber-700 border-amber-200" },
    { label: "시공중", count: inProgress, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { label: "완공", count: completed, color: "bg-green-50 text-green-700 border-green-200" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`px-4 py-3 rounded-xl border ${card.color}`}
        >
          <p className="text-xs font-medium opacity-80">{card.label}</p>
          <p className="text-2xl font-bold mt-1">{card.count}</p>
        </div>
      ))}
    </div>
  );
}

function ContractCard({
  contract,
  onClick,
}: {
  contract: Contract;
  onClick: () => void;
}) {
  const contractor = (contract as unknown as Record<string, unknown>)
    .specialty_contractors as Record<string, string> | undefined;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {STATUS_ICONS[contract.status]}
          <h3 className="text-sm font-bold text-gray-900">
            {contract.projectName || "인테리어 공사"}
          </h3>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CONTRACT_STATUS_COLORS[contract.status]}`}
        >
          {CONTRACT_STATUS_LABELS[contract.status]}
        </span>
      </div>

      {contract.address && (
        <p className="text-xs text-gray-500 mb-2">{contract.address}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {contractor?.company_name && (
            <span>시공사: {contractor.company_name}</span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(contract.createdAt).toLocaleDateString("ko-KR")}
          </span>
        </div>
        <span className="text-sm font-bold text-blue-600">
          {fmt(contract.totalAmount)}원
        </span>
      </div>
    </button>
  );
}

export default function ContractsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadContracts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/contracts?consumerId=${user.id}`);
      const data = await res.json();
      const mapped = (data.contracts || []).map(
        (c: Record<string, unknown>) => mapDbContract(c)
      );
      setContracts(mapped);
    } catch {
      setError(true);
      toast({ type: "error", title: "계약 정보 로드 실패", message: "잠시 후 다시 시도해주세요" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/auth?returnUrl=/contracts");
      return;
    }

    loadContracts();
  }, [user, authLoading, router, loadContracts]);

  const filtered = useMemo(() => {
    let list = contracts;

    if (statusFilter === "pending") {
      list = list.filter((c) => c.status === "DRAFT" || c.status === "PENDING_SIGNATURE");
    } else if (statusFilter === "active") {
      list = list.filter((c) => c.status === "SIGNED" || c.status === "IN_PROGRESS");
    } else if (statusFilter === "done") {
      list = list.filter((c) => c.status === "COMPLETED");
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => {
        const name = c.projectName || "";
        const addr = c.address || "";
        const contractor = ((c as unknown as Record<string, unknown>).specialty_contractors as Record<string, string> | undefined)?.company_name || "";
        return name.toLowerCase().includes(q) || addr.toLowerCase().includes(q) || contractor.toLowerCase().includes(q);
      });
    }

    return list;
  }, [contracts, statusFilter, search]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <a href="/" className="text-xl font-bold text-blue-600">INPICK</a>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">내 계약</span>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <SkeletonSummaryCards />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonContractCard key={i} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <a href="/" className="text-xl font-bold text-blue-600">
              INPICK
            </a>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">내 계약</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <SummaryCards contracts={contracts} />

        {contracts.length > 0 && (
          <SearchFilterBar
            searchValue={search}
            onSearchChange={setSearch}
            placeholder="프로젝트명, 주소, 시공사 검색..."
            filters={CONTRACT_FILTERS}
            activeFilter={statusFilter}
            onFilterChange={setStatusFilter}
          />
        )}

        {error && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">계약 정보를 불러오지 못했습니다.</p>
            <button
              onClick={loadContracts}
              className="flex items-center gap-1 text-sm text-red-600 font-medium hover:text-red-800"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 재시도
            </button>
          </div>
        )}

        {filtered.length === 0 && !error ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {contracts.length === 0 ? "아직 계약이 없습니다" : "검색 결과가 없습니다"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {contracts.length === 0 ? "프로젝트를 시작하고 견적을 받아보세요" : "다른 검색어나 필터를 시도해보세요"}
            </p>
            {contracts.length === 0 && (
              <button
                onClick={() => router.push("/project/new")}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                프로젝트 시작하기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                onClick={() => router.push(`/contract/${contract.bidId}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
