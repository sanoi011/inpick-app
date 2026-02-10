"use client";

import { useState, useEffect, useCallback } from "react";
import { useContractorAuth } from "@/hooks/useContractorAuth";
import {
  Loader2, DollarSign, TrendingUp, TrendingDown, AlertCircle,
  FileText, Plus, X, Receipt,
} from "lucide-react";
import {
  type Invoice, type ExpenseRecord, type FinanceSummary, type ProjectProfit,
  mapDbInvoice, mapDbExpense,
  INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS,
  EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS,
} from "@/types/finance";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

const INVOICE_TABS = [
  { value: "all", label: "전체" },
  { value: "draft", label: "초안" },
  { value: "sent", label: "발송" },
  { value: "paid", label: "수금" },
  { value: "overdue", label: "연체" },
];

const EXPENSE_CATS = [
  { value: "all", label: "전체" },
  { value: "material", label: "자재비" },
  { value: "labor", label: "노무비" },
  { value: "equipment", label: "장비비" },
  { value: "transport", label: "운반비" },
  { value: "other", label: "기타" },
];

export default function FinancePage() {
  const { contractorId, authChecked } = useContractorAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [projectProfits, setProjectProfits] = useState<ProjectProfit[]>([]);
  const [section, setSection] = useState<"overview" | "invoices" | "expenses">("overview");

  // 청구서
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ description: "", amount: "" });

  // 지출
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expenseFilter, setExpenseFilter] = useState("all");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", category: "material", expenseDate: "" });

  const [saving, setSaving] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!contractorId) return;
    try {
      const res = await fetch(`/api/contractor/finance?contractorId=${contractorId}`);
      const data = await res.json();
      setSummary(data.summary || null);
      setProjectProfits(data.projectProfits || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [contractorId]);

  const loadInvoices = useCallback(async () => {
    if (!contractorId) return;
    const params = new URLSearchParams({ contractorId });
    if (invoiceFilter !== "all") params.set("status", invoiceFilter);
    const res = await fetch(`/api/contractor/finance/invoices?${params}`);
    const data = await res.json();
    setInvoices((data.invoices || []).map((i: Record<string, unknown>) => mapDbInvoice(i)));
  }, [contractorId, invoiceFilter]);

  const loadExpenses = useCallback(async () => {
    if (!contractorId) return;
    const params = new URLSearchParams({ contractorId });
    if (expenseFilter !== "all") params.set("category", expenseFilter);
    const res = await fetch(`/api/contractor/finance/expenses?${params}`);
    const data = await res.json();
    setExpenses((data.expenses || []).map((e: Record<string, unknown>) => mapDbExpense(e)));
  }, [contractorId, expenseFilter]);

  useEffect(() => {
    if (authChecked && contractorId) {
      loadSummary();
      loadInvoices();
      loadExpenses();
    }
  }, [authChecked, contractorId, loadSummary, loadInvoices, loadExpenses]);

  // 청구서 생성
  const handleCreateInvoice = async () => {
    if (!contractorId || !invoiceForm.amount) return;
    setSaving(true);
    try {
      const res = await fetch("/api/contractor/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractorId,
          amount: Number(invoiceForm.amount),
          description: invoiceForm.description || null,
        }),
      });
      if (res.ok) {
        setShowInvoiceForm(false);
        setInvoiceForm({ description: "", amount: "" });
        loadInvoices();
        loadSummary();
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  // 지출 추가
  const handleCreateExpense = async () => {
    if (!contractorId || !expenseForm.amount || !expenseForm.description) return;
    setSaving(true);
    try {
      const res = await fetch("/api/contractor/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractorId,
          description: expenseForm.description,
          amount: Number(expenseForm.amount),
          category: expenseForm.category,
          expenseDate: expenseForm.expenseDate || undefined,
        }),
      });
      if (res.ok) {
        setShowExpenseForm(false);
        setExpenseForm({ description: "", amount: "", category: "material", expenseDate: "" });
        loadExpenses();
        loadSummary();
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  if (!authChecked) return null;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <DollarSign className="w-6 h-6 text-green-600" /> 재무 관리
      </h1>

      {/* 섹션 탭 */}
      <div className="flex gap-1.5 mb-6">
        {([
          { value: "overview", label: "개요" },
          { value: "invoices", label: "청구서" },
          { value: "expenses", label: "지출" },
        ] as const).map((s) => (
          <button key={s.value} onClick={() => setSection(s.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${section === s.value ? "bg-green-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>
      ) : (
        <>
          {/* 개요 */}
          {section === "overview" && summary && (
            <div className="space-y-6">
              {/* 요약 카드 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard label="이번달 매출" value={`${fmt(summary.monthlyRevenue)}원`}
                  sub={summary.revenueChangeRate !== 0 ? `전월 대비 ${summary.revenueChangeRate > 0 ? "+" : ""}${summary.revenueChangeRate}%` : undefined}
                  subColor={summary.revenueChangeRate >= 0 ? "text-green-600" : "text-red-600"}
                  icon={<TrendingUp className="w-5 h-5 text-green-500" />} />
                <SummaryCard label="이번달 지출" value={`${fmt(summary.monthlyExpenses)}원`}
                  icon={<TrendingDown className="w-5 h-5 text-red-400" />} />
                <SummaryCard label="미수금" value={`${fmt(summary.receivables.total)}원`}
                  sub={summary.receivables.overdue90 > 0 ? `90일 초과: ${fmt(summary.receivables.overdue90)}원` : undefined}
                  subColor="text-red-600"
                  icon={<AlertCircle className="w-5 h-5 text-amber-500" />} />
                <SummaryCard label="예상 잔액" value={`${fmt(summary.projectedBalance)}원`}
                  icon={<DollarSign className="w-5 h-5 text-blue-500" />} />
              </div>

              {/* 미수금 단계별 */}
              {summary.receivables.total > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">미수금 현황</h3>
                  <div className="grid grid-cols-4 gap-3">
                    <ReceivableBar label="정상" amount={summary.receivables.current} total={summary.receivables.total} color="bg-green-500" />
                    <ReceivableBar label="30일 초과" amount={summary.receivables.overdue30} total={summary.receivables.total} color="bg-amber-400" />
                    <ReceivableBar label="60일 초과" amount={summary.receivables.overdue60} total={summary.receivables.total} color="bg-orange-500" />
                    <ReceivableBar label="90일 초과" amount={summary.receivables.overdue90} total={summary.receivables.total} color="bg-red-500" />
                  </div>
                </div>
              )}

              {/* 프로젝트별 수익 */}
              {projectProfits.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">프로젝트별 수익</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-500 text-xs">
                          <th className="text-left py-2">프로젝트</th>
                          <th className="text-right py-2">매출</th>
                          <th className="text-right py-2">지출</th>
                          <th className="text-right py-2">이익</th>
                          <th className="text-right py-2">마진율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectProfits.map((p) => (
                          <tr key={p.projectId} className="border-b border-gray-50">
                            <td className="py-2 font-medium text-gray-900">{p.projectName}</td>
                            <td className="py-2 text-right text-gray-700">{fmt(p.revenue)}원</td>
                            <td className="py-2 text-right text-gray-700">{fmt(p.expenses)}원</td>
                            <td className={`py-2 text-right font-medium ${p.profit >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(p.profit)}원</td>
                            <td className={`py-2 text-right ${p.margin >= 0 ? "text-green-600" : "text-red-600"}`}>{p.margin}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 청구서 */}
          {section === "invoices" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1.5">
                  {INVOICE_TABS.map((t) => (
                    <button key={t.value} onClick={() => setInvoiceFilter(t.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${invoiceFilter === t.value ? "bg-green-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowInvoiceForm(true)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 청구서 생성
                </button>
              </div>

              {showInvoiceForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">새 청구서</h4>
                    <button onClick={() => setShowInvoiceForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">금액 (원) *</label>
                      <input type="number" value={invoiceForm.amount} onChange={(e) => setInvoiceForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      {invoiceForm.amount && <p className="text-xs text-gray-500 mt-1">부가세: {fmt(Number(invoiceForm.amount) * 0.1)}원 | 합계: {fmt(Number(invoiceForm.amount) * 1.1)}원</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">설명</label>
                      <input value={invoiceForm.description} onChange={(e) => setInvoiceForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="청구 내용" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowInvoiceForm(false)} className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">취소</button>
                    <button onClick={handleCreateInvoice} disabled={saving || !invoiceForm.amount}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                      {saving ? "생성중..." : "생성"}
                    </button>
                  </div>
                </div>
              )}

              {invoices.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">청구서가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-400">{inv.invoiceNumber}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </span>
                        </div>
                        {inv.description && <p className="text-sm text-gray-700">{inv.description}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(inv.createdAt).toLocaleDateString("ko-KR")}
                          {inv.dueDate && ` | 만기: ${inv.dueDate}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{fmt(inv.total)}원</p>
                        <p className="text-xs text-gray-400">공급가 {fmt(inv.amount)} + 세금 {fmt(inv.tax)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 지출 */}
          {section === "expenses" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1.5">
                  {EXPENSE_CATS.map((c) => (
                    <button key={c.value} onClick={() => setExpenseFilter(c.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${expenseFilter === c.value ? "bg-green-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowExpenseForm(true)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 지출 추가
                </button>
              </div>

              {showExpenseForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">지출 등록</h4>
                    <button onClick={() => setShowExpenseForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">내용 *</label>
                      <input value={expenseForm.description} onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="지출 내용" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">금액 (원) *</label>
                      <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">카테고리</label>
                      <select value={expenseForm.category} onChange={(e) => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                        <option value="material">자재비</option>
                        <option value="labor">노무비</option>
                        <option value="equipment">장비비</option>
                        <option value="transport">운반비</option>
                        <option value="office">사무비</option>
                        <option value="insurance">보험료</option>
                        <option value="other">기타</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">지출일</label>
                      <input type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm(f => ({ ...f, expenseDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowExpenseForm(false)} className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">취소</button>
                    <button onClick={handleCreateExpense} disabled={saving || !expenseForm.amount || !expenseForm.description}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                      {saving ? "등록중..." : "등록"}
                    </button>
                  </div>
                </div>
              )}

              {expenses.length === 0 ? (
                <div className="text-center py-16">
                  <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">지출 기록이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.map((exp) => (
                    <div key={exp.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${EXPENSE_CATEGORY_COLORS[exp.category]}`}>
                            {EXPENSE_CATEGORY_LABELS[exp.category]}
                          </span>
                          <h4 className="text-sm font-medium text-gray-900">{exp.description}</h4>
                        </div>
                        <p className="text-xs text-gray-400">{exp.expenseDate}{exp.projectName && ` | ${exp.projectName}`}</p>
                      </div>
                      <p className="text-lg font-bold text-red-600">-{fmt(exp.amount)}원</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, subColor, icon }: {
  label: string; value: string; sub?: string; subColor?: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor || "text-gray-500"}`}>{sub}</p>}
    </div>
  );
}

function ReceivableBar({ label, amount, total, color }: {
  label: string; amount: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs font-medium text-gray-700">{fmt(amount)}원</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
